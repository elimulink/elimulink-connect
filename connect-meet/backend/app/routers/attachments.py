import base64
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.config import MEET_ATTACHMENT_URL_TTL_SECONDS
from app.services.meet_access import authorize_meet_principal
from app.services.meet_runtime import can_access_room, get_room

router = APIRouter(prefix="/api/attachments", tags=["attachments"])
logger = logging.getLogger("meet.attachments")

MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
SUPPORTED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
}

ATTACHMENTS: Dict[str, Dict[str, str]] = {}


class UploadAttachmentRequest(BaseModel):
    room_id: str
    name: str
    content_type: str
    data_base64: str


async def _authorize_meet_request(
    request: Request,
    authorization: Optional[str],
    local_dev_bypass: Optional[str],
) -> Dict[str, str]:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()

    principal = await authorize_meet_principal(
        token=token,
        app_name="meet",
        allow_local_dev_bypass=(local_dev_bypass == "true"),
        local_headers=request.headers,
    )
    return {
        "uid": principal.uid,
        "display_name": principal.display_name or principal.email or principal.uid,
    }


def _attachment_expired(attachment: Dict[str, str]) -> bool:
    try:
        expires_at = datetime.fromisoformat(str(attachment.get("expires_at") or ""))
    except Exception:
        return True
    return expires_at <= datetime.now(timezone.utc)


@router.post("")
async def upload_attachment(
    payload: UploadAttachmentRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_meet_local_dev_bypass: Optional[str] = Header(default=None),
):
    user = await _authorize_meet_request(request, authorization, x_meet_local_dev_bypass)

    content_type = (payload.content_type or "").strip().lower()
    if content_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only image attachments are supported in this phase")

    room_id = (payload.room_id or "").strip()
    if not room_id:
        raise HTTPException(status_code=400, detail="Missing room id")
    if not get_room(room_id):
        logger.warning("meet_attachment_upload_denied reason=missing_room room_id=%s uid=%s", room_id, user["uid"])
        raise HTTPException(status_code=404, detail="Room not found")
    if not can_access_room(room_id, user["uid"], admitted_only=True, include_recoverable=True):
        logger.warning("meet_attachment_upload_denied reason=not_admitted room_id=%s uid=%s", room_id, user["uid"])
        raise HTTPException(status_code=403, detail="Only admitted room participants can upload attachments")

    try:
        raw_bytes = base64.b64decode(payload.data_base64.encode("utf-8"), validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Attachment payload could not be decoded") from exc

    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Attachment payload is empty")
    if len(raw_bytes) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(status_code=400, detail="Images must be 2 MB or smaller in this phase")

    attachment_id = secrets.token_urlsafe(10)
    access_token = secrets.token_urlsafe(18)
    safe_name = (payload.name or "image").strip()[:120] or "image"
    created_at = datetime.now(timezone.utc)

    ATTACHMENTS[attachment_id] = {
        "room_id": room_id,
        "name": safe_name,
        "content_type": content_type,
        "bytes": raw_bytes,
        "access_token": access_token,
        "uploaded_by": user["uid"],
        "uploaded_by_name": user["display_name"],
        "created_at": created_at.isoformat(),
        "expires_at": (created_at + timedelta(seconds=MEET_ATTACHMENT_URL_TTL_SECONDS)).isoformat(),
        "authorization_state": "admitted-room-member",
    }

    base_url = str(request.base_url).rstrip("/")
    url = f"{base_url}/api/attachments/{attachment_id}?token={access_token}"

    return {
        "id": attachment_id,
        "room_id": room_id,
        "name": safe_name,
        "type": content_type,
        "size": len(raw_bytes),
        "url": url,
        "preview_url": url,
        "is_image": True,
        "uploaded_by": user["uid"],
        "uploaded_by_name": user["display_name"],
        "created_at": ATTACHMENTS[attachment_id]["created_at"],
    }


@router.get("/{attachment_id}")
async def get_attachment(
    attachment_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    token: str = Query(default=""),
    x_meet_local_dev_bypass: Optional[str] = Header(default=None),
):
    attachment = ATTACHMENTS.get(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if _attachment_expired(attachment):
        ATTACHMENTS.pop(attachment_id, None)
        raise HTTPException(status_code=404, detail="Attachment not found")

    room_id = str(attachment.get("room_id") or "").strip()
    if not room_id or not get_room(room_id):
        raise HTTPException(status_code=404, detail="Attachment not found")

    requester = None
    try:
        requester = await _authorize_meet_request(request, authorization, x_meet_local_dev_bypass)
    except Exception:
        requester = None

    if requester and can_access_room(room_id, requester["uid"], admitted_only=True, include_recoverable=True):
        pass
    elif token == attachment.get("access_token"):
        logger.info("meet_attachment_token_read room_id=%s attachment_id=%s", room_id, attachment_id)
    else:
        logger.warning("meet_attachment_read_denied room_id=%s attachment_id=%s", room_id, attachment_id)
        raise HTTPException(status_code=404, detail="Attachment not found")

    return Response(
        content=attachment["bytes"],
        media_type=attachment["content_type"],
        headers={
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": f'inline; filename="{attachment["name"]}"',
        },
    )
