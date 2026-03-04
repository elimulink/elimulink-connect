import json
import secrets
from typing import Any, Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import verify_firebase_id_token

router = APIRouter()

# In-memory room store (minimal + working)
# ROOMS[room_id] = {
#   "host_uid": str,
#   "members": { socket_id: member_dict },
# }
# member_dict = {
#   "ws": WebSocket,
#   "uid": str,
#   "display_name": str,
#   "role": "host"|"guest",
#   "admitted": bool
# }
ROOMS: Dict[str, Dict[str, Any]] = {}

def _bearer_from_headers(ws: WebSocket) -> Optional[str]:
    authz = ws.headers.get("authorization")
    if not authz:
        return None
    parts = authz.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None

def _room_members(room_id: str) -> Dict[str, Dict[str, Any]]:
    room = ROOMS.get(room_id)
    if not room:
        return {}
    return room.get("members", {})

def _presence(room_id: str) -> dict:
    members = _room_members(room_id)
    room = ROOMS.get(room_id, {})
    host_uid = room.get("host_uid")

    participants = []
    pending = []

    for sid, m in members.items():
        entry = {
            "socket_id": sid,
            "uid": m["uid"],
            "display_name": m.get("display_name") or "",
            "role": m.get("role"),
            "admitted": bool(m.get("admitted")),
        }
        if m.get("admitted"):
            participants.append(entry)
        else:
            pending.append(entry)

    return {
        "type": "presence",
        "room_id": room_id,
        "host_uid": host_uid,
        "participants": participants,
        "pending": pending,
    }

async def _send(ws: WebSocket, msg: dict) -> None:
    await ws.send_text(json.dumps(msg))

async def _broadcast(room_id: str, msg: dict, exclude_sid: Optional[str] = None) -> None:
    members = _room_members(room_id)
    dead = []
    for sid, m in members.items():
        if exclude_sid and sid == exclude_sid:
            continue
        try:
            await _send(m["ws"], msg)
        except Exception:
            dead.append(sid)
    for sid in dead:
        members.pop(sid, None)

async def _broadcast_presence(room_id: str) -> None:
    await _broadcast(room_id, _presence(room_id))

def _find_host_sid(room_id: str) -> Optional[str]:
    members = _room_members(room_id)
    for sid, m in members.items():
        if m.get("role") == "host":
            return sid
    return None

def _find_member_by_uid(room_id: str, uid: str) -> Optional[str]:
    members = _room_members(room_id)
    for sid, m in members.items():
        if m.get("uid") == uid:
            return sid
    return None

