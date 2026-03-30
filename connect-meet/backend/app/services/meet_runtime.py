from datetime import datetime, timezone
from typing import Any, Dict, Optional


ROOMS: Dict[str, Dict[str, Any]] = {}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_room(room_id: str) -> Optional[Dict[str, Any]]:
    return ROOMS.get(room_id)


def ensure_room(room_id: str) -> Dict[str, Any]:
    room = ROOMS.get(room_id)
    if room is None:
        room = {
            "host_uid": None,
            "host_session_id": None,
            "members": {},
            "sessions": {},
            "security": {
                "locked": False,
                "mute_on_entry": False,
                "allow_unmute": True,
            },
            "presentation": {
                "active": False,
                "presenter_uid": None,
                "presenter_session_id": None,
                "presenter_display_name": "",
                "started_at": None,
            },
            "created_at": utc_now_iso(),
        }
        ROOMS[room_id] = room
    return room


def remove_room_if_empty(room_id: str) -> None:
    room = ROOMS.get(room_id)
    if not room:
        return

    connected_members = room.get("members") or {}
    sessions = room.get("sessions") or {}
    active_sessions = [session for session in sessions.values() if not session.get("expired")]
    if not connected_members and not active_sessions:
        ROOMS.pop(room_id, None)


def get_connected_member_by_uid(room_id: str, uid: str) -> Optional[Dict[str, Any]]:
    room = ROOMS.get(room_id) or {}
    members = room.get("members") or {}
    for member in members.values():
        if member.get("uid") == uid:
            return member
    return None


def get_connected_member_by_session_id(room_id: str, session_id: str) -> Optional[Dict[str, Any]]:
    room = ROOMS.get(room_id) or {}
    members = room.get("members") or {}
    for member in members.values():
        if member.get("session_id") == session_id:
            return member
    return None


def get_session(room_id: str, session_id: str) -> Optional[Dict[str, Any]]:
    room = ROOMS.get(room_id) or {}
    return (room.get("sessions") or {}).get(session_id)


def find_recoverable_session_by_uid(room_id: str, uid: str) -> Optional[Dict[str, Any]]:
    room = ROOMS.get(room_id) or {}
    sessions = room.get("sessions") or {}
    for session in sessions.values():
        if session.get("uid") == uid and not session.get("connected") and not session.get("expired"):
            return session
    return None


def can_access_room(
    room_id: str,
    uid: str,
    *,
    admitted_only: bool = True,
    include_recoverable: bool = False,
) -> bool:
    room = ROOMS.get(room_id)
    if not room:
        return False

    sessions = room.get("sessions") or {}
    for session in sessions.values():
        if session.get("uid") != uid or session.get("expired"):
            continue
        if admitted_only and not session.get("admitted"):
            continue
        if session.get("connected") or include_recoverable:
            return True
    return False
