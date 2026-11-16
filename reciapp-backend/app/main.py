import asyncio
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import FRONTEND_URLS
from app.db.session import engine
from app.models.base import Base
import app.models  # noqa: F401 — registra todos los modelos en Base.metadata
from app.api.v1 import auth, users, solicitudes, evidencias, ws
from app.api.v1 import ruteo as ruteo_api
from app.api.v1 import asistente, jornadas, perfil, salas, usabilidad
from app.services.ruteo import _init_grafo as _init_ruteo
from app.websockets.manager import manager

app = FastAPI(
    title="ReciApp API",
    description=("Autenticación, solicitudes de recolección, asistente de voz con LLM intercambiable, "
                 "perfil adaptativo y salas colaborativas en tiempo real."),
    version="3.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
app.include_router(users.router, prefix="/api/usuarios", tags=["Usuarios"])
app.include_router(solicitudes.router, prefix="/api/solicitudes", tags=["Solicitudes"])
app.include_router(evidencias.router, prefix="/api/evidencias", tags=["Evidencias"])
app.include_router(ruteo_api.router, prefix="/api/ruteo", tags=["Ruteo"])
app.include_router(asistente.router, prefix="/api/asistente", tags=["Asistente (voz + LLM)"])
app.include_router(perfil.router, prefix="/api/perfil-adaptativo", tags=["Personalización continua"])
app.include_router(salas.router, prefix="/api/salas", tags=["Salas colaborativas"])
app.include_router(jornadas.router, prefix="/api/salas", tags=["Jornadas de recojo compartidas"])
app.include_router(usabilidad.router, prefix="/api/usabilidad", tags=["Evaluación de usabilidad"])
app.include_router(ws.router, tags=["WebSocket"])


@app.on_event("startup")
async def startup():
    manager.set_loop(asyncio.get_event_loop())
    threading.Thread(target=_init_ruteo, daemon=True).start()
    max_retries = 20
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            print("Tablas creadas exitosamente")
            return
        except Exception as exc:
            if attempt < max_retries - 1:
                print(f"Esperando base de datos... intento {attempt + 1}/{max_retries}: {exc}")
                await asyncio.sleep(2)
            else:
                raise


import os as _os
_os.makedirs("uploads/evidencias", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/healthcheck", tags=["Sistema"])
def healthcheck():
    from app.services.asistente import info_proveedor
    return {"status": "ok", "llm": info_proveedor()}
