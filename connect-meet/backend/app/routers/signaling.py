import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import (
    MEET_RECONNECT_GRACE_SECONDS,
    MEET_SIGNALING_MAX_ATTACHMENTS,
    MEET_SIGNALING_MAX_CHAT_CHARS,
    MEET_SIGNALING_MAX_MESSAGE_BYTES,
)
from app.services.meet_access import authorize_meet_principal
from app.services.meet_runtime import (
    ensure_room,
    find_recoverable_session_by_uid,
    get_connected_member_by_session_id,
    get_room,
    get_session,
    remove_room_if_empty,
    utc_now_iso,
)

router = APIRouter()
logger = logging.getLogger("meet.signaling")

ALLOWED_MESSAGE_TYPES = {
    "admit",
    "answer",
    "chat_message",
    "ice",
    "leave",
    "lower_hand",
    "media_state",
    "mute_all",
    "offer",
    "presentation_state",
    "raise_hand",
    "reaction",
    "remove",
    "set_security",
    "transfer_host",
}
DIRECT_SIGNAL_TYPES = {"offer", "answer", "ice"}
INTERACTION_TYPES = {
    "offer",
    "answer",
    "ice",
    "chat_message",
    "reaction",
    "raise_hand",
    "lower_hand",
    "media_state",
    "presentation_state",
}


def _log(event: str, **payload: Any) -> None:
    safe = {key: value for key, value in payload.items() if value is not None}
    logger.info("meet_event %s", json.dumps({"event": event, **safe}, sort_keys=True, default=str))


def _bearer_from_headers(ws: WebSocket) -> Optional[str]:
    authz = ws.headers.get("authorization")
    if not authz:
        return None
    parts = authz.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def _room_members(room_id: str) -> Dict[str, Dict[str, Any]]:
    room = get_room(room_id)
    if not room:
        return {}
    return room.get("members", {})


def _room_sessions(room_id: str) -> Dict[str, Dict[str, Any]]:
    room = get_room(room_id)
    if not room:
        return {}
    return room.get("sessions", {})


def _active_sessions(room_id: str) -> list[Dict[str, Any]]:
    return [session for session in _room_sessions(room_id).values() if not session.get("expired")]


def _connected_sessions(room_id: str) -> list[Dict[str, Any]]:
    return [session for session in _active_sessions(room_id) if session.get("connected")]


def _presence(room_id: str) -> dict:
    room = get_room(room_id) or {}
    sessions = _connected_sessions(room_id)
    security = room.get("security") or {
        "locked": False,
        "mute_on_entry": False,
        "allow_unmute": True,
    }
    presentation = room.get("presentation") or {
        "active": False,
        "presenter_uid": None,
        "presenter_session_id": None,
        "presenter_display_name": "",
        "started_at": None,
    }

    participants = []
    pending = []
    for session in sessions:
        entry = {
            "socket_id": session.get("socket_id"),
            "session_id": session.get("session_id"),
            "uid": session.get("uid"),
            "display_name": session.get("display_name") or "",
            "role": session.get("role"),
            "admitted": bool(session.get("admitted")),
            "hand_raised": bool(session.get("hand_raised")),
            "audio_enabled": bool(session.get("audio_enabled", True)),
            "video_enabled": bool(session.get("video_enabled", True)),
        }
        if session.get("admitted"):
            participants.append(entry)
        else:
            pending.append(entry)

    return {
        "type": "presence",
        "room_id": room_id,
        "host_uid": room.get("host_uid"),
        "host_session_id": room.get("host_session_id"),
        "participants": participants,
        "pending": pending,
        "security": {
            "locked": bool(security.get("locked")),
            "mute_on_entry": bool(security.get("mute_on_entry")),
            "allow_unmute": bool(security.get("allow_unmute", True)),
        },
        "presentation": {
            "active": bool(presentation.get("active")),
            "presenter_uid": presentation.get("presenter_uid"),
            "presenter_session_id": presentation.get("presenter_session_id"),
            "presenter_display_name": presentation.get("presenter_display_name") or "",
            "started_at": presentation.get("started_at"),
        },
    }


async def _send(ws: WebSocket, msg: dict) -> None:
    await ws.send_text(json.dumps(msg))


async def _send_error(ws: WebSocket, *, code: str, detail: str, room_id: Optional[str] = None) -> None:
    await _send(ws, {"type": "error", "code": code, "detail": detail, "room_id": room_id})


