import bcrypt
from sqlalchemy.orm import Session
from app.models import User
from fastapi import HTTPException

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a password against a hash using direct bcrypt."""
    # Ensure password is bytes
    if isinstance(plain_password, str):
        password_bytes = plain_password.encode('utf-8')
    else:
        password_bytes = plain_password
        
    # Standardize hash to bytes
    if isinstance(hashed_password, str):
        hash_bytes = hashed_password.encode('utf-8')
    else:
        hash_bytes = hashed_password
        
    try:
        # Bcrypt passwords max out at 72 bytes
        return bcrypt.checkpw(password_bytes[:72], hash_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Generates a salt and hashes a password using direct bcrypt."""
    if isinstance(password, str):
        password_bytes = password.encode('utf-8')
    else:
        password_bytes = password
        
    # Hash the password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes[:72], salt)
    
    return hashed.decode('utf-8')

def check_email_availability(db: Session, email: str, exclude_user_id: int = None):
    """
    Checks if an email is already in use by another user.
    Raises HTTPException(409) if the email is taken.
    """
    query = db.query(User).filter(User.email == email)
    
    if exclude_user_id:
        query = query.filter(User.id != exclude_user_id)
        
    existing_user = query.first()
    
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already in use")
    
    return True
