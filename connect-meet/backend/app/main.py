from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import CORS_ORIGINS, MEET_REALTIME_MODE, MEET_WEB_CONCURRENCY_HINT
from app.routers.auth import router as auth_router
from app.routers.attachments import router as attachments_router
from app.routers.health import router as health_router
from app.routers.research_features import router as research_features_router
from app.routers.scheduler import router as scheduler_router
from app.routers.signaling import router as signaling_router

app = FastAPI(title="ElimuLink Connect Meet (Signaling)")
logger = logging.getLogger("meet.runtime")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(attachments_router)
app.include_router(health_router)
app.include_router(research_features_router)
app.include_router(scheduler_router)
app.include_router(signaling_router)


@app.on_event("startup")
async def report_runtime_mode() -> None:
    logger.info(
        "meet_runtime_startup mode=%s single_instance_required=true web_concurrency_hint=%s horizontal_scale_safe=false",
        MEET_REALTIME_MODE,
        MEET_WEB_CONCURRENCY_HINT,
    )
    if MEET_WEB_CONCURRENCY_HINT > 1:
        logger.warning(
            "meet_runtime_multiworker_warning mode=%s web_concurrency_hint=%s rooms_are_in_memory=true",
            MEET_REALTIME_MODE,
            MEET_WEB_CONCURRENCY_HINT,
        )
