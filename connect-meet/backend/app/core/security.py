from dataclasses import dataclass
from typing import Optional

import firebase_admin
from firebase_admin import credentials, auth

from app.core.config import GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_PROJECT_ID

_inited = False

def init_firebase_admin() -> None:
    global _inited
    if _inited:
        return

    # If you provide a JSON path, use Certificate
    if GOOGLE_APPLICATION_CREDENTIALS:
        cred = credentials.Certificate(GOOGLE_APPLICATION_CREDENTIALS)
        firebase_admin.initialize_app(cred)
    else:
        # Works only if GOOGLE_APPLICATION_CREDENTIALS is set in environment by OS
        firebase_admin.initialize_app()

    _inited = True

@dataclass
class AuthedUser:
    uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None

def verify_firebase_id_token(token: str) -> AuthedUser:
    init_firebase_admin()
    decoded = auth.verify_id_token(token)

    # Optional strict project match
    if FIREBASE_PROJECT_ID:
        aud = decoded.get("aud")
        if aud and aud != FIREBASE_PROJECT_ID:
            raise ValueError("Token project mismatch")

    uid = decoded.get("uid") or decoded.get("sub")
    if not uid:
        raise ValueError("Missing uid")

    return AuthedUser(
        uid=uid,
        email=decoded.get("email"),
        display_name=decoded.get("name") or decoded.get("email"),
    )