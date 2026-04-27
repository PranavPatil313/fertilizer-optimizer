import asyncio
import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import threading

import numpy as np
import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy import select

from src.db.models import Dataset, TrainingJob
from src.db.session import AsyncSessionLocal
from src.model_utils import ARTIFACT_DIR, refresh_artifact_cache
from src.train_model import build_model, build_preprocessor


class TrainingCancelledError(Exception):
    """Raised when training is cancelled by user."""
    pass

# Global dictionary to track running jobs and their cancellation flags
_running_jobs: Dict[int, threading.Event] = {}

FEATURE_COLUMNS = [
    "crop_type",
    "soil_type",
    "region",
    "avg_temp",
    "rainfall_mm",
    "crop_duration_days",
    "soil_N",
    "soil_P",
    "soil_K",
    "pH",
    "organic_matter_pct",
    "irrigation_type",
    "area_acre",
]
TARGET_COLUMNS = ["N_kg_ha", "P_kg_ha", "K_kg_ha", "yield_kg_ha"]


def _check_cancellation(job_id: int) -> bool:
    """Check if job has been cancelled."""
    event = _running_jobs.get(job_id)
    if event and event.is_set():
        return True
    return False


async def cancel_training_job(job_id: int) -> bool:
    """Cancel a running or pending training job."""
    event = _running_jobs.get(job_id)
    if event:
        event.set()  # Signal cancellation
    
    # Update database status
    async with AsyncSessionLocal() as session:
        job = await session.get(TrainingJob, job_id)
        if not job:
            return False  # Job not found
        # Only allow cancelling if job is pending or running
        if job.status not in ("pending", "running"):
            return False  # Job already in a final state
        job.status = "cancelled"
        job.finished_at = datetime.utcnow()
        job.log = "Training cancelled by user"
        await session.commit()
    
    # Clean up after a short delay
    if event:
        async def _cleanup():
            await asyncio.sleep(2)
            _running_jobs.pop(job_id, None)
        asyncio.create_task(_cleanup())
    return True


async def run_training_job(job_id: int):
    # Create cancellation event for this job
    cancel_event = threading.Event()
    _running_jobs[job_id] = cancel_event
    
    try:
        async with AsyncSessionLocal() as session:
            job = await session.get(TrainingJob, job_id)
            if not job:
                _running_jobs.pop(job_id, None)
                return
            # If job already cancelled, exit early
            if job.status == "cancelled":
                _running_jobs.pop(job_id, None)
                return
            job.status = "running"
            job.started_at = datetime.utcnow()
            job.log = "Preparing training datasets..."
            await session.commit()

        # Check if cancelled before starting
        if _check_cancellation(job_id):
            async with AsyncSessionLocal() as session:
                job = await session.get(TrainingJob, job_id)
                if job:
                    job.status = "cancelled"
                    job.finished_at = datetime.utcnow()
                    job.log = "Training cancelled before start"
                    await session.commit()
            return

        dataset_paths = await _collect_dataset_paths(job_id)
        
        # Pass cancellation check function to training
        result = await asyncio.to_thread(
            _train_with_datasets,
            dataset_paths,
            job_id,
            lambda: _check_cancellation(job_id)
        )
        
        # Check if cancelled during training
        if _check_cancellation(job_id):
            async with AsyncSessionLocal() as session:
                job = await session.get(TrainingJob, job_id)
                if job:
                    job.status = "cancelled"
                    job.finished_at = datetime.utcnow()
                    job.log = "Training cancelled during execution"
                    await session.commit()
            return
            
        async with AsyncSessionLocal() as session:
            job = await session.get(TrainingJob, job_id)
            if not job:
                return
            job.status = "completed"
            job.artifact_path = result["artifact_dir"]
            job.finished_at = datetime.utcnow()
            job.log = result["log"]
            await session.commit()
    except Exception as exc:  # noqa: BLE001
        async with AsyncSessionLocal() as session:
            job = await session.get(TrainingJob, job_id)
            if not job:
                return
            # If cancelled, don't mark as failed
            if _check_cancellation(job_id):
                job.status = "cancelled"
                job.log = "Training cancelled by user"
            else:
                job.status = "failed"
                job.log = f"Training failed: {exc}"
            job.finished_at = datetime.utcnow()
            await session.commit()
    finally:
        # Clean up running job tracking
        _running_jobs.pop(job_id, None)


