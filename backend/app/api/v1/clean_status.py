from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Optional
import threading
import logging

from app.api.v1.auth import get_current_user
from app.models import User, Dataset
from app.db.session import get_db
from app.schemas import CleanStatusResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Global in-memory progress store: dataset_id -> progress dict
_progress_store: Dict[str, dict] = {}
_progress_lock = threading.Lock()

# Global in-memory comparison cache: dataset_id -> comparison payload dict
_comparison_cache: Dict[str, dict] = {}

def set_comparison_data(dataset_id: str, data: dict) -> None:
    """Store the original and cleaned dataframes/previews and report for comparison."""
    with _progress_lock:
        _comparison_cache[dataset_id] = data

def get_comparison_data(dataset_id: str) -> Optional[dict]:
    """Retrieve comparison data for a dataset."""
    with _progress_lock:
        return _comparison_cache.get(dataset_id)


def init_progress(dataset_id: str) -> None:
    """Initialize progress tracking for a dataset."""
    with _progress_lock:
        _progress_store[dataset_id] = {
            "stage": "pending",
            "progress_percent": 0.0,
            "eta_seconds": 60,
            "message": "Initializing cleaning pipeline..."
        }

def update_progress(dataset_id: str, stage: str, progress_percent: float, eta_seconds: int, message: Optional[str] = None) -> None:
    """Update progress tracking for a dataset."""
    with _progress_lock:
        if dataset_id not in _progress_store:
            _progress_store[dataset_id] = {}
        _progress_store[dataset_id]["stage"] = stage
        _progress_store[dataset_id]["progress_percent"] = progress_percent
        _progress_store[dataset_id]["eta_seconds"] = eta_seconds
        if message is not None:
            _progress_store[dataset_id]["message"] = message

def get_progress(dataset_id: str) -> Optional[dict]:
    """Retrieve current progress tracking for a dataset."""
    with _progress_lock:
        return _progress_store.get(dataset_id)

@router.get(
    "/clean-status/{dataset_id}",
    response_model=CleanStatusResponse,
    summary="Get real-time cleaning progress status",
    description="Returns the current stage, progress percentage, ETA in seconds, and status message for an asynchronous cleaning task."
)
async def get_clean_status(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns real-time telemetry for the cleaning pipeline.
    Checks the in-memory progress store first. If not found, checks the database Dataset status.
    """
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Analyst role or higher required."
        )

    # 1. Check Cache First (Truth-First)
    progress = get_progress(dataset_id)
    if progress:
        if progress.get("stage") == "cleaned" or progress.get("status") == "cleaned":
            progress["stage"] = "cleaned"
            progress["status"] = "cleaned"
            progress["progress_percent"] = 100.0
            progress["eta_seconds"] = 0
            progress["message"] = "Data successfully processed!"
        return CleanStatusResponse(**progress)

    # 2. Cache Missed, check Database
    import uuid
    try:
        ds_uuid = uuid.UUID(dataset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid dataset ID format")

    dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    status = dataset.status.lower() if dataset.status else "pending"
    if status == "cleaned":
        return CleanStatusResponse(
            stage="cleaned",
            status="cleaned",
            progress_percent=100.0,
            eta_seconds=0,
            message="Data successfully processed!"
        )
    elif status == "failed" or status == "error":
        return CleanStatusResponse(
            stage="failed",
            status="failed",
            progress_percent=0.0,
            eta_seconds=0,
            message="Cleaning task failed."
        )
    elif status == "cleaning_in_progress":
        return CleanStatusResponse(
            stage="cleaning_in_progress",
            status="cleaning_in_progress",
            progress_percent=50.0,
            eta_seconds=30,
            message="Cleaning is currently in progress."
        )
    else:
        return CleanStatusResponse(
            stage="pending",
            status="pending",
            progress_percent=0.0,
            eta_seconds=60,
            message="Dataset is pending cleaning."
        )