async def _broadcast(room_id: str, msg: dict, exclude_session_id: Optional[str] = None) -> None:
    members = _room_members(room_id)
    dead = []
    for sid, member in members.items():
        if exclude_session_id and member.get("session_id") == exclude_session_id:
            continue
        try:
            await _send(member["ws"], msg)
        except Exception:
            dead.append(sid)

    for sid in dead:
        member = members.pop(sid, None)
        if member:
            session = get_session(room_id, member.get("session_id"))
            if session:
                session["connected"] = False
                session["socket_id"] = None
                session["disconnected_at"] = utc_now_iso()
                session["expires_at"] = (
                    datetime.now(timezone.utc) + timedelta(seconds=MEET_RECONNECT_GRACE_SECONDS)
                ).isoformat()


async def _broadcast_presence(room_id: str) -> None:
    await _broadcast(room_id, _presence(room_id))


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def _find_host_member(room_id: str) -> Optional[Dict[str, Any]]:
    room = get_room(room_id) or {}
    host_session_id = room.get("host_session_id")
    if host_session_id:
        return get_connected_member_by_session_id(room_id, host_session_id)

    for member in _room_members(room_id).values():
        if member.get("role") == "host":
            return member
    return None


def _find_connected_session_by_uid(room_id: str, uid: str) -> Optional[Dict[str, Any]]:
    matches = [session for session in _connected_sessions(room_id) if session.get("uid") == uid]
    if len(matches) != 1:
        return None
    return matches[0]


def _resolve_target_session(room_id: str, msg: dict) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    to_session_id = str(msg.get("to_session_id") or "").strip()
    if to_session_id:
        session = get_session(room_id, to_session_id)
        if not session or session.get("expired") or not session.get("connected"):
            return None, "Target session is not connected"
        return session, None

    to_uid = str(msg.get("to_uid") or "").strip()
    if to_uid:
        session = _find_connected_session_by_uid(room_id, to_uid)
        if not session:
            return None, "Target participant is unavailable or ambiguous"
        return session, None

    to_socket_id = str(msg.get("to_socket_id") or msg.get("to") or msg.get("socket_id") or "").strip()
    if to_socket_id:
        member = _room_members(room_id).get(to_socket_id)
        if not member:
            return None, "Target socket is not connected"
        session = get_session(room_id, member.get("session_id"))
        if not session or session.get("expired"):
            return None, "Target session is unavailable"
        return session, None

    return None, "Target session is required"


def _normalize_chat_message(msg: dict) -> tuple[str, list[dict], list[dict]]:
    text = str(msg.get("message") or "").strip()
    if len(text) > MEET_SIGNALING_MAX_CHAT_CHARS:
        raise ValueError("Chat message is too long")

    mentions = msg.get("mentions") or []
    if not isinstance(mentions, list):
        raise ValueError("Mentions must be a list")
    normalized_mentions = []
    for item in mentions[:50]:
        if isinstance(item, dict):
            normalized_mentions.append(
                {
                    "uid": str(item.get("uid") or "").strip(),
                    "handle": str(item.get("handle") or "").strip(),
                    "displayName": str(item.get("displayName") or item.get("display_name") or "").strip(),
                }
            )

    attachments = msg.get("attachments") or []
    if not isinstance(attachments, list):
        raise ValueError("Attachments must be a list")
    normalized_attachments = []
    for item in attachments[:MEET_SIGNALING_MAX_ATTACHMENTS]:
        if isinstance(item, dict):
            normalized_attachments.append(
                {
                    "id": str(item.get("id") or "").strip(),
                    "name": str(item.get("name") or "").strip()[:120],
                    "type": str(item.get("type") or "").strip()[:80],
                    "url": str(item.get("url") or "").strip(),
                    "previewUrl": str(item.get("previewUrl") or item.get("preview_url") or item.get("url") or "").strip(),
                    "size": int(item.get("size") or 0),
                    "is_image": bool(item.get("is_image", item.get("isImage", False))),
                }
            )

    return text, normalized_mentions, normalized_attachments


def _validate_message(raw: str) -> dict:
    if len(raw.encode("utf-8")) > MEET_SIGNALING_MAX_MESSAGE_BYTES:
        raise ValueError("Message too large")

    try:
        msg = json.loads(raw)
    except Exception as exc:
        raise ValueError("Invalid JSON payload") from exc

    if not isinstance(msg, dict):
        raise ValueError("Message must be an object")

    mtype = str(msg.get("type") or "").strip()
    if mtype not in ALLOWED_MESSAGE_TYPES:
        raise ValueError("Unsupported event type")

    msg["type"] = mtype
    return msg