@router.websocket("/ws/rooms/{room_id}")
async def ws_room(ws: WebSocket, room_id: str):
    # Token from ?token= OR Authorization header (query param is most reliable for browsers)
    token = ws.query_params.get("token") or _bearer_from_headers(ws)
    if not token:
        await ws.close(code=1008)
        return

    try:
        user = verify_firebase_id_token(token)
    except Exception:
        await ws.close(code=1008)
        return

    await ws.accept()

    # Create room if missing
    if room_id not in ROOMS:
        ROOMS[room_id] = {"host_uid": None, "members": {}}

    room = ROOMS[room_id]
    members = room["members"]

    socket_id = secrets.token_urlsafe(8)

    # Host rules: first admitted user becomes host
    if len(members) == 0:
        role = "host"
        admitted = True
        room["host_uid"] = user.uid
    else:
        role = "guest"
        admitted = False

    display_name = user.display_name or user.email or user.uid

    members[socket_id] = {
        "ws": ws,
        "uid": user.uid,
        "display_name": display_name,
        "role": role,
        "admitted": admitted,
    }

    # Hello to self
    await _send(ws, {
        "type": "hello",
        "room_id": room_id,
        "socket_id": socket_id,
        "uid": user.uid,
        "display_name": display_name,
        "role": role,
        "admitted": admitted,
        "host_uid": room.get("host_uid"),
    })

    # Notify everyone presence changed
    await _broadcast_presence(room_id)

    # If pending, notify host with join_request
    if not admitted:
        host_sid = _find_host_sid(room_id)
        if host_sid and host_sid in members:
            await _send(members[host_sid]["ws"], {
                "type": "join_request",
                "room_id": room_id,
                "pending_socket_id": socket_id,
                "pending_uid": user.uid,
                "pending_display_name": display_name,
            })

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            mtype = msg.get("type")
            me = members.get(socket_id)
            if not me:
                continue

            # Only trust server-side identity
            from_uid = me["uid"]
            from_name = me.get("display_name") or ""

            # Host admits pending users
            if mtype == "admit":
                if me.get("role") != "host":
                    continue

                # accept either to_uid or socket_id
                to_uid = msg.get("to_uid")
                target_sid = msg.get("socket_id")

                if to_uid and not target_sid:
                    target_sid = _find_member_by_uid(room_id, to_uid)

                if target_sid and target_sid in members:
                    members[target_sid]["admitted"] = True
                    await _send(members[target_sid]["ws"], {"type": "admitted", "room_id": room_id})
                    await _broadcast_presence(room_id)
                continue

            # Host removes a user
            if mtype == "remove":
                if me.get("role") != "host":
                    continue

                to_uid = msg.get("to_uid")
                target_sid = msg.get("socket_id")
                if to_uid and not target_sid:
                    target_sid = _find_member_by_uid(room_id, to_uid)

                if target_sid and target_sid in members:
                    try:
                        await _send(members[target_sid]["ws"], {"type": "removed", "room_id": room_id})
                        await members[target_sid]["ws"].close(code=4000)
                    except Exception:
                        pass
                    members.pop(target_sid, None)
                    await _broadcast_presence(room_id)
                continue

            # If user not admitted, block signaling/chat
            if not me.get("admitted") and mtype in ("offer", "answer", "ice", "chat_message"):
                continue

            # Build forwarded message (server attaches identity)
            forward = dict(msg)
            forward["room_id"] = room_id
            forward["from_socket_id"] = socket_id
            forward["from_uid"] = from_uid
            forward["from_display_name"] = from_name

            # Direct routing: offer/answer/ice MUST support to_uid or to_socket_id
            if mtype in ("offer", "answer", "ice"):
                to_uid = msg.get("to_uid")
                to_sid = msg.get("to_socket_id") or msg.get("to")

                if to_uid and not to_sid:
                    to_sid = _find_member_by_uid(room_id, to_uid)

                if to_sid and to_sid in members and members[to_sid].get("admitted"):
                    await _send(members[to_sid]["ws"], forward)
                else:
                    # fallback: broadcast to other admitted users
                    for sid, m in list(members.items()):
                        if sid == socket_id:
                            continue
                        if not m.get("admitted"):
                            continue
                        await _send(m["ws"], forward)
                continue

            # Chat is broadcast to all admitted
            if mtype == "chat_message":
                await _broadcast(room_id, forward, exclude_sid=None)
                continue

            # Leave
            if mtype == "leave":
                break

            # Unknown messages ignored
    except WebSocketDisconnect:
        pass
    finally:
        # Cleanup
        members.pop(socket_id, None)

        # If room empty, delete
        if len(members) == 0:
            ROOMS.pop(room_id, None)
            return

        # If host left, promote someone (prefer admitted)
        if room.get("host_uid") == user.uid:
            promote_sid = None
            for sid, m in members.items():
                if m.get("admitted"):
                    promote_sid = sid
                    break
            if not promote_sid:
                promote_sid = next(iter(members.keys()))

            members[promote_sid]["role"] = "host"
            members[promote_sid]["admitted"] = True
            room["host_uid"] = members[promote_sid]["uid"]

            try:
                await _send(members[promote_sid]["ws"], {
                    "type": "host_assigned",
                    "room_id": room_id,
                    "host_uid": room["host_uid"],
                })
            except Exception:
                pass

        await _broadcast(room_id, {"type": "leave", "room_id": room_id, "socket_id": socket_id, "uid": user.uid}, exclude_sid=None)
        await _broadcast_presence(room_id)