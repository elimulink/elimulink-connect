from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1", tags=["research-features"])

DB: dict[str, Any] = {
    "conversations": {},
    "messages": {},
    "sources": {},
    "share_links": {},
    "share_link_messages": [],
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def ok(payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, **payload}


def fail(status_code: int, code: str, message: str) -> None:
    raise HTTPException(
        status_code=status_code,
        detail={"ok": False, "error": {"code": code, "message": message}},
    )


def get_conversation_or_404(conversation_id: str) -> dict[str, Any]:
    conv = DB["conversations"].get(conversation_id)
    if not conv:
        fail(404, "NOT_FOUND", "Conversation not found.")
    return conv


def get_message_or_404(message_id: str) -> dict[str, Any]:
    msg = DB["messages"].get(message_id)
    if not msg:
        fail(404, "MESSAGE_NOT_FOUND", "Message not found.")
    return msg


def get_share_or_404(share_id: str) -> dict[str, Any]:
    share = DB["share_links"].get(share_id)
    if not share:
        fail(404, "NOT_FOUND", "Share link not found.")
    if share.get("revoked_at"):
        fail(410, "EXPIRED_SHARE_LINK", "Share link has been revoked.")
    expires_at = share.get("expires_at")
    if expires_at and expires_at < now_utc():
        fail(410, "EXPIRED_SHARE_LINK", "Share link has expired.")
    return share


def extract_sources_for_message(message_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    message = get_message_or_404(message_id)
    citations = message.get("citations", [])
    sources = message.get("sources", [])
    return citations, sources


def create_demo_assistant_answer(user_content: str) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    src1_id = make_id("src")
    src2_id = make_id("src")

    source1 = {
        "id": src1_id,
        "title": "Guardian Jet",
        "domain": "guardianjet.com",
        "url": "https://guardianjet.com/",
        "snippet": "Market pricing and aircraft listing summary.",
        "provider": "web",
        "type": "article",
        "published_at": iso(now_utc()),
        "favicon_url": None,
    }
    source2 = {
        "id": src2_id,
        "title": "Mercury Jets",
        "domain": "mercuryjets.com",
        "url": "https://www.mercuryjets.com/",
        "snippet": "Charter pricing guide and route references.",
        "provider": "web",
        "type": "pricing-page",
        "published_at": iso(now_utc()),
        "favicon_url": None,
    }

    DB["sources"][src1_id] = source1
    DB["sources"][src2_id] = source2

    citations = [
        {"id": make_id("cit"), "source_id": src1_id, "label": "Guardian Jet", "position": 0},
        {"id": make_id("cit"), "source_id": src2_id, "label": "Mercury Jets", "position": 1},
    ]
    sources = [source1, source2]

    answer = (
        f"You asked: {user_content}\n\n"
        "Here is a source-backed answer. Use chartering or pricing references as a starting point."
    )
    return answer, citations, sources


Family = Literal["executive", "ai", "connect"]
AppName = Literal["executive", "vc", "institution", "student", "public", "meet", "calendar"]
Visibility = Literal["unlisted", "internal"]


class CreateConversationRequest(BaseModel):
    family: Family
    app: AppName
    title: str = "New conversation"


class CreateMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)


class CreateShareLinkRequest(BaseModel):
    family: Family
    app: AppName
    conversation_id: str
    message_ids: list[str] | None = None
    visibility: Visibility = "unlisted"
    allow_continue_chat: bool = True
    expires_in_days: int | None = 30


@router.post("/conversations")
def create_conversation(body: CreateConversationRequest) -> dict[str, Any]:
    conversation_id = make_id("conv")
    created_at = now_utc()

    conversation = {
        "id": conversation_id,
        "family": body.family,
        "app": body.app,
        "title": body.title,
        "created_at": created_at,
        "updated_at": created_at,
        "message_ids": [],
    }
    DB["conversations"][conversation_id] = conversation

    return ok(
        {
            "conversation": {
                "id": conversation["id"],
                "family": conversation["family"],
                "app": conversation["app"],
                "title": conversation["title"],
                "created_at": iso(conversation["created_at"]),
                "updated_at": iso(conversation["updated_at"]),
            }
        }
    )


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str) -> dict[str, Any]:
    conversation = get_conversation_or_404(conversation_id)

    messages = []
    for message_id in conversation["message_ids"]:
        msg = DB["messages"][message_id]
        messages.append(
            {
                "id": msg["id"],
                "conversation_id": msg["conversation_id"],
                "role": msg["role"],
                "content": msg["content"],
                "created_at": iso(msg["created_at"]),
                "citations": msg.get("citations", []),
                "sources": msg.get("sources", []),
            }
        )

    return ok(
        {
            "conversation": {
                "id": conversation["id"],
                "family": conversation["family"],
                "app": conversation["app"],
                "title": conversation["title"],
                "created_at": iso(conversation["created_at"]),
                "updated_at": iso(conversation["updated_at"]),
            },
            "messages": messages,
        }
    )


