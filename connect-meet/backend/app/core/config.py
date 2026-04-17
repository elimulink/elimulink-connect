import os
from dotenv import load_dotenv

load_dotenv()

DEFAULT_CORS_ORIGINS = ",".join(
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://meet.elimulink.co.ke",
        "https://elimulink-connect-meet.web.app",
        "https://elimulink-connect-meet.firebaseapp.com",
    ]
)

def _split_csv(v: str) -> list[str]:
    return [x.strip() for x in v.split(",") if x.strip()]


def _get_bool(name: str, default: bool = False) -> bool:
    value = str(os.getenv(name, str(default))).strip().lower()
    return value in {"1", "true", "yes", "on"}

CORS_ORIGINS = _split_csv(os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS))
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", r"^https://([a-z0-9-]+\.)?elimulink\.co\.ke$")

GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
USER_PROFILES_TABLE = os.getenv("USER_PROFILES_TABLE", "user_profiles")

MEET_REALTIME_MODE = os.getenv("MEET_REALTIME_MODE", "single-instance").strip() or "single-instance"
MEET_ALLOW_LOCAL_DEV_BYPASS = _get_bool("MEET_ALLOW_LOCAL_DEV_BYPASS", False)
MEET_SIGNALING_MAX_MESSAGE_BYTES = int(os.getenv("MEET_SIGNALING_MAX_MESSAGE_BYTES", "131072"))
MEET_SIGNALING_MAX_CHAT_CHARS = int(os.getenv("MEET_SIGNALING_MAX_CHAT_CHARS", "4000"))
MEET_SIGNALING_MAX_ATTACHMENTS = int(os.getenv("MEET_SIGNALING_MAX_ATTACHMENTS", "10"))
MEET_RECONNECT_GRACE_SECONDS = int(os.getenv("MEET_RECONNECT_GRACE_SECONDS", "30"))
MEET_ATTACHMENT_URL_TTL_SECONDS = int(os.getenv("MEET_ATTACHMENT_URL_TTL_SECONDS", "1800"))
MEET_ICE_SERVER_URLS = _split_csv(os.getenv("MEET_ICE_SERVER_URLS", "stun:stun.l.google.com:19302"))
MEET_ICE_SERVER_USERNAME = os.getenv("MEET_ICE_SERVER_USERNAME", "")
MEET_ICE_SERVER_CREDENTIAL = os.getenv("MEET_ICE_SERVER_CREDENTIAL", "")
MEET_WEB_CONCURRENCY_HINT = int(os.getenv("WEB_CONCURRENCY", os.getenv("UVICORN_WORKERS", "1")))
