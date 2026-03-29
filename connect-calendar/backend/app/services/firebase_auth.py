from fastapi import HTTPException

from app.core.security import AuthedUser, get_current_user


def build_verified_firebase_identity(user: AuthedUser) -> dict:
    if not user.uid or not user.email:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    return {
        "uid": user.uid,
        "email": user.email,
        "name": user.email,
    }
