from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user, AuthedUser
from app.models import Calendar, CalendarItem, ItemKind, ItemStatus
from app.schemas import ItemOut, ItemCreate, ItemUpdate

router = APIRouter(prefix="/api/v1/items", tags=["items"])

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

    return q.order_by(CalendarItem.start_at.asc()).all()

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
        metadata=payload.metadata or {},
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

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

    for k in ["title", "description", "start_at", "end_at", "all_day", "timezone", "location_text", "metadata"]:
        if k in data:
            setattr(item, k, data[k])

    db.commit()
    db.refresh(item)
    return item

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