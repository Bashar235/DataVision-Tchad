from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from app.services.email_service import send_support_email

router = APIRouter()


class ContactSupportRequest(BaseModel):
    user_email: EmailStr
    subject: str
    message: str


@router.post("/contact-support")
async def contact_support(request: ContactSupportRequest):
    """
    Send a support request email to the DataVision Tchad support team.
    
    Args:
        request: ContactSupportRequest containing user_email, subject, and message
        
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: If email sending fails
    """
    # Validate input
    if not request.subject.strip():
        raise HTTPException(status_code=400, detail="Subject cannot be empty")
    
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Send email
    success = send_support_email(
        user_email=request.user_email,
        subject=request.subject,
        message=request.message
    )
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to send support request. Please try again later."
        )
    
    return {"message": "Support request sent successfully"}
