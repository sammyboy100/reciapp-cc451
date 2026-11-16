"""Asistente conversacional (voz/texto) sobre la capa de abstracción LLM."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import Usuario
from app.schemas.asistente import ChatIn, ChatOut
from app.services import asistente

router = APIRouter()


@router.post("/chat", response_model=ChatOut, summary="Enviar un mensaje (dictado o escrito) a Reci")
def chat(data: ChatIn, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    return asistente.responder(db, user, data.mensaje, data.canal,
                               [h.model_dump() for h in data.historial], data.borrador)


@router.get("/proveedor", summary="Proveedor LLM activo (para mostrarlo en la UI)")
def proveedor(_: Usuario = Depends(get_current_user)):
    return asistente.info_proveedor()
