from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.calendars import router as calendars_router
from app.routers.items import router as items_router
from app.routers.preferences import router as preferences_router
from app.routers.profile import router as profile_router
from app.routers.research_features import router as research_features_router

app = FastAPI(title="ElimuLink Connect Calendar API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(research_features_router)
app.include_router(calendars_router)
app.include_router(items_router)
app.include_router(preferences_router)
app.include_router(profile_router)
