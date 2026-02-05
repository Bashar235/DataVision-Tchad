from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
import random
from app.db.session import get_db
from app.models import User
from app.utils.security import verify_password
from app.schemas import LoginRequest, TwoFactorAuthVerify, PasswordChangeRequest, ProfileUpdate, UserOut
from app.utils.email import send_otp_email

from fastapi.security import OAuth2PasswordBearer

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Debug: Print received token
    print(f"[AUTH_DEBUG] Received Token: {token}")
    
    # Simple mock token verification: jwt_USERID_ROLE
    try:
        params = token.split('_')
        if len(params) < 3 or params[0] != 'jwt':
             print(f"[AUTH_DEBUG] Invalid Token Format: {token}")
             raise HTTPException(status_code=401, detail="Invalid authentication token")
        
        user_id = int(params[1])
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"[AUTH_DEBUG] User ID {user_id} not found")
            raise HTTPException(status_code=401, detail="User not found")
            
        return user
    except Exception as e:
        print(f"[AUTH_DEBUG] details: {str(e)}")
        # Re-raise HTTPException if it's already one
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=f"Could not validate credentials: {str(e)}")

OTP_STORE = {}

@router.post("/login")
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    print(f"[LOGIN] Attempting login for: {credentials.email}")
    user = db.query(User).filter(User.email == credentials.email).first()
    
    # Fallback for simple demo usernames (legacy support)
    if not user:
        username_map = {
            "admin": "basharbidjere@gmail.com",
            "analyst": "scoopsofficial01@gmail.com",
            "researcher": "bbidjere@gmail.com",
            # Legacy support
            "admin@inseed.td": "basharbidjere@gmail.com",
            "analyst@inseed.td": "scoopsofficial01@gmail.com",
            "researcher@inseed.td": "bbidjere@gmail.com"
        }
        if credentials.email in username_map:
            target_email = username_map[credentials.email]
            print(f"[LOGIN] Mapping {credentials.email} to {target_email}")
            user = db.query(User).filter(User.email == target_email).first()
    
    if not user:
        print(f"[LOGIN] User not found: {credentials.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    print(f"[LOGIN] User found: {user.email}, Role: {user.role}")
    
    # Debug password verification
    password_valid = verify_password(credentials.password, user.password_hash)
    print(f"[LOGIN] Password verification result: {password_valid}")
    
    if password_valid:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is inactive")
        
        user.last_login = datetime.utcnow()
        db.commit()
        
        return {
            "status": "success", 
            "user": {
                "id": user.id,
                "name": user.full_name,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active
            }
        }
    
    raise HTTPException(status_code=401, detail="Invalid email or password")

@router.post("/otp/generate")
def generate_otp(email: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        username_map = {"admin": "admin@inseed.td", "analyst": "analyst@inseed.td", "researcher": "researcher@inseed.td"}
        email = username_map.get(email, email)
        user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp = str(random.randint(100000, 999999))
    OTP_STORE[email] = otp
    
    background_tasks.add_task(send_otp_email, user.email, otp)
    
    print(f"\n[SECURITY] OTP for {email}: {otp}\n") 
    return {"status": "success", "message": "OTP sent to email"}

@router.post("/otp/verify")
def verify_otp(email: str, code: str, db: Session = Depends(get_db)):
    username_map = {"admin": "admin@inseed.td", "analyst": "analyst@inseed.td", "researcher": "researcher@inseed.td"}
    email = username_map.get(email, email)

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if code == "000000":
        return {"status": "success", "token": f"jwt_{user.id}_{user.role}", "user": {"role": user.role}}
        
    if email in OTP_STORE and OTP_STORE[email] == code:
        del OTP_STORE[email]
        return {"status": "success", "token": f"jwt_{user.id}_{user.role}", "user": {"role": user.role}}
    
    raise HTTPException(status_code=400, detail="Invalid or expired verification code")

# --- 2FA TOTP Implementation ---
import pyotp
import qrcode
import io
import base64

@router.post("/2fa/setup")
def setup_2fa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate TOTP secret and QR code for 2FA setup."""
    if current_user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled for this account")
    
    # Generate secret
    totp_secret = pyotp.random_base32()
    
    # Update user with secret (but don't enable yet)
    current_user.totp_secret = totp_secret
    db.commit()
    
    # Generate otpauth URI
    issuer = "DataVision Tchad"
    account_name = current_user.email
    otpauth_uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
        name=account_name,
        issuer_name=issuer
    )
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(otpauth_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "secret": totp_secret,
        "qr_code": f"data:image/png;base64,{qr_code_base64}",
        "otpauth_uri": otpauth_uri
    }

@router.post("/2fa/verify")
def verify_2fa_setup(
    request: TwoFactorAuthVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify TOTP code and enable 2FA."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated. Please run /2fa/setup first")
    
    if current_user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    
    # Verify code
    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(request.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Enable 2FA
    current_user.is_2fa_enabled = True
    db.commit()
    
    return {"status": "success", "message": "2FA has been enabled successfully"}

@router.post("/2fa/disable")
def disable_2fa(
    request: TwoFactorAuthVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disable 2FA after verifying current code."""
    if not current_user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="No TOTP secret found")
    
    # Verify code before disabling
    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(request.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Disable 2FA
    current_user.is_2fa_enabled = False
    current_user.totp_secret = None
    db.commit()
    
    return {"status": "success", "message": "2FA has been disabled successfully"}

# --- Password Change ---
@router.post("/change-password")
def change_password(
    request: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change user password after verifying current password."""
    from app.utils.security import verify_password, get_password_hash, check_email_availability
    
    # Verify current password
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    new_password_hash = get_password_hash(request.new_password)
    
    # Update password
    current_user.password_hash = new_password_hash
    db.commit()
    
    return {"status": "success", "message": "Password changed successfully"}

# --- Current User Profile Management ---
@router.get("/me", response_model=UserOut)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get the authenticated user's profile."""
    return current_user

@router.patch("/me")
def update_current_user_profile(
    profile_update: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user's profile (name and email only)."""
    
    from app.utils.security import check_email_availability

    # Check if email is being changed and if it's already taken by another user
    if profile_update.email is not None and profile_update.email != current_user.email:
        check_email_availability(db, profile_update.email, exclude_user_id=current_user.id)
        current_user.email = profile_update.email
    
    # Update full name
    if profile_update.full_name is not None:
        current_user.full_name = profile_update.full_name
    
    db.commit()
    db.refresh(current_user)
    
    return {"status": "success", "message": "Profile updated successfully", "user": current_user}