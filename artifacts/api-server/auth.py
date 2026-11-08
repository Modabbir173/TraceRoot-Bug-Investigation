
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
import jwt

from database import get_db
from db_models import User
from schemas import UserRegister, UserLogin, UserResponse, TokenResponse
from security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
from schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    UserProfileUpdate,
    PasswordChange,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token",
            )

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token",
        )

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    payload: UserRegister,
    db: Session = Depends(get_db),
):
    email = str(payload.email).lower()

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        hashed_password=hash_password(payload.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=TokenResponse)
def login_user(
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    email = str(payload.email).lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if user is None or not verify_password(
        payload.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )

    token = create_access_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user

@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No profile information provided",
        )

    if "full_name" in changes and changes["full_name"] is not None:
        current_user.full_name = changes["full_name"].strip()

    if "email" in changes and changes["email"] is not None:
        new_email = str(changes["email"]).lower()

        existing_user = db.scalar(
            select(User).where(
                User.email == new_email,
                User.id != current_user.id,
            )
        )

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="This email is already in use",
            )

        current_user.email = new_email

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(
        payload.current_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password",
        )

    current_user.hashed_password = hash_password(payload.new_password)

    db.commit()

    return {"message": "Password changed successfully"}