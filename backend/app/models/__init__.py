from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.db.session import Base
from datetime import datetime

# Re-export models from submodules
from app.models.geospatial import GeospatialRegion
from app.models.support import SupportTicket
from sqlalchemy.dialects.postgresql import UUID, BYTEA
import uuid


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
    is_online = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    support_tickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    schedules = relationship("ScheduledExport", back_populates="user", cascade="all, delete-orphan")
    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("GeneratedReport", back_populates="user", cascade="all, delete-orphan")
    export_tasks = relationship("ExportTask", back_populates="user", cascade="all, delete-orphan")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    action = Column(String(255), nullable=False)
    ip_address = Column(String(45), nullable=True)
    # Using JSONB matches your DB and is much more powerful for searching
    details = Column(JSONB, nullable=True) 
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User")

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
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    is_cleaned = Column(Boolean, default=False)
    validated_at = Column(DateTime(timezone=True), nullable=True)

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
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    type = Column(String(50), nullable=False) # e.g., 'EXPORT_READY'
    message = Column(String(500), nullable=False)
    details = Column(JSONB, nullable=True) # e.g., { "filename": "data.csv", "details": "GDP 2029" }
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class ScheduledExport(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    export_details = Column(String(500), nullable=True) # Renamed from details
    scheduled_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, TRIGGERED, COMPLETED
    is_active = Column(Boolean, default=True)      # Added per requirement
    job_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="schedules")

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_filename = Column(String(255), nullable=False)
    raw_content = Column(BYTEA, nullable=True)
    status = Column(String(50), default="pending")  # pending, cleaning_in_progress, cleaned, failed
    file_metadata = Column(JSONB, nullable=True)
    category = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Quality Metrics
    row_count = Column(Integer, default=0)
    col_count = Column(Integer, default=0)
    null_count = Column(Integer, default=0)
    dupe_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="datasets")

class UserActivity(Base):
    __tablename__ = "user_activity"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    session_duration = Column(Numeric, default=0) # Total minutes
    upload_count = Column(Integer, default=0)
    clean_count = Column(Integer, default=0)
    report_count = Column(Integer, default=0)
    last_active = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="activities")


class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    file_name = Column(String(255), nullable=False)
    file_content = Column(BYTEA, nullable=False)
    mime_type = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="reports")


class CleanedData(Base):
    __tablename__ = "cleaned_data"
    id = Column(Integer, primary_key=True, index=True)
    indicator_name = Column(String, nullable=False)
    value = Column(Numeric, nullable=False)
    year = Column(Integer, nullable=False)
    region = Column(String)
    gender = Column(String)
    age_group = Column(String)
    source_file = Column(String)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class ExportTask(Base):
    __tablename__ = "export_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    task_name = Column(String(255), nullable=False)
    status = Column(String(50), default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED
    format = Column(String(50), nullable=False)  # CSV, XLSX, JSON
    dataset_id = Column(String(255), nullable=True)
    custom_filename = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)
    target_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="export_tasks")