@router.post("/conversations/{conversation_id}/messages")
def create_message(conversation_id: str, body: CreateMessageRequest) -> dict[str, Any]:
    conversation = get_conversation_or_404(conversation_id)

    user_message_id = make_id("msg")
    assistant_message_id = make_id("msg")
    created_at = now_utc()

    user_message = {
        "id": user_message_id,
        "conversation_id": conversation_id,
        "role": "user",
        "content": body.content,
        "created_at": created_at,
        "citations": [],
        "sources": [],
    }
    DB["messages"][user_message_id] = user_message
    conversation["message_ids"].append(user_message_id)

    assistant_content, citations, sources = create_demo_assistant_answer(body.content)

    assistant_message = {
        "id": assistant_message_id,
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": assistant_content,
        "created_at": now_utc(),
        "citations": citations,
        "sources": sources,
    }
    DB["messages"][assistant_message_id] = assistant_message
    conversation["message_ids"].append(assistant_message_id)
    conversation["updated_at"] = now_utc()

    return ok(
        {
            "user_message": {
                "id": user_message["id"],
                "conversation_id": user_message["conversation_id"],
                "role": user_message["role"],
                "content": user_message["content"],
                "created_at": iso(user_message["created_at"]),
                "citations": [],
                "sources": [],
            },
            "assistant_message": {
                "id": assistant_message["id"],
                "conversation_id": assistant_message["conversation_id"],
                "role": assistant_message["role"],
                "content": assistant_message["content"],
                "created_at": iso(assistant_message["created_at"]),
                "citations": assistant_message["citations"],
                "sources": assistant_message["sources"],
            },
        }
    )


@router.get("/messages/{message_id}/sources")
def get_message_sources(message_id: str) -> dict[str, Any]:
    citations, sources = extract_sources_for_message(message_id)
    return ok({"message_id": message_id, "citations": citations, "sources": sources})


@router.get("/sources/{source_id}")
def get_source(source_id: str) -> dict[str, Any]:
    source = DB["sources"].get(source_id)
    if not source:
        fail(404, "SOURCE_NOT_FOUND", "Source not found.")
    return ok({"source": source})


@router.post("/share-links")
def create_share_link(
    body: CreateShareLinkRequest,
    base_url: str = Query(default="https://app.elimulink.com"),
) -> dict[str, Any]:
    conversation = get_conversation_or_404(body.conversation_id)

    if conversation["family"] != body.family or conversation["app"] != body.app:
        fail(400, "INVALID_REQUEST", "Family/app does not match the conversation.")

    message_ids = body.message_ids or conversation["message_ids"]
    for message_id in message_ids:
        if message_id not in conversation["message_ids"]:
            fail(
                400,
                "INVALID_REQUEST",
                f"Message {message_id} does not belong to the conversation.",
            )

    share_id = make_id("shr")
    created_at = now_utc()
    expires_at = created_at + timedelta(days=body.expires_in_days) if body.expires_in_days else None

    share_link = {
        "id": share_id,
        "conversation_id": body.conversation_id,
        "message_ids": message_ids,
        "visibility": body.visibility,
        "allow_continue_chat": body.allow_continue_chat,
        "created_at": created_at,
        "expires_at": expires_at,
        "revoked_at": None,
    }
    DB["share_links"][share_id] = share_link

    url = f"{base_url.rstrip('/')}/shared/{share_id}"

    return ok(
        {
            "share_link": {
                "id": share_id,
                "conversation_id": body.conversation_id,
                "url": url,
                "visibility": body.visibility,
                "allow_continue_chat": body.allow_continue_chat,
                "created_at": iso(created_at),
                "expires_at": iso(expires_at),
            }
        }
    )


@router.get("/share-links/{share_id}")
def get_share_link(share_id: str) -> dict[str, Any]:
    share = get_share_or_404(share_id)
    conversation = get_conversation_or_404(share["conversation_id"])

    messages = []
    for message_id in share["message_ids"]:
        msg = get_message_or_404(message_id)
        messages.append(
            {
                "id": msg["id"],
                "role": msg["role"],
                "content": msg["content"],
                "created_at": iso(msg["created_at"]),
                "citations": msg.get("citations", []),
                "sources": msg.get("sources", []),
            }
        )

    return ok(
        {
            "share_link": {
                "id": share["id"],
                "visibility": share["visibility"],
                "allow_continue_chat": share["allow_continue_chat"],
                "created_at": iso(share["created_at"]),
                "expires_at": iso(share["expires_at"]),
            },
            "conversation": {
                "id": conversation["id"],
                "title": conversation["title"],
                "messages": messages,
            },
        }
    )


@router.delete("/share-links/{share_id}")
def delete_share_link(share_id: str) -> dict[str, Any]:
    share = DB["share_links"].get(share_id)
    if not share:
        fail(404, "NOT_FOUND", "Share link not found.")
    share["revoked_at"] = now_utc()
    return ok({})
