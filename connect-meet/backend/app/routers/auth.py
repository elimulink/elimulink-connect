from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.core.config import (
    MEET_ICE_SERVER_CREDENTIAL,
    MEET_ICE_SERVER_URLS,
    MEET_ICE_SERVER_USERNAME,
)
from app.services.meet_access import authorize_meet_principal

router = APIRouter(prefix="/api/auth", tags=["auth"])


class VerifyAccessRequest(BaseModel):
    app: str


@router.post("/verify-app-access")
async def verify_app_access(
    payload: VerifyAccessRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.replace("Bearer ", "").strip()
    app_name = (payload.app or "").strip().lower()
    if app_name not in {"meet", "calendar"}:
        return {"allowed": False}

    principal = await authorize_meet_principal(token=token, app_name=app_name)
    return {
        "allowed": True,
        "uid": principal.uid,
        "email": principal.email,
        "role": principal.role,
        "institution_id": principal.institution_id,
        "app_access": principal.app_access or [app_name],
        "default_app": principal.default_app or app_name,
    }


@router.get("/rtc-config")
async def get_rtc_config(
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.replace("Bearer ", "").strip()
    await authorize_meet_principal(token=token, app_name="meet")

    ice_server = {"urls": MEET_ICE_SERVER_URLS}
    if MEET_ICE_SERVER_USERNAME:
        ice_server["username"] = MEET_ICE_SERVER_USERNAME
    if MEET_ICE_SERVER_CREDENTIAL:
        ice_server["credential"] = MEET_ICE_SERVER_CREDENTIAL

    return {
        "mode": "p2p-mesh",
        "ice_servers": [ice_server],
        "relay_configured": bool(MEET_ICE_SERVER_USERNAME and MEET_ICE_SERVER_CREDENTIAL),
    }
