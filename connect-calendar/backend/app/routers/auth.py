from typing import Any, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import AuthedUser, get_current_user
from app.schemas import UserOut
from app.services.connect_access import resolve_connect_access
from app.services.firebase_auth import build_verified_firebase_identity

router = APIRouter(prefix="/api/auth", tags=["auth"])


class VerifyAccessRequest(BaseModel):
    app: str


@router.get("/me", response_model=UserOut)
def me(user: AuthedUser = Depends(get_current_user)):
    return {"uid": user.uid, "email": user.email}


@router.post("/verify-app-access")
async def verify_app_access(
    payload: VerifyAccessRequest,
    user: AuthedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    decoded = build_verified_firebase_identity(user)

    email = decoded.get("email")
    uid = decoded.get("uid")
    app_name = (payload.app or "").strip().lower()

    if app_name in {"meet", "calendar"}:
        return await resolve_connect_access(uid=uid, email=email, app_name=app_name)

    return {"allowed": False}
