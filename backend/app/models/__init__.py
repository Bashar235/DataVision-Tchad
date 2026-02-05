from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.db.session import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String(50), nullable=False) # 'administrator', 'analyst', 'researcher'
    otp_secret = Column(String(32), nullable=True)
    is_active = Column(Boolean, default=True)
    is_2fa_enabled = Column(Boolean, default=False)
    totp_secret = Column(String(32), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    support_tickets = relationship("SupportTicket", back_populates="user")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    action = Column(String(255), nullable=False)
    ip_address = Column(String(45), nullable=True)
    # Using JSONB matches your DB and is much more powerful for searching
    details = Column(JSONB, nullable=True) 
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class IndicatorData(Base):
    __tablename__ = "indicators_data"
    id = Column(Integer, primary_key=True, index=True)
    indicator_name = Column(String, nullable=False)
    value = Column(Numeric, nullable=False)
    year = Column(Integer, nullable=False)
    region = Column(String)
    gender = Column(String)
    age_group = Column(String)
    source_file = Column(String)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class DataDictionary(Base):
    __tablename__ = "data_dictionary"
    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String, nullable=False)
    column_name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    data_type = Column(String, nullable=False)

class TableSettings(Base):
    __tablename__ = "table_settings"
    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String, unique=True, nullable=False)
    is_locked = Column(Boolean, default=False)
    last_modified = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    type = Column(String(50), nullable=False) # e.g., 'EXPORT_READY'
    message = Column(String(500), nullable=False)
    details = Column(JSONB, nullable=True) # e.g., { "filename": "data.csv", "details": "GDP 2029" }
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class ScheduledExport(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    export_details = Column(String(500), nullable=True) # Renamed from details
    scheduled_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, TRIGGERED, COMPLETED
    is_active = Column(Boolean, default=True)      # Added per requirement
    job_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, CLEANED, ERROR
    category = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Quality Metrics
    row_count = Column(Integer, default=0)
    col_count = Column(Integer, default=0)
    null_count = Column(Integer, default=0)
    dupe_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User")
