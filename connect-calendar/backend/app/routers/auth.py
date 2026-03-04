from fastapi import APIRouter, Depends
from app.core.security import get_current_user, AuthedUser
from app.schemas import UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

@router.get("/me", response_model=UserOut)
def me(user: AuthedUser = Depends(get_current_user)):
    return {"uid": user.uid, "email": user.email}