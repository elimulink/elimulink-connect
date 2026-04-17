import os
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_CORS_ORIGIN_ITEMS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "https://calendar.elimulink.co.ke",
    "https://elimulink-connect-calendar.web.app",
    "https://elimulink-connect-calendar.firebaseapp.com",
]


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _merge_cors_origins(env_value: str | None) -> str:
    merged: list[str] = []
    for origin in [*DEFAULT_CORS_ORIGIN_ITEMS, *_split_csv(env_value or "")]:
        if origin not in merged:
            merged.append(origin)
    return ",".join(merged)


DEFAULT_CORS_ORIGINS = _merge_cors_origins(os.getenv("CORS_ORIGINS"))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str

    FIREBASE_PROJECT_ID: str
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None
    FIREBASE_SERVICE_ACCOUNT_JSON: str | None = None
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    USER_PROFILES_TABLE: str = "user_profiles"
    LOCAL_DEV_AUTH_BYPASS: bool = False
    LOCAL_DEV_AUTH_UID: str = "local-calendar-dev"
    LOCAL_DEV_AUTH_EMAIL: str = "calendar-dev@localhost"

    CORS_ORIGINS: str = DEFAULT_CORS_ORIGINS
    CORS_ORIGIN_REGEX: str | None = r"^https://([a-z0-9-]+\.)?elimulink\.co\.ke$"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
