import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.security import verify_firebase_id_token

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])

STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "scheduler_store.json"
STORE_LOCK = Lock()


class MeetingRecordPayload(BaseModel):
    id: Optional[str] = None
    roomId: str = ""
    title: str = ""
    startAt: str = ""
    duration: int = 30
    allDay: bool = False
    timezone: str = ""
    attendees: List[str] = Field(default_factory=list)
    location: str = ""
    description: str = ""
    repeat: str = "Does not repeat"
    bypassLobby: str = "Only invited people"
    presenterPolicy: str = "Host only"
    sourceType: str = "scheduled"
    status: str = "scheduled"
    joinLink: str = ""


class PersonalRoomPayload(BaseModel):
    roomId: str = ""
    title: str = ""
    hostPin: str = ""
    joinLink: str = ""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_local_dev_request(request: Request) -> bool:
    origin = (request.headers.get("origin") or "").lower()
    host = (request.headers.get("host") or "").lower()
    return any(local_host in origin or local_host in host for local_host in ("localhost", "127.0.0.1"))


def _authorize_request(
    request: Request,
    authorization: Optional[str],
    local_dev_bypass: Optional[str],
) -> Dict[str, str]:
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        user = verify_firebase_id_token(token)
        return {
            "uid": user.uid,
            "email": user.email or "",
            "display_name": user.display_name or user.email or user.uid,
        }

    if local_dev_bypass == "true" and _is_local_dev_request(request):
        return {
            "uid": "meet-local-dev",
            "email": "local-dev@elimulink.local",
            "display_name": "Local Developer",
        }

    raise HTTPException(status_code=401, detail="Missing valid Meet auth for scheduler access")


def _default_personal_room(display_name: str) -> Dict[str, Any]:
    safe_display = (display_name or "My Meeting Room").strip()
    return {
        "roomId": f"personal-{secrets.token_hex(4)}",
        "title": f"{safe_display}'s room" if safe_display != "My Meeting Room" else safe_display,
        "hostPin": f"{secrets.randbelow(9000) + 1000}",
        "sourceType": "personal-room",
        "status": "ready",
        "lastUpdated": _now_iso(),
    }


def _load_store() -> Dict[str, Any]:
    if not STORE_PATH.exists():
        return {"users": {}}
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"users": {}}


def _save_store(store: Dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def _get_user_bucket(store: Dict[str, Any], uid: str) -> Dict[str, Any]:
    users = store.setdefault("users", {})
    bucket = users.setdefault(uid, {})
    bucket.setdefault("meetings", [])
    bucket.setdefault("personal_room", None)
    return bucket


def _sort_meetings(meetings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        meetings,
        key=lambda item: (
            str(item.get("startAt") or "9999-12-31T23:59"),
            str(item.get("createdAt") or ""),
        ),
    )


def _normalize_meeting(payload: MeetingRecordPayload, created_by: str) -> Dict[str, Any]:
    created_at = _now_iso()
    return {
        "id": payload.id or f"meeting-{secrets.token_hex(6)}",
        "roomId": (payload.roomId or "").strip(),
        "title": (payload.title or "Scheduled meeting").strip() or "Scheduled meeting",
        "startAt": payload.startAt or "",
        "duration": int(payload.duration or 30),
        "allDay": bool(payload.allDay),
        "timezone": (payload.timezone or "UTC").strip() or "UTC",
        "attendees": [item.strip() for item in payload.attendees if item and item.strip()],
        "location": (payload.location or "").strip(),
        "description": (payload.description or "").strip(),
        "repeat": (payload.repeat or "Does not repeat").strip() or "Does not repeat",
        "bypassLobby": (payload.bypassLobby or "Only invited people").strip() or "Only invited people",
        "presenterPolicy": (payload.presenterPolicy or "Host only").strip() or "Host only",
        "createdBy": created_by,
        "createdAt": created_at,
        "sourceType": (payload.sourceType or "scheduled").strip() or "scheduled",
        "status": (payload.status or "scheduled").strip() or "scheduled",
        "joinLink": (payload.joinLink or "").strip(),
        "lastUpdated": created_at,
    }


@router.get("/meetings")
async def list_meetings(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_meet_local_dev_bypass: Optional[str] = Header(default=None),
):
    user = _authorize_request(request, authorization, x_meet_local_dev_bypass)
    with STORE_LOCK:
        bucket = _get_user_bucket(_load_store(), user["uid"])
        return {"meetings": _sort_meetings(bucket.get("meetings", []))}


@router.post("/meetings")
async def save_meeting(
    payload: MeetingRecordPayload,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_meet_local_dev_bypass: Optional[str] = Header(default=None),
):
    user = _authorize_request(request, authorization, x_meet_local_dev_bypass)

    if not (payload.roomId or "").strip():
        raise HTTPException(status_code=400, detail="Missing room id")

    with STORE_LOCK:
        store = _load_store()
        bucket = _get_user_bucket(store, user["uid"])
        meetings = bucket.get("meetings", [])
        current = next((item for item in meetings if item.get("id") == payload.id), None)
        next_record = _normalize_meeting(payload, user["display_name"])

        if current:
            next_record["createdAt"] = current.get("createdAt") or next_record["createdAt"]

        meetings = [item for item in meetings if item.get("id") != next_record["id"]]
        meetings.append(next_record)
        bucket["meetings"] = _sort_meetings(meetings)
        _save_store(store)

    return {"meeting": next_record}


@router.delete("/meetings/{meeting_id}")
async def remove_meeting(
    meeting_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_meet_local_dev_bypass: Optional[str] = Header(default=None),
):
    user = _authorize_request(request, authorization, x_meet_local_dev_bypass)
    with STORE_LOCK:
        store = _load_store()
        bucket = _get_user_bucket(store, user["uid"])
        bucket["meetings"] = [item for item in bucket.get("meetings", []) if item.get("id") != meeting_id]
        _save_store(store)
    return {"ok": True}


@router.get("/personal-room")
async def get_personal_room(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_meet_local_dev_bypass: Optional[str] = Header(default=None),
):
    user = _authorize_request(request, authorization, x_meet_local_dev_bypass)
    with STORE_LOCK:
        store = _load_store()
        bucket = _get_user_bucket(store, user["uid"])
        room = bucket.get("personal_room")
        if not room or not room.get("roomId"):
            room = _default_personal_room(user["display_name"])
            bucket["personal_room"] = room
            _save_store(store)
    return {"personalRoom": room}


@router.put("/personal-room")
async def put_personal_room(
    payload: PersonalRoomPayload,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_meet_local_dev_bypass: Optional[str] = Header(default=None),
):
    user = _authorize_request(request, authorization, x_meet_local_dev_bypass)

    if not (payload.roomId or "").strip():
        raise HTTPException(status_code=400, detail="Missing room id")

    with STORE_LOCK:
        store = _load_store()
        bucket = _get_user_bucket(store, user["uid"])
        existing = bucket.get("personal_room") or {}
        room = {
            "roomId": payload.roomId.strip(),
            "title": (payload.title or existing.get("title") or _default_personal_room(user["display_name"]).get("title") or "My Meeting Room").strip(),
            "hostPin": (payload.hostPin or existing.get("hostPin") or "4821").strip(),
            "joinLink": (payload.joinLink or existing.get("joinLink") or "").strip(),
            "sourceType": "personal-room",
            "status": "ready",
            "lastUpdated": _now_iso(),
        }
        bucket["personal_room"] = room
        _save_store(store)

    return {"personalRoom": room}
