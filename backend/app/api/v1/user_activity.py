from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.models import User, UserActivity, AuditLog, IndicatorData, GeneratedReport
from typing import List, Optional
from pydantic import BaseModel
import json

router = APIRouter()

class EventPayload(BaseModel):
    activity_type: str # 'upload', 'clean', 'report'
    details: Optional[dict] = None

@router.get("/stats")
async def get_activity_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    activity = db.query(UserActivity).filter(UserActivity.user_id == current_user.id).first()
    
    if not activity:
        # Create initial record if it doesn't exist
        activity = UserActivity(user_id=current_user.id)
        db.add(activity)
        db.commit()
        db.refresh(activity)
    
    # Calculate dynamic library count (only user's cleaned datasets)
    from app.models import Dataset
    library_count = db.query(func.count(Dataset.id))\
        .filter(Dataset.user_id == current_user.id, Dataset.status == "Cleaned").scalar() or 0
    
    # Calculate dynamic report count from BYTEA table
    report_count = db.query(func.count(GeneratedReport.id)).filter(GeneratedReport.user_id == current_user.id).scalar() or 0
    
    # Calculate export count from AuditLog
    export_count = db.query(func.count(AuditLog.id)).filter(
        AuditLog.user_id == current_user.id,
        AuditLog.action == "EXPORT_DATA"
    ).scalar() or 0
    
    return {
        "session_duration": float(activity.session_duration or 0),
        "upload_count": library_count, 
        "clean_count": activity.clean_count,
        "report_count": report_count,
        "export_count": export_count,
        "last_active": activity.last_active.isoformat() if activity.last_active else None
    }

@router.post("/event")
async def record_activity_event(
    payload: EventPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/v1/activity/event
    Increments activity counters and logs to AuditLog.
    """
    increment_activity(
        db, 
        current_user.id, 
        payload.activity_type, 
        details={
            "action": payload.details.get("action") if payload.details else f"{payload.activity_type.upper()}_EVENT",
            "details": payload.details or {}
        }
    )
    return {"status": "success", "message": f"Activity {payload.activity_type} recorded."}

@router.get("/timeline")
async def get_activity_timeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logs = db.query(AuditLog).filter(
        AuditLog.user_id == current_user.id
    ).order_by(AuditLog.created_at.desc()).limit(20).all()
    
    timeline = []
    for log in logs:
        details = {}
        try:
            if isinstance(log.details, str):
                details = json.loads(log.details)
            else:
                details = log.details or {}
        except:
            pass
            
        message = ""
        if log.action == "UPLOAD_DATA":
            message = f"Uploaded dataset: {details.get('filename', 'Unknown')}"
        elif log.action == "CLEAN_DATA":
            score = details.get('health_score', 'N/A')
            filename = details.get('filename', 'Unknown')
            message = f"Successfully cleaned {filename} (Score: {score}%)"
        elif log.action == "EXPORT_DATA":
            filename = details.get('filename', 'Unknown')
            message = f"Exported {filename}"
        elif log.action == "GENERATE_REPORT":
            filename = details.get('filename', 'Unknown')
            message = f"Generated report: {filename}"
        else:
            message = f"Action: {log.action}"
            
        timeline.append({
            "id": log.id,
            "message": message,
            "timestamp": log.created_at.isoformat(),
            "action": log.action
        })
        
    return timeline

# Helper function to increment activity counts
def increment_activity(db: Session, user_id: int, activity_type: str, amount: int = 1, details: dict = None):
    activity = db.query(UserActivity).filter(UserActivity.user_id == user_id).first()
    if not activity:
        activity = UserActivity(user_id=user_id)
        db.add(activity)
    
    if activity_type == "upload":
        activity.upload_count = (activity.upload_count or 0) + amount
    elif activity_type == "clean":
        activity.clean_count = (activity.clean_count or 0) + amount
    elif activity_type == "report":
        activity.report_count = (activity.report_count or 0) + amount
        
    # Log the action in AuditLog as well if details provided
    if details:
        audit = AuditLog(
            user_id=user_id,
            action=details.get("action", "SYSTEM_ACTION"),
            details=details.get("details", {})
        )
        db.add(audit)
        
    db.commit()

