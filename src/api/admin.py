import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from src.api.deps import require_admin
from src.db.models import Dataset, Plot, Prediction, TrainingJob, User
from src.db.session import AsyncSessionLocal
from src.services.datasets import UPLOAD_DIR, ensure_dataset_dirs, preprocess_dataset, stream_upload_to_disk
from src.services.training import run_training_job, cancel_training_job

router = APIRouter(prefix="/admin", tags=["admin"])


def _dataset_to_dict(dataset: Dataset):
    return {
        "id": dataset.id,
        "name": dataset.name,
        "description": dataset.description,
        "original_filename": dataset.original_filename,
        "filesize_bytes": dataset.filesize_bytes,
        "status": dataset.status,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "processed_path": dataset.processed_path,
        "processing_log": dataset.processing_log,
        "uploaded_by": dataset.uploaded_by,
        "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
        "updated_at": dataset.updated_at.isoformat() if dataset.updated_at else None,
    }


def _training_job_to_dict(job: TrainingJob):
    return {
        "id": job.id,
        "model_name": job.model_name,
        "dataset_ids": job.dataset_ids,
        "status": job.status,
        "log": job.log,
        "artifact_path": job.artifact_path,
        "triggered_by": job.triggered_by,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }


async def _list_users_dict():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        return [
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "is_active": bool(user.is_active),
            }
            for user in users
        ]


@router.get("/overview")
async def admin_overview(_: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        total_users = await session.scalar(select(func.count(User.id)))
        total_plots = await session.scalar(select(func.count(Plot.id)))
        total_predictions = await session.scalar(select(func.count(Prediction.id)))
        total_datasets = await session.scalar(select(func.count(Dataset.id)))
        total_jobs = await session.scalar(select(func.count(TrainingJob.id)))
    return {
        "users": total_users or 0,
        "plots": total_plots or 0,
        "predictions": total_predictions or 0,
        "datasets": total_datasets or 0,
        "training_jobs": total_jobs or 0,
    }


@router.get("/users")
async def admin_list_users(_: dict = Depends(require_admin)):
    return await _list_users_dict()


class UserUpdatePayload(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class TrainingRequest(BaseModel):
    dataset_ids: list[int]
    model_name: str = "ensemble_v1"


@router.patch("/users/{user_id}")
async def admin_update_user(
    user_id: int,
    payload: UserUpdatePayload,
    _: dict = Depends(require_admin),
):
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if payload.role:
            user.role = payload.role
        if payload.is_active is not None:
            user.is_active = 1 if payload.is_active else 0
        await session.commit()
    return {"status": "updated"}


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    current_admin: dict = Depends(require_admin),
):
    if user_id == current_admin["user_id"]:
        raise HTTPException(status_code=400, detail="Admins cannot delete their own account")

    dataset_paths: list[tuple[str | None, str | None]] = []
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        plot_ids = (
            await session.execute(select(Plot.id).where(Plot.user_id == user_id))
        ).scalars().all()
        if plot_ids:
            await session.execute(delete(Prediction).where(Prediction.plot_id.in_(plot_ids)))
            await session.execute(delete(Plot).where(Plot.id.in_(plot_ids)))

        dataset_result = await session.execute(select(Dataset).where(Dataset.uploaded_by == user_id))
        datasets = dataset_result.scalars().all()
        for dataset in datasets:
            dataset_paths.append((dataset.storage_path, dataset.processed_path))
            await session.delete(dataset)

        await session.execute(delete(TrainingJob).where(TrainingJob.triggered_by == user_id))

        await session.delete(user)
        await session.commit()

    for storage_path, processed_path in dataset_paths:
        if storage_path:
            Path(storage_path).unlink(missing_ok=True)
        if processed_path:
            Path(processed_path).unlink(missing_ok=True)

    return {"status": "deleted"}


@router.get("/plots")
async def admin_list_plots(_: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Plot))
        plots = result.scalars().all()
        return [
            {
                "id": plot.id,
                "name": plot.name,
                "user_id": plot.user_id,
                "created_at": plot.created_at.isoformat() if plot.created_at else None,
            }
            for plot in plots
        ]


