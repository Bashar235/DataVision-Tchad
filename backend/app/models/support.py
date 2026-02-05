from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.session import Base

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Snapshot fields for audit integrity
    user_email_snapshot = Column(String)
    user_role_snapshot = Column(String)
    user_name_snapshot = Column(String)
    
    subject = Column(String)
    message = Column(Text)
    is_urgent = Column(Boolean, default=False)
    status = Column(String, default="open") # open, resolved
    
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="support_tickets")
