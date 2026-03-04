import os
from dotenv import load_dotenv

load_dotenv()

def _split_csv(v: str) -> list[str]:
    return [x.strip() for x in v.split(",") if x.strip()]

CORS_ORIGINS = _split_csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")