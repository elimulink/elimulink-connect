from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

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

    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

settings = Settings()
