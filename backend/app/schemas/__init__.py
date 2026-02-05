from pydantic import BaseModel, EmailStr
from typing import Optional, List
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
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str

class ReportGenerationRequest(BaseModel):
    template: str
    selected_charts: Optional[List[str]] = None
    custom_filename: Optional[str] = None

class ExportRequest(BaseModel):
    table_name: str
    format: str = "csv" # csv, excel, json
    custom_filename: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class TwoFactorAuthVerify(BaseModel):
    code: str

class TableSettingsUpdate(BaseModel):
    is_locked: bool
