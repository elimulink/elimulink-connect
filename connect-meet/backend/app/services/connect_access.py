import json
from typing import Any, Dict

from fastapi import HTTPException
from supabase import Client, create_client

from app.core.config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, USER_PROFILES_TABLE

ALLOWED_ROLES = {"member", "host", "calendar_manager", "admin"}
_supabase_client: Client | None = None


def _get_supabase_client() -> Client:
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase config missing")

    _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_client


def _normalize_app_access(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip().lower() for item in value if str(item).strip()]
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(item).strip().lower() for item in parsed if str(item).strip()]
            except json.JSONDecodeError:
                pass
        return [part.strip().lower() for part in raw.split(",") if part.strip()]
    return []


def _fetch_profile(client: Client, uid: str, email: str) -> Dict[str, Any] | None:
    result = (
        client.table(USER_PROFILES_TABLE)
        .select("uid,email,role,institution_id,app_access,default_app,status")
        .eq("uid", uid)
        .limit(1)
        .execute()
    )
    data = result.data or []
    if data:
        return data[0]

    result = (
        client.table(USER_PROFILES_TABLE)
        .select("uid,email,role,institution_id,app_access,default_app,status")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    data = result.data or []
    return data[0] if data else None


async def resolve_connect_access(uid: str, email: str, app_name: str) -> Dict[str, Any]:
    client = _get_supabase_client()
    profile = _fetch_profile(client, uid=uid, email=email)

    if not profile:
      return {"allowed": False}

    status = str(profile.get("status") or "").strip().lower()
    if status and status != "active":
        return {"allowed": False}

    role = str(profile.get("role") or "").strip().lower()
    if role not in ALLOWED_ROLES:
        return {"allowed": False}

    app_access = _normalize_app_access(profile.get("app_access"))
    if app_name not in app_access:
        return {"allowed": False}

    default_app = str(profile.get("default_app") or "").strip().lower()
    if default_app not in app_access:
        default_app = app_name

    return {
        "allowed": True,
        "uid": str(profile.get("uid") or uid),
        "email": str(profile.get("email") or email),
        "role": role,
        "institution_id": profile.get("institution_id"),
        "app_access": app_access,
        "default_app": default_app,
    }
