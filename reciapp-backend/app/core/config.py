import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://reciapp:reciapp@db:5432/reciapp")
SECRET_KEY: str = os.getenv("SECRET_KEY", "")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
# Lista separada por comas (dev :5173, preview PWA :4173, IP de la laptop para probar en el celular…)
FRONTEND_URLS: list[str] = [u.strip() for u in FRONTEND_URL.split(",") if u.strip()]

# ── Capa de abstracción LLM ───────────────────────────────────────────────────
# local | openai | groq | openrouter | ollama | anthropic | gemini
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "local").lower()
LLM_MODEL: str = os.getenv("LLM_MODEL", "")
LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "")
LLM_TIMEOUT: float = float(os.getenv("LLM_TIMEOUT", "20"))

if not SECRET_KEY:
    raise ValueError("La variable de entorno SECRET_KEY no está definida")
