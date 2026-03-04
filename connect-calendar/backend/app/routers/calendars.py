from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user, AuthedUser
from app.models import Calendar
from app.schemas import CalendarOut, CalendarCreate

router = APIRouter(prefix="/api/v1/calendars", tags=["calendars"])

@router.get("", response_model=list[CalendarOut])
def list_calendars(
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    return db.query(Calendar).filter(Calendar.owner_uid == user.uid).order_by(Calendar.created_at.asc()).all()

@router.post("", response_model=CalendarOut)
def create_calendar(
    payload: CalendarCreate,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    if payload.is_primary:
        # If making primary, unset others
        db.query(Calendar).filter(Calendar.owner_uid == user.uid).update({"is_primary": False})
        db.commit()

    cal = Calendar(
        owner_uid=user.uid,
        name=payload.name,
        color=payload.color,
        is_primary=payload.is_primary,
    )
    db.add(cal)
    db.commit()
    db.refresh(cal)
    return cal