@router.delete("/plots/{plot_id}")
async def admin_delete_plot(plot_id: int, _: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        plot = await session.get(Plot, plot_id)
        if not plot:
            raise HTTPException(status_code=404, detail="Plot not found")
        await session.execute(delete(Prediction).where(Prediction.plot_id == plot_id))
        await session.delete(plot)
        await session.commit()
    return {"status": "deleted"}


@router.get("/predictions")
async def admin_list_predictions(_: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Prediction))
        preds = result.scalars().all()
        return [
            {
                "id": pred.id,
                "plot_id": pred.plot_id,
                "model_version": pred.model_version,
                "created_at": pred.created_at.isoformat() if pred.created_at else None,
            }
            for pred in preds
        ]


@router.get("/datasets")
async def admin_list_datasets(_: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Dataset).order_by(Dataset.created_at.desc()))
        datasets = result.scalars().all()
        return [_dataset_to_dict(ds) for ds in datasets]


@router.post("/datasets", status_code=201)
async def admin_upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str | None = Form(None),
    description: str | None = Form(None),
    current_admin: dict = Depends(require_admin),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV datasets are supported.")

    ensure_dataset_dirs()
    storage_name = f"{uuid.uuid4().hex}_{file.filename}"
    destination = (UPLOAD_DIR / storage_name).resolve()
    size = await stream_upload_to_disk(file, destination)

    async with AsyncSessionLocal() as session:
        dataset = Dataset(
            name=name or file.filename,
            description=description,
            original_filename=file.filename,
            storage_path=str(destination),
            status="uploaded",
            filesize_bytes=size,
            uploaded_by=current_admin["user_id"],
        )
        session.add(dataset)
        await session.commit()
        await session.refresh(dataset)

    background_tasks.add_task(preprocess_dataset, dataset.id)
    return _dataset_to_dict(dataset)


@router.post("/datasets/{dataset_id}/reprocess")
async def admin_reprocess_dataset(
    dataset_id: int,
    background_tasks: BackgroundTasks,
    _: dict = Depends(require_admin),
):
    async with AsyncSessionLocal() as session:
        dataset = await session.get(Dataset, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
    background_tasks.add_task(preprocess_dataset, dataset_id)
    return {"status": "reprocessing"}


@router.delete("/datasets/{dataset_id}")
async def admin_delete_dataset(dataset_id: int, _: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        dataset = await session.get(Dataset, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        storage_path = dataset.storage_path
        processed_path = dataset.processed_path
        await session.delete(dataset)
        await session.commit()
    if storage_path:
        Path(storage_path).unlink(missing_ok=True)
    if processed_path:
        Path(processed_path).unlink(missing_ok=True)
    return {"status": "deleted"}


@router.get("/training-jobs")
async def admin_list_training_jobs(_: dict = Depends(require_admin)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(TrainingJob).order_by(TrainingJob.created_at.desc()))
        jobs = result.scalars().all()
        return [_training_job_to_dict(job) for job in jobs]


@router.post("/train", status_code=202)
async def admin_trigger_training(
    payload: TrainingRequest,
    background_tasks: BackgroundTasks,
    current_admin: dict = Depends(require_admin),
):
    dataset_ids = payload.dataset_ids
    if not dataset_ids:
        raise HTTPException(status_code=400, detail="Select at least one dataset.")
    async with AsyncSessionLocal() as session:
        job = TrainingJob(
            model_name=payload.model_name,
            dataset_ids=dataset_ids,
            status="pending",
            triggered_by=current_admin["user_id"],
            log="Waiting to start",
            created_at=datetime.utcnow(),
        )
        session.add(job)
        await session.commit()
        await session.refresh(job)

    background_tasks.add_task(run_training_job, job.id)
    return _training_job_to_dict(job)


@router.post("/training-jobs/{job_id}/cancel", status_code=200)
async def admin_cancel_training_job(
    job_id: int,
    current_admin: dict = Depends(require_admin),
):
    """Cancel a running training job."""
    # First check if job exists and is running
    async with AsyncSessionLocal() as session:
        job = await session.get(TrainingJob, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Training job not found")
        
        # Only allow cancelling if job is pending or running
        if job.status not in ["pending", "running"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel job with status '{job.status}'"
            )
    
    # Attempt to cancel via the training service
    cancelled = await cancel_training_job(job_id)
    if not cancelled:
        raise HTTPException(
            status_code=400,
            detail="Job is not currently running or already cancelled"
        )
    
    return {"status": "cancelled", "message": "Training job cancellation requested"}

