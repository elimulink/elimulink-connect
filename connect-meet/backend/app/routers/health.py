from fastapi import APIRouter

from app.core.config import MEET_REALTIME_MODE, MEET_WEB_CONCURRENCY_HINT

router = APIRouter()


@router.get("/health")
def health():
    return {
        "ok": True,
        "realtime_mode": MEET_REALTIME_MODE,
        "single_instance_required": True,
        "web_concurrency_hint": MEET_WEB_CONCURRENCY_HINT,
        "horizontal_scale_safe": False,
    }