async def _expire_session(room_id: str, session_id: str, *, reason: str, notify: bool) -> None:
    room = get_room(room_id)
    if not room:
        return

    sessions = room.get("sessions") or {}
    members = room.get("members") or {}
    session = sessions.get(session_id)
    if not session:
        return

    socket_id = session.get("socket_id")
    member = members.pop(socket_id, None) if socket_id else None
    session["connected"] = False
    session["socket_id"] = None
    session["expired"] = True
    session["disconnected_at"] = utc_now_iso()
    session["expires_at"] = utc_now_iso()
    session["disconnect_reason"] = reason

    if notify and member and member.get("ws"):
        try:
            await _send(member["ws"], {"type": "removed", "room_id": room_id, "reason": reason})
            await member["ws"].close(code=4000)
        except Exception:
            pass


async def _clear_presentation_if_needed(room_id: str, session_id: str, *, reason: str) -> None:
    room = get_room(room_id)
    if not room:
        return

    presentation = room.get("presentation") or {}
    if presentation.get("presenter_session_id") != session_id:
        return

    room["presentation"] = {
        "active": False,
        "presenter_uid": None,
        "presenter_session_id": None,
        "presenter_display_name": "",
        "started_at": None,
    }
    await _broadcast(
        room_id,
        {
            "type": "presentation_state",
            "room_id": room_id,
            "active": False,
            "reason": reason,
        },
    )
    _log("presentation_stopped", room_id=room_id, session_id=session_id, reason=reason)


async def _assign_host(room_id: str, session_id: str, *, announce: bool) -> None:
    room = get_room(room_id)
    if not room:
        return

    session = get_session(room_id, session_id)
    if not session or session.get("expired"):
        return

    for other in _active_sessions(room_id):
        if other.get("session_id") == session_id:
            other["role"] = "host"
            other["admitted"] = True
        elif other.get("role") == "host":
            other["role"] = "guest"

    room["host_uid"] = session.get("uid")
    room["host_session_id"] = session_id

    members = _room_members(room_id)
    if session.get("socket_id") and session.get("socket_id") in members:
        members[session["socket_id"]]["role"] = "host"
        members[session["socket_id"]]["admitted"] = True

    if announce:
        await _broadcast(
            room_id,
            {
                "type": "host_assigned",
                "room_id": room_id,
                "host_uid": room["host_uid"],
                "host_session_id": room["host_session_id"],
                "from_uid": room["host_uid"],
                "from_display_name": session.get("display_name") or "",
            },
        )
    _log("host_assigned", room_id=room_id, uid=room.get("host_uid"), session_id=room.get("host_session_id"))


async def _promote_next_host(room_id: str) -> None:
    candidates = [session for session in _connected_sessions(room_id) if session.get("admitted")]
    if not candidates:
        candidates = _connected_sessions(room_id)
    if not candidates:
        return
    await _assign_host(room_id, candidates[0]["session_id"], announce=True)


async def _cleanup_expired_sessions(room_id: str) -> None:
    room = get_room(room_id)
    if not room:
        return

    sessions = room.get("sessions") or {}
    now = datetime.now(timezone.utc)
    expired_ids: list[str] = []
    host_expired = False

    for session_id, session in list(sessions.items()):
        if session.get("expired"):
            expired_ids.append(session_id)
            continue

        expires_at = _parse_iso(session.get("expires_at"))
        if session.get("connected") or not expires_at or expires_at > now:
            continue

        session["expired"] = True
        expired_ids.append(session_id)
        if room.get("host_session_id") == session_id:
            host_expired = True
        await _clear_presentation_if_needed(room_id, session_id, reason="session_expired")
        _log("session_expired", room_id=room_id, uid=session.get("uid"), session_id=session_id)

    for session_id in expired_ids:
        session = sessions.pop(session_id, None)
        if not session:
            continue
        socket_id = session.get("socket_id")
        if socket_id:
            _room_members(room_id).pop(socket_id, None)

    if host_expired:
        room["host_uid"] = None
        room["host_session_id"] = None
        await _promote_next_host(room_id)
    remove_room_if_empty(room_id)


