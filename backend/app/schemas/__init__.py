from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Union
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "analyst"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    password: Optional[str] = None  # If provided, will update password hash
    is_active: Optional[bool] = None

class ProfileUpdate(BaseModel):
    """Schema for self-editing profile (name and email only)"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None

class UserOut(UserBase):
    id: int
    is_active: bool
    is_2fa_enabled: bool = False
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str

class ReportRequest(BaseModel):
    type: str # Unified field for report identification
    template: Optional[str] = None
    selected_charts: Optional[List[str]] = None
    custom_filename: Optional[str] = None
    report_title: Optional[str] = None
    analyst_id: Optional[int] = None
    audit_type: Optional[str] = None
    date_range: Optional[str] = None
    user_role: Optional[str] = None
    schedule: Optional[str] = None
    # New Builder Fields
    sections: Optional[List[str]] = None
    region: Optional[str] = "National"
    regions: Optional[List[str]] = None # Support for multi-region reports
    dataset_id: Optional[str] = None
    format: Optional[str] = "pdf" # pdf or excel
    include_watermark: Optional[bool] = False
    language: Optional[str] = "fr" # en, fr, or ar

class ExportRequest(BaseModel):
    table_name: str
    format: str = "csv" # csv, excel, json
    custom_filename: Optional[str] = None
    region: Optional[str] = None
    regions: Optional[List[str]] = None # Multi-region export
    start_year: Optional[Union[int, str]] = None
    end_year: Optional[Union[int, str]] = None
    year_start: Optional[Any] = None
    year_end: Optional[Any] = None
    selected_years: Optional[Any] = None
    all_years: Optional[bool] = None
    dataset_id: Optional[str] = None
    columns: Optional[List[str]] = None
    indicator: Optional[str] = None # Added for compatibility with existing frontend params

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class TwoFactorAuthVerify(BaseModel):
    code: str

class TableSettingsUpdate(BaseModel):
    is_locked: bool

class CleanStatusResponse(BaseModel):
    stage: str
    status: Optional[str] = None
    progress_percent: float
    eta_seconds: int
    message: Optional[str] = None

