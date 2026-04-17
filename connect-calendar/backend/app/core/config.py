from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_CORS_ORIGINS = ",".join(
    [
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
)


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
