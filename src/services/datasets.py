import asyncio
import os
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy import select

from src.db.models import Dataset
from src.db.session import AsyncSessionLocal

DATASET_BASE_DIR = Path(
    os.getenv("DATASET_STORAGE_DIR", Path(__file__).resolve().parent.parent / "data")
).resolve()
UPLOAD_DIR = DATASET_BASE_DIR / "uploads"
PROCESSED_DIR = DATASET_BASE_DIR / "processed"
MAX_DATASET_BYTES = int(os.getenv("DATASET_MAX_BYTES", str(200 * 1024 * 1024)))


def ensure_dataset_dirs():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


async def stream_upload_to_disk(upload_file, destination: Path) -> int:
    """
    Stream an UploadFile to disk with a max-size guard.
    Returns number of bytes written.
    """
    ensure_dataset_dirs()
    size = 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as buffer:
        while True:
            chunk = await upload_file.read(1024 * 1024 * 2)  # 2MB chunks
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_DATASET_BYTES:
                destination.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Dataset exceeds 200 MB limit.",
                )
            buffer.write(chunk)
    await upload_file.seek(0)
    return size


async def preprocess_dataset(dataset_id: int):
    """
    Run preprocessing pipeline asynchronously.
    """
    ensure_dataset_dirs()
    async with AsyncSessionLocal() as session:
        dataset = await session.get(Dataset, dataset_id)
        if not dataset:
            return
        dataset.status = "processing"
        dataset.processing_log = "Queued for preprocessing"
        await session.commit()

    processed_path = PROCESSED_DIR / f"{dataset_id}_clean.csv"
    try:
        stats = await asyncio.to_thread(_run_preprocessing, Path(dataset.storage_path), processed_path)
        async with AsyncSessionLocal() as session:
            dataset = await session.get(Dataset, dataset_id)
            if not dataset:
                return
            dataset.status = "processed"
            dataset.processed_path = str(processed_path)
            dataset.row_count = stats.get("rows")
            dataset.column_count = stats.get("cols")
            dataset.processing_log = stats.get("log")
            dataset.updated_at = datetime.utcnow()
            await session.commit()
    except Exception as exc:  # noqa: BLE001
        async with AsyncSessionLocal() as session:
            dataset = await session.get(Dataset, dataset_id)
            if not dataset:
                return
            dataset.status = "failed"
            dataset.processing_log = f"Preprocessing failed: {exc}"
            dataset.updated_at = datetime.utcnow()
            await session.commit()


def _run_preprocessing(source_path: Path, processed_path: Path):
    if not source_path.exists():
        raise FileNotFoundError(f"Dataset path missing: {source_path}")
    df = pd.read_csv(source_path, encoding="utf-8-sig")
    original_rows = len(df)
    df.columns = [col.strip() for col in df.columns]
    # Drop duplicate rows and empty records
    df = df.drop_duplicates()
    df = df.dropna(how="all")

    # Basic cleaning: trim whitespace strings
    for col in df.select_dtypes(include=["object", "string"]).columns:
        df[col] = df[col].astype(str).str.strip()

    # Replace inf with NaN and impute numeric columns
    df = df.replace([np.inf, -np.inf], np.nan)
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        median = df[col].median()
        df[col] = df[col].fillna(median if not np.isnan(median) else 0)

    # Forward/backward fill for the rest
    df = df.ffill().bfill()

    # Convert target columns from kg/acre to kg/ha if they exist
    # Conversion factor: 1 hectare = 2.47105 acres, so kg/ha = kg/acre × 2.47105
    ACRE_TO_HECTARE = 2.47105
    target_ha_columns = ["N_kg_ha", "P_kg_ha", "K_kg_ha", "yield_kg_ha"]
    converted_cols = []
    for ha_col in target_ha_columns:
        acre_col = ha_col.replace("_kg_ha", "_kg_acre")
        if acre_col in df.columns and ha_col not in df.columns:
            # Convert from kg/acre to kg/ha
            df[ha_col] = df[acre_col] * ACRE_TO_HECTARE
            df = df.drop(columns=[acre_col])
            converted_cols.append(ha_col)

    processed_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(processed_path, index=False)
    conversion_note = f" Converted {len(converted_cols)} target columns from kg/acre to kg/ha." if converted_cols else ""
    log = (
        f"Cleaned {original_rows} rows -> {len(df)} rows. "
        f"{len(numeric_cols)} numeric columns imputed.{conversion_note}"
    )
    return {"rows": int(len(df)), "cols": int(len(df.columns)), "log": log}


async def fetch_dataset_or_404(dataset_id: int) -> Dataset:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Dataset).where(Dataset.id == dataset_id))
        dataset = result.scalar_one_or_none()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        return dataset