async def _collect_dataset_paths(job_id: int) -> List[str]:
    async with AsyncSessionLocal() as session:
        job = await session.get(TrainingJob, job_id)
        if not job:
            raise ValueError("Training job not found")
        ids = job.dataset_ids or []
        if isinstance(ids, str):
            ids = json.loads(ids)
        if not ids:
            raise ValueError("No datasets selected")
        result = await session.execute(select(Dataset).where(Dataset.id.in_(ids)))
        datasets = result.scalars().all()
        if len(datasets) != len(ids):
            raise ValueError("One or more datasets missing")
        missing = [d.id for d in datasets if d.status != "processed" or not d.processed_path]
        if missing:
            raise ValueError(f"Datasets not processed: {', '.join(map(str, missing))}")
            
        # Verify the physical files actually survived on the disk
        missing_on_disk = [d.name for d in datasets if not Path(d.processed_path).exists()]
        if missing_on_disk:
            raise FileNotFoundError(
                f"Dataset missing from disk: {', '.join(missing_on_disk)}. Please delete from the UI and re-upload."
            )
            
        return [d.processed_path for d in datasets]


def _train_with_datasets(dataset_paths: List[str], job_id: int, is_cancelled_callback=None):
    # Helper to check cancellation
    def check_cancelled():
        if is_cancelled_callback and is_cancelled_callback():
            raise TrainingCancelledError("Training cancelled by user")
    
    dfs = []
    for i, path in enumerate(dataset_paths):
        check_cancelled()
        df = pd.read_csv(path)
        dfs.append(df)
    
    check_cancelled()
    data = pd.concat(dfs, ignore_index=True)
    missing = [col for col in FEATURE_COLUMNS + TARGET_COLUMNS if col not in data.columns]
    if missing:
        raise ValueError(f"Dataset missing required columns: {', '.join(missing)}")

    check_cancelled()
    preprocessor, num_cols, cat_cols = build_preprocessor(data)
    X = data[FEATURE_COLUMNS]
    y = data[TARGET_COLUMNS]
    preprocessor.fit(X)
    X_transformed = preprocessor.transform(X)

    models = {}
    metrics = {}
    for target in TARGET_COLUMNS:
        check_cancelled()
        model = build_model()
        vector_y = y[target].values
        model.fit(X_transformed, vector_y)
        preds = model.predict(X_transformed)
        mae = float(np.mean(np.abs(preds - vector_y)))
        rmse = float(np.sqrt(np.mean((preds - vector_y) ** 2)))
        metrics[target] = {"mae": mae, "rmse": rmse}
        models[target] = model
    
    check_cancelled()

    artifact_dir = Path(ARTIFACT_DIR).resolve()
    job_dir = artifact_dir / f"job_{job_id}_{int(datetime.utcnow().timestamp())}"
    job_dir.mkdir(parents=True, exist_ok=True)

    model_bundle = {"models": models, "created_at": datetime.utcnow().isoformat()}
    import joblib

    joblib.dump(model_bundle, job_dir / "model.pkl", compress=3)
    joblib.dump(preprocessor, job_dir / "preprocessor.pkl", compress=3)

    metadata = {
        "features": FEATURE_COLUMNS,
        "targets": TARGET_COLUMNS,
        "num_cols": list(num_cols) if num_cols is not None else [],
        "cat_cols": list(cat_cols) if cat_cols is not None else [],
        "scores": metrics,
        "created_at": datetime.utcnow().isoformat(),
        "notes": f"Retrained from admin job {job_id}",
    }
    with (job_dir / "metadata.json").open("w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2)

    _publish_new_artifact(job_dir)
    log = f"Training completed with {len(data)} records across {len(dataset_paths)} dataset(s)."
    return {"artifact_dir": str(job_dir), "metadata": metadata, "log": log}


def _publish_new_artifact(job_dir: Path):
    target_dir = Path(ARTIFACT_DIR).resolve()
    for filename in ("model.pkl", "preprocessor.pkl", "metadata.json"):
        src = job_dir / filename
        if not src.exists():
            raise FileNotFoundError(f"Missing artifact file {filename}")
        shutil.copy2(src, target_dir / filename)
    refresh_artifact_cache()
