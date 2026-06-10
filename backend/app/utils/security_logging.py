"""
Security Logging Utility

Provides functions for logging security-related events to the audit log.
"""
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session


def log_security_event(
    db: Session,
    user_id: int,
    action: str,
    resource: str = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    status: str = "success"
) -> None:
    """
    Log a security-related event to the audit log.
    
    Args:
        db: Database session
        user_id: ID of the user performing the action
        action: Type of action (e.g., "EXPORT", "LOGIN", "DATA_ACCESS")
        resource: Resource being accessed (stored in details)
        details: Additional details as a dictionary
        ip_address: IP address of the request
        status: Status of the action (stored in details)
    """
    from app.models import AuditLog
    
    try:
        # Build details dict including resource and status
        log_details = details.copy() if details else {}
        if resource:
            log_details["resource"] = resource
        if status:
            log_details["status"] = status
        
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            details=log_details,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        # Don't let logging failures break the main operation
        print(f"Warning: Failed to log security event: {e}")
        db.rollback()
