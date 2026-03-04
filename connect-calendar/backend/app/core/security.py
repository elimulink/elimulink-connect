import os
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import firebase_admin
from firebase_admin import auth as fb_auth, credentials

from app.core.config import settings
from app.core.db import get_db
from app.models import Calendar

bearer = HTTPBearer(auto_error=False)

# Initialize Firebase Admin once
_firebase_inited = False

def _init_firebase():
    global _firebase_inited
    if _firebase_inited:
        return
    # Allow GOOGLE_APPLICATION_CREDENTIALS env var usage
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
    _firebase_inited = True

@dataclass
class AuthedUser:
    uid: str
    email: str | None = None

def _ensure_primary_calendar(db: Session, uid: str):
    exists = db.query(Calendar).filter(Calendar.owner_uid == uid, Calendar.is_primary == True).first()
    if exists:
        return
    cal = Calendar(
        owner_uid=uid,
        name="My Calendar",
        color="#2F6B58",
        is_primary=True,
    )
    db.add(cal)
    db.commit()

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> AuthedUser:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization Bearer token")

    token = creds.credentials
    try:
        _init_firebase()
        decoded = fb_auth.verify_id_token(token)
        uid = decoded.get("uid")
        email = decoded.get("email")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token: missing uid")
        # Ensure primary calendar exists on first authed request
        _ensure_primary_calendar(db, uid)
        return AuthedUser(uid=uid, email=email)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")