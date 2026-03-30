from dataclasses import dataclass
from typing import Any, Mapping, Optional

from fastapi import HTTPException

from app.core.config import MEET_ALLOW_LOCAL_DEV_BYPASS
from app.core.security import verify_firebase_id_token
from app.services.connect_access import resolve_connect_access


@dataclass
class MeetAccessPrincipal:
    uid: str
    email: str
    display_name: str
    role: str
    institution_id: Any = None
    app_access: list[str] | None = None
    default_app: str | None = None
    source: str = "firebase"
    local_dev: bool = False


def request_looks_local(headers: Mapping[str, str]) -> bool:
    origin = str(headers.get("origin") or "").lower()
    host = str(headers.get("host") or "").lower()
    return any(local_host in origin or local_host in host for local_host in ("localhost", "127.0.0.1"))


async def authorize_meet_principal(
    *,
    token: Optional[str] = None,
    app_name: str = "meet",
    allow_local_dev_bypass: bool = False,
    local_headers: Optional[Mapping[str, str]] = None,
) -> MeetAccessPrincipal:
    if token:
        user = verify_firebase_id_token(token)
        if not user.uid or not user.email:
            raise HTTPException(status_code=401, detail="Invalid Firebase token")

        access = await resolve_connect_access(uid=user.uid, email=user.email, app_name=app_name)
        if not access.get("allowed"):
            raise HTTPException(status_code=403, detail="Meet access denied")

        return MeetAccessPrincipal(
            uid=str(access.get("uid") or user.uid),
            email=str(access.get("email") or user.email),
            display_name=user.display_name or user.email or user.uid,
            role=str(access.get("role") or "member"),
            institution_id=access.get("institution_id"),
            app_access=list(access.get("app_access") or []),
            default_app=access.get("default_app"),
            source="firebase",
            local_dev=False,
        )

    if (
        allow_local_dev_bypass
        and MEET_ALLOW_LOCAL_DEV_BYPASS
        and local_headers is not None
        and request_looks_local(local_headers)
    ):
        return MeetAccessPrincipal(
            uid="meet-local-dev",
            email="local-dev@elimulink.local",
            display_name="Local Developer",
            role="developer",
            institution_id=None,
            app_access=["meet"],
            default_app="meet",
            source="local-dev",
            local_dev=True,
        )

    raise HTTPException(status_code=401, detail="Missing valid Meet authentication")
