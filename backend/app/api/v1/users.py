from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models import User
from app.utils.security import get_password_hash, check_email_availability
from app.schemas import UserCreate, UserUpdate, UserOut

router = APIRouter()

@router.get("/", response_model=List[UserOut])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@router.post("/")
async def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    # Use the reusable utility to check availability (exclude_user_id=None for new users)
    # Note: create_user previously raised 400, but 409 is also semantic. 
    # To maintain strict compatibility with the previous behavior (400), we can check explicitly or update the frontend to expect 409.
    # The requirement asks for 409 for conflicts. The utility raises 409.
    try:
        check_email_availability(db, user_data.email)
    except HTTPException as e:
        if e.status_code == 409:
            raise HTTPException(status_code=400, detail="Email already registered") # Keep 400 for create as per original, or switch to 409 if preferred. 
            # Actually, let's switch to using the utility fully if the user is open to 409 standard everywhere.
            # But seeing existing code: "HTTPException(status_code=400, detail="Email already registered")"
            # I will just keep the create_user logic as is or adapt it. 
            # The prompt specifically asked about "self-updates" and "update_user".
            # I'll focus on update_user and self-update (PATCH /me).
            pass
            
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role if user_data.role in ['administrator', 'analyst', 'researcher'] else 'analyst',
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"status": "success", "user": new_user}

@router.put("/{user_id}")
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if email is being changed and if it's already taken by another user
    if user_update.email is not None and user_update.email != user.email:
        check_email_availability(db, user_update.email, exclude_user_id=user_id)
        user.email = user_update.email
    
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    
    # Only update password if provided and not empty
    if user_update.password is not None and user_update.password.strip():
        user.password_hash = get_password_hash(user_update.password)
        
    db.commit()
    return {"status": "success", "message": "User updated successfully"}

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"status": "success", "message": "User deleted successfully"}

@router.post("/{user_id}/toggle-status")
def toggle_user_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = not user.is_active
    db.commit()
    return {"status": "success", "is_active": user.is_active}
