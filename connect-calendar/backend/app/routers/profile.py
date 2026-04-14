from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import AuthedUser, get_current_user
from app.models import CalendarProfileOverride
from app.schemas import ProfileOverrideOut, ProfileOverridePatch

router = APIRouter(prefix="/api/v1/profile-overrides", tags=["profile-overrides"])


@router.get("", response_model=ProfileOverrideOut)
def get_profile_override(
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    row = db.query(CalendarProfileOverride).filter(CalendarProfileOverride.owner_uid == user.uid).first()
    if not row:
        return {"displayName": None, "photoURL": None}
    return {"displayName": row.display_name, "photoURL": row.photo_url}


@router.patch("", response_model=ProfileOverrideOut)
def patch_profile_override(
    payload: ProfileOverridePatch,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    row = db.query(CalendarProfileOverride).filter(CalendarProfileOverride.owner_uid == user.uid).first()
    if not row:
        row = CalendarProfileOverride(owner_uid=user.uid)
        db.add(row)

    if payload.displayName is not None:
        row.display_name = payload.displayName or None
    if payload.photoURL is not None:
        row.photo_url = payload.photoURL or None

    db.commit()
    db.refresh(row)
    return {"displayName": row.display_name, "photoURL": row.photo_url}