async def _set_presentation_state(room_id: str, session: Dict[str, Any], *, active: bool) -> None:
    room = get_room(room_id)
    if not room:
        return

    if active:
        room["presentation"] = {
            "active": True,
            "presenter_uid": session.get("uid"),
            "presenter_session_id": session.get("session_id"),
            "presenter_display_name": session.get("display_name") or "",
            "started_at": utc_now_iso(),
        }
        await _broadcast(
            room_id,
            {
                "type": "presentation_state",
                "room_id": room_id,
                "active": True,
                "presenter_uid": session.get("uid"),
                "presenter_session_id": session.get("session_id"),
                "presenter_display_name": session.get("display_name") or "",
                "started_at": room["presentation"]["started_at"],
            },
        )
        _log(
            "presentation_started",
            room_id=room_id,
            uid=session.get("uid"),
            session_id=session.get("session_id"),
        )
        return

    await _clear_presentation_if_needed(room_id, session.get("session_id"), reason="explicit_stop")


@router.websocket("/ws/rooms/{room_id}")
async def ws_room(ws: WebSocket, room_id: str):
    token = ws.query_params.get("token") or _bearer_from_headers(ws)
    allow_local_dev = ws.query_params.get("local_dev") == "true"
    requested_session_id = str(ws.query_params.get("session_id") or "").strip()

    try:
        principal = await authorize_meet_principal(
            token=token,
            app_name="meet",
            allow_local_dev_bypass=allow_local_dev,
            local_headers=ws.headers,
        )
    except Exception as exc:
        _log("connect_rejected", room_id=room_id, reason=str(getattr(exc, "detail", "unauthorized")))
        await ws.close(code=1008)
        return

    await ws.accept()
    room = ensure_room(room_id)
    await _cleanup_expired_sessions(room_id)

    security = room.setdefault(
        "security",
        {
            "locked": False,
            "mute_on_entry": False,
            "allow_unmute": True,
        },
    )

    if len(_connected_sessions(room_id)) > 0 and security.get("locked") and room.get("host_uid") != principal.uid:
        await _send_error(ws, code="meeting_locked", detail="The meeting is locked.", room_id=room_id)
        await ws.close(code=4003)
        _log("connect_rejected", room_id=room_id, uid=principal.uid, reason="meeting_locked")
        return

    recovered = False
    session = None
    sessions = room["sessions"]
    members = room["members"]

    if requested_session_id:
        candidate = sessions.get(requested_session_id)
        if (
            candidate
            and candidate.get("uid") == principal.uid
            and not candidate.get("expired")
            and not candidate.get("connected")
        ):
            session = candidate
            recovered = True

    if session is None:
        candidate = find_recoverable_session_by_uid(room_id, principal.uid)
        if candidate:
            session = candidate
            recovered = True

    for existing in list(_active_sessions(room_id)):
        if existing.get("uid") != principal.uid:
            continue
        if session and existing.get("session_id") == session.get("session_id"):
            continue
        await _expire_session(room_id, existing["session_id"], reason="replaced_by_new_session", notify=True)
        _log(
            "duplicate_session_replaced",
            room_id=room_id,
            uid=principal.uid,
            replaced_session_id=existing.get("session_id"),
        )

    if session is None:
        existing_live_sessions = _active_sessions(room_id)
        session_id = secrets.token_urlsafe(10)
        is_first_session = len(existing_live_sessions) == 0
        role = "host" if is_first_session else "guest"
        admitted = True if is_first_session else False
        session = {
            "session_id": session_id,
            "uid": principal.uid,
            "display_name": principal.display_name or principal.email or principal.uid,
            "role": role,
            "admitted": admitted,
            "hand_raised": False,
            "audio_enabled": True,
            "video_enabled": True,
            "connected": False,
            "socket_id": None,
            "created_at": utc_now_iso(),
            "connected_at": None,
            "disconnected_at": None,
            "expires_at": None,
            "expired": False,
        }
        sessions[session_id] = session
        if is_first_session:
            room["host_uid"] = principal.uid
            room["host_session_id"] = session_id
    else:
        session["display_name"] = principal.display_name or principal.email or principal.uid
        session["expired"] = False

    if room.get("host_uid") == principal.uid:
        session["role"] = "host"
        session["admitted"] = True
        room["host_session_id"] = session["session_id"]

    socket_id = secrets.token_urlsafe(8)
    session["connected"] = True
    session["socket_id"] = socket_id
    session["connected_at"] = utc_now_iso()
    session["disconnected_at"] = None
    session["expires_at"] = None

    member = {
        "ws": ws,
        "socket_id": socket_id,
        "session_id": session["session_id"],
        "uid": session["uid"],
        "display_name": session["display_name"],
        "role": session["role"],
        "admitted": session["admitted"],
        "hand_raised": session["hand_raised"],
        "audio_enabled": session["audio_enabled"],
        "video_enabled": session["video_enabled"],
    }
    members[socket_id] = member

    await _send(
        ws,
        {
            "type": "hello",
            "room_id": room_id,
            "socket_id": socket_id,
            "session_id": session["session_id"],
            "uid": session["uid"],
            "display_name": session["display_name"],
            "role": session["role"],
            "admitted": session["admitted"],
            "host_uid": room.get("host_uid"),
            "host_session_id": room.get("host_session_id"),
            "recovered": recovered,
            "presentation": room.get("presentation"),
        },
    )
    _log(
        "connected",
        room_id=room_id,
        uid=session["uid"],
        session_id=session["session_id"],
        recovered=recovered,
        source=principal.source,
    )

    await _broadcast_presence(room_id)

    if not session.get("admitted"):
        host_member = _find_host_member(room_id)
        if host_member:
            await _send(
                host_member["ws"],
                {
                    "type": "join_request",
                    "room_id": room_id,
                    "pending_socket_id": socket_id,
                    "pending_session_id": session["session_id"],
                    "pending_uid": session["uid"],
                    "pending_display_name": session["display_name"],
                },
            )

    intentional_leave = False
    try:
        while True:
            raw = await ws.receive_text()
            await _cleanup_expired_sessions(room_id)
            try:
                msg = _validate_message(raw)
            except ValueError as exc:
                await _send_error(ws, code="invalid_message", detail=str(exc), room_id=room_id)
                _log("message_rejected", room_id=room_id, uid=session["uid"], reason=str(exc))
                continue

            mtype = msg["type"]
            me = get_session(room_id, session["session_id"])
            if not me or me.get("expired"):
                await _send_error(ws, code="session_expired", detail="Room session is no longer active.", room_id=room_id)
                break

            from_uid = me["uid"]
            from_name = me.get("display_name") or ""

            if mtype == "admit":
                if me.get("role") != "host":
                    continue
                target_session, error = _resolve_target_session(room_id, msg)
                if not target_session:
                    await _send_error(ws, code="invalid_target", detail=error or "Invalid target", room_id=room_id)
                    _log("admit_failed", room_id=room_id, uid=from_uid, reason=error)
                    continue

                target_session["admitted"] = True
                target_session["hand_raised"] = False
                target_member = get_connected_member_by_session_id(room_id, target_session["session_id"])
                if target_member:
                    target_member["admitted"] = True
                    target_member["hand_raised"] = False
                    await _send(target_member["ws"], {"type": "admitted", "room_id": room_id, "session_id": target_session["session_id"]})
                await _broadcast_presence(room_id)
                _log("admitted", room_id=room_id, uid=target_session.get("uid"), session_id=target_session.get("session_id"))
                continue

            if mtype == "remove":
                if me.get("role") != "host":
                    continue
                target_session, error = _resolve_target_session(room_id, msg)
                if not target_session:
                    await _send_error(ws, code="invalid_target", detail=error or "Invalid target", room_id=room_id)
                    _log("remove_failed", room_id=room_id, uid=from_uid, reason=error)
                    continue

                await _expire_session(room_id, target_session["session_id"], reason="removed_by_host", notify=True)
                await _clear_presentation_if_needed(room_id, target_session["session_id"], reason="removed_by_host")
                if room.get("host_session_id") == target_session.get("session_id"):
                    room["host_session_id"] = None
                    room["host_uid"] = None
                    await _promote_next_host(room_id)
                await _broadcast_presence(room_id)
                _log("removed", room_id=room_id, uid=target_session.get("uid"), session_id=target_session.get("session_id"))
                continue

            if mtype == "set_security":
                if me.get("role") != "host":
                    continue
                patch = msg.get("payload") or {}
                if "locked" in patch:
                    security["locked"] = bool(patch.get("locked"))
                if "mute_on_entry" in patch:
                    security["mute_on_entry"] = bool(patch.get("mute_on_entry"))
                if "allow_unmute" in patch:
                    security["allow_unmute"] = bool(patch.get("allow_unmute"))

                await _broadcast(
                    room_id,
                    {
                        "type": "security_state",
                        "room_id": room_id,
                        "security": {
                            "locked": bool(security.get("locked")),
                            "mute_on_entry": bool(security.get("mute_on_entry")),
                            "allow_unmute": bool(security.get("allow_unmute", True)),
                        },
                        "from_uid": from_uid,
                        "from_display_name": from_name,
                    },
                )
                await _broadcast_presence(room_id)
                _log("security_updated", room_id=room_id, uid=from_uid, payload=security)
                continue

            if mtype == "mute_all":
                if me.get("role") != "host":
                    continue
                await _broadcast(
                    room_id,
                    {
                        "type": "mute_all",
                        "room_id": room_id,
                        "from_uid": from_uid,
                        "from_display_name": from_name,
                    },
                    exclude_session_id=me["session_id"],
                )
                _log("mute_all", room_id=room_id, uid=from_uid)
                continue

            if mtype == "transfer_host":
                if me.get("role") != "host":
                    continue
                target_session, error = _resolve_target_session(room_id, msg)
                if not target_session:
                    await _send_error(ws, code="invalid_target", detail=error or "Invalid target", room_id=room_id)
                    _log("host_transfer_failed", room_id=room_id, uid=from_uid, reason=error)
                    continue
                if not target_session.get("admitted") or target_session.get("session_id") == me.get("session_id"):
                    await _send_error(ws, code="invalid_target", detail="Host transfer requires another admitted participant.", room_id=room_id)
                    continue

                await _assign_host(room_id, target_session["session_id"], announce=True)
                await _broadcast_presence(room_id)
                continue

            if not me.get("admitted") and mtype in INTERACTION_TYPES:
                await _send_error(ws, code="not_admitted", detail="Lobby participants cannot use live room actions yet.", room_id=room_id)
                continue

            if mtype == "media_state":
                payload = msg.get("payload") or {}
                if "audio_enabled" in payload:
                    me["audio_enabled"] = bool(payload.get("audio_enabled"))
                if "video_enabled" in payload:
                    me["video_enabled"] = bool(payload.get("video_enabled"))
                current_member = members.get(socket_id)
                if current_member:
                    current_member["audio_enabled"] = me["audio_enabled"]
                    current_member["video_enabled"] = me["video_enabled"]
                await _broadcast_presence(room_id)
                continue

            if mtype == "presentation_state":
                payload = msg.get("payload") or {}
                active = bool(payload.get("active"))
                await _set_presentation_state(room_id, me, active=active)
                await _broadcast_presence(room_id)
                continue

            if mtype == "raise_hand":
                me["hand_raised"] = True
                if socket_id in members:
                    members[socket_id]["hand_raised"] = True
                await _broadcast_presence(room_id)
                await _broadcast(
                    room_id,
                    {
                        "type": "raise_hand",
                        "room_id": room_id,
                        "from_uid": from_uid,
                        "from_session_id": me["session_id"],
                        "from_display_name": from_name,
                    },
                )
                continue

            if mtype == "lower_hand":
                target_session, _ = _resolve_target_session(room_id, msg)
                if target_session:
                    if me.get("role") != "host" and target_session.get("uid") != from_uid:
                        continue
                else:
                    target_session = me

                target_session["hand_raised"] = False
                target_member = get_connected_member_by_session_id(room_id, target_session["session_id"])
                if target_member:
                    target_member["hand_raised"] = False
                await _broadcast_presence(room_id)
                await _broadcast(
                    room_id,
                    {
                        "type": "lower_hand",
                        "room_id": room_id,
                        "from_uid": target_session.get("uid"),
                        "from_session_id": target_session.get("session_id"),
                        "from_display_name": target_session.get("display_name") or "",
                    },
                )
                continue

            if mtype == "reaction":
                emoji = str(msg.get("emoji") or "").strip()
                if not emoji or len(emoji) > 16:
                    await _send_error(ws, code="invalid_reaction", detail="Reaction payload is invalid.", room_id=room_id)
                    continue
                await _broadcast(
                    room_id,
                    {
                        "type": "reaction",
                        "room_id": room_id,
                        "emoji": emoji,
                        "from_uid": from_uid,
                        "from_session_id": me["session_id"],
                        "from_display_name": from_name,
                    },
                )
                continue

            if mtype in DIRECT_SIGNAL_TYPES:
                target_session, error = _resolve_target_session(room_id, msg)
                if not target_session:
                    await _send_error(ws, code="invalid_target", detail=error or "Invalid target", room_id=room_id)
                    _log("signal_route_failed", room_id=room_id, uid=from_uid, session_id=me["session_id"], type=mtype, reason=error)
                    continue
                if not target_session.get("admitted"):
                    await _send_error(ws, code="invalid_target", detail="Target participant is not admitted.", room_id=room_id)
                    continue
                if target_session.get("session_id") == me.get("session_id"):
                    await _send_error(ws, code="invalid_target", detail="Cannot route peer signaling to the same session.", room_id=room_id)
                    continue

                target_member = get_connected_member_by_session_id(room_id, target_session["session_id"])
                if not target_member:
                    await _send_error(ws, code="invalid_target", detail="Target participant is disconnected.", room_id=room_id)
                    continue

                forward = {
                    "type": mtype,
                    "room_id": room_id,
                    "payload": msg.get("payload"),
                    "from_socket_id": socket_id,
                    "from_session_id": me["session_id"],
                    "from_uid": from_uid,
                    "from_display_name": from_name,
                    "to_session_id": target_session["session_id"],
                    "to_uid": target_session["uid"],
                }
                await _send(target_member["ws"], forward)
                continue

            if mtype == "chat_message":
                try:
                    clean_text, mentions, attachments = _normalize_chat_message(msg)
                except ValueError as exc:
                    await _send_error(ws, code="invalid_chat", detail=str(exc), room_id=room_id)
                    continue
                if not clean_text and not attachments:
                    continue

                await _broadcast(
                    room_id,
                    {
                        "type": "chat_message",
                        "room_id": room_id,
                        "message": clean_text,
                        "mentions": mentions,
                        "attachments": attachments,
                        "sent_at": utc_now_iso(),
                        "from_socket_id": socket_id,
                        "from_session_id": me["session_id"],
                        "from_uid": from_uid,
                        "from_display_name": from_name,
                    },
                )
                continue

            if mtype == "leave":
                intentional_leave = True
                break
    except WebSocketDisconnect:
        _log("socket_disconnected", room_id=room_id, uid=session.get("uid"), session_id=session.get("session_id"))
    finally:
        room = get_room(room_id)
        if not room:
            return

        sessions = room.get("sessions") or {}
        session = sessions.get(session["session_id"])
        current_member = room.get("members", {}).pop(socket_id, None)
        if not session:
            remove_room_if_empty(room_id)
            return

        if intentional_leave:
            await _clear_presentation_if_needed(room_id, session["session_id"], reason="left_room")
            session["expired"] = True
            session["connected"] = False
            session["socket_id"] = None
            sessions.pop(session["session_id"], None)
            _log("left_room", room_id=room_id, uid=session.get("uid"), session_id=session.get("session_id"))
            if room.get("host_session_id") == session.get("session_id"):
                room["host_session_id"] = None
                room["host_uid"] = None
                await _promote_next_host(room_id)
            await _broadcast(
                room_id,
                {
                    "type": "leave",
                    "room_id": room_id,
                    "socket_id": socket_id,
                    "session_id": session.get("session_id"),
                    "uid": session.get("uid"),
                },
            )
            await _broadcast_presence(room_id)
            remove_room_if_empty(room_id)
            return

        session["connected"] = False
        session["socket_id"] = None
        session["disconnected_at"] = utc_now_iso()
        session["expires_at"] = (
            datetime.now(timezone.utc) + timedelta(seconds=MEET_RECONNECT_GRACE_SECONDS)
        ).isoformat()

        await _clear_presentation_if_needed(room_id, session["session_id"], reason="disconnected")
        if room.get("host_session_id") == session.get("session_id"):
            _log("host_recovery_window_started", room_id=room_id, uid=session.get("uid"), session_id=session.get("session_id"))

        if current_member:
            await _broadcast(
                room_id,
                {
                    "type": "leave",
                    "room_id": room_id,
                    "socket_id": socket_id,
                    "session_id": session.get("session_id"),
                    "uid": session.get("uid"),
                },
            )
            await _broadcast_presence(room_id)

        await _cleanup_expired_sessions(room_id)
