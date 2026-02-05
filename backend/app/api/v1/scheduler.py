from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.v1.auth import get_current_user
from app.db.session import get_db, SessionLocal
from app.models import User, Notification, ScheduledExport
from pydantic import BaseModel
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
import uuid
import pandas as pd

router = APIRouter()
scheduler = BackgroundScheduler()

class ScheduleRequest(BaseModel):
    scheduled_time: datetime
    details: str

def trigger_notification(user_id: int, details: str):
    """Function called by APScheduler"""
    db = SessionLocal()
    try:
        # Create a notification for the user
        notification = Notification(
            user_id=user_id,
            type="EXPORT_READY",
            message=f"Your scheduled export '{details}' is ready.",
            details={
                "details": details, 
                "filename": f"export_{uuid.uuid4().hex[:8]}.xlsx",
                "table": "National_Trends",
                "generated_at": datetime.utcnow().isoformat()
            }
        )
        db.add(notification)
        
        # update scheduled export status
        # Note: In a real app we'd track the specific ID
        db.commit()
    finally:
        db.close()

@router.get("/")
def get_scheduled_exports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ScheduledExport).filter(
        ScheduledExport.user_id == current_user.id,
        ScheduledExport.status == "PENDING"
    ).all()

@router.post("")
def schedule_export(
    req: ScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Unique job ID
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    
    # Log the scheduled export in DB
    new_schedule = ScheduledExport(
        user_id=current_user.id,
        export_details=req.details, # Aligned with DB change
        scheduled_time=req.scheduled_time,
        job_id=job_id
    )
    db.add(new_schedule)
    db.commit()
    
    # Add to APScheduler
    scheduler.add_job(
        trigger_notification,
        'date',
        run_date=req.scheduled_time,
        args=[current_user.id, req.details],
        id=job_id
    )
    
    return {"status": "success", "message": f"Export scheduled for {req.scheduled_time}"}

@router.put("/{export_id}")
def update_scheduled_export(
    export_id: int,
    req: ScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    export = db.query(ScheduledExport).filter(
        ScheduledExport.id == export_id,
        ScheduledExport.user_id == current_user.id
    ).first()
    
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")
    
    # Update job in scheduler
    try:
        # Reschedule or replace job
        try:
            scheduler.remove_job(export.job_id)
        except:
            pass
            
        scheduler.add_job(
            trigger_notification,
            'date',
            run_date=req.scheduled_time,
            args=[current_user.id, req.details],
            id=export.job_id
        )
    except Exception as e:
        print(f"Error updating job: {e}")
    
    export.scheduled_time = req.scheduled_time
    export.export_details = req.details
    db.commit()
    
    return {"status": "success"}

@router.delete("/{export_id}")
def delete_scheduled_export(
    export_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    export = db.query(ScheduledExport).filter(
        ScheduledExport.id == export_id,
        ScheduledExport.user_id == current_user.id
    ).first()
    
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")
    
    # Remove from scheduler
    try:
        scheduler.remove_job(export.job_id)
    except:
        pass
    
    db.delete(export)
    db.commit()
    return {"status": "success"}

@router.get("/download/{notification_id}")
def download_scheduled_export(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification or notification.type != "EXPORT_READY":
        raise HTTPException(status_code=404, detail="Export not found")
        
    # In a real app we'd fetch the data matching notification.details['table']
    from app.api.v1.data import get_data
    df = get_data()
    
    import io
    from fastapi.responses import StreamingResponse
    buffer = io.BytesIO()
    
    # Use format from filename
    filename = notification.details.get("filename", "export.xlsx")
    if filename.endswith('.csv'):
        df.to_csv(buffer, index=False)
        media_type = "text/csv"
    else:
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Export")
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
