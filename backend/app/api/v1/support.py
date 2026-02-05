from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.models.support import SupportTicket
from app.models import User
from app.api.v1.auth import get_current_user
from app.services.email_service import send_support_email, send_resolution_email

router = APIRouter()

class SupportRequest(BaseModel):
    subject: str
    message: str
    is_urgent: bool = False
    
class SupportResponse(BaseModel):
    id: int
    subject: str
    message: str
    status: str
    user_name_snapshot: str
    user_email_snapshot: str
    user_role_snapshot: str
    created_at: datetime
    
    class Config:
        orm_mode = True

@router.post("/", response_model=SupportResponse)
def create_support_ticket(
    request: SupportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Snapshot user details
    ticket = SupportTicket(
        user_id=current_user.id,
        user_email_snapshot=current_user.email,
        user_role_snapshot=current_user.role,
        user_name_snapshot=current_user.full_name,
        subject=request.subject,
        message=request.message,
        is_urgent=request.is_urgent
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    
    # Send Email
    send_support_email(
        user_email=current_user.email,
        subject=request.subject,
        message=request.message,
        user_name=current_user.full_name,
        user_role=current_user.role,
        is_urgent=request.is_urgent
    )
    
    return ticket

@router.get("/urgent", response_model=List[SupportResponse])
def get_urgent_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["administrator", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return db.query(SupportTicket).filter(
        SupportTicket.is_urgent == True,
        SupportTicket.status == "open"
    ).all()

@router.patch("/{ticket_id}/resolve")
def resolve_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["administrator", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.status = "resolved"
    ticket.resolved_at = datetime.utcnow()
    db.commit()
    
    # Send Resolution Email
    formatted_date = ticket.resolved_at.strftime("%Y-%m-%d %H:%M UTC")
    send_resolution_email(
        user_email=ticket.user_email_snapshot,
        user_name=ticket.user_name_snapshot,
        subject=ticket.subject,
        resolved_at=formatted_date
    )
    
    return {"status": "resolved"}

@router.delete("/{ticket_id}")
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["administrator", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    db.delete(ticket)
    db.commit()
    
    return {"status": "deleted"}
