from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user, AuthedUser
from app.models import Calendar, CalendarItem, ItemKind, ItemStatus
from app.schemas import ItemOut, ItemCreate, ItemUpdate

router = APIRouter(prefix="/api/v1/items", tags=["items"])


def serialize_item(item: CalendarItem) -> ItemOut:
    return ItemOut(
        id=item.id,
        calendar_id=item.calendar_id,
        owner_uid=item.owner_uid,
        kind=item.kind.value if isinstance(item.kind, ItemKind) else item.kind,
        title=item.title,
        description=item.description,
        start_at=item.start_at,
        end_at=item.end_at,
        all_day=item.all_day,
        timezone=item.timezone,
        location_text=item.location_text,
        status=item.status.value if isinstance(item.status, ItemStatus) else item.status,
        metadata=item.item_metadata or {},
        created_at=item.created_at,
        updated_at=item.updated_at,
    )

@router.get("", response_model=list[ItemOut])
def list_items(
    from_: datetime = Query(..., alias="from"),
    to: datetime = Query(...),
    calendar_id: UUID | None = None,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    q = db.query(CalendarItem).filter(CalendarItem.owner_uid == user.uid)

    if calendar_id:
        q = q.filter(CalendarItem.calendar_id == calendar_id)

    # Overlap range: item.start < to AND item.end > from
    q = q.filter(CalendarItem.start_at < to, CalendarItem.end_at > from_)

    return [serialize_item(item) for item in q.order_by(CalendarItem.start_at.asc()).all()]

@router.post("", response_model=ItemOut)
def create_item(
    payload: ItemCreate,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    cal = db.query(Calendar).filter(Calendar.id == payload.calendar_id, Calendar.owner_uid == user.uid).first()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")

    item = CalendarItem(
        calendar_id=payload.calendar_id,
        owner_uid=user.uid,
        kind=ItemKind(payload.kind),
        title=payload.title,
        description=payload.description,
        start_at=payload.start_at,
        end_at=payload.end_at,
        all_day=payload.all_day,
        timezone=payload.timezone,
        location_text=payload.location_text,
        status=ItemStatus(payload.status),
        item_metadata=payload.metadata or {},
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_item(item)

@router.patch("/{item_id}", response_model=ItemOut)
def update_item(
    item_id: UUID,
    payload: ItemUpdate,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    item = db.query(CalendarItem).filter(CalendarItem.id == item_id, CalendarItem.owner_uid == user.uid).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    data = payload.model_dump(exclude_unset=True)

    if "kind" in data:
        item.kind = ItemKind(data["kind"])
    if "status" in data:
        item.status = ItemStatus(data["status"])

    field_map = {
        "title": "title",
        "description": "description",
        "start_at": "start_at",
        "end_at": "end_at",
        "all_day": "all_day",
        "timezone": "timezone",
        "location_text": "location_text",
        "metadata": "item_metadata",
    }
    for source_field, model_field in field_map.items():
        if source_field in data:
            setattr(item, model_field, data[source_field])

    db.commit()
    db.refresh(item)
    return serialize_item(item)

@router.delete("/{item_id}")
def delete_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    item = db.query(CalendarItem).filter(CalendarItem.id == item_id, CalendarItem.owner_uid == user.uid).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return {"deleted": True}
