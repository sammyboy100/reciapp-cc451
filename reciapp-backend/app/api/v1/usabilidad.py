"""Evaluación de usabilidad: encuesta SUS en la app y panel de métricas (admin)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user, require_role
from app.crud import crud_perfil
from app.db.session import get_db
from app.models.perfil import EventoInteraccion, PerfilUsuario
from app.models.sala import Sala
from app.models.solicitud import Solicitud
from app.models.usabilidad import RespuestaSUS
from app.models.user import Usuario
from app.schemas.jornada import SusIn
from app.services import perfil_adaptativo as pa
from app.services import usabilidad as svc

router = APIRouter()


@router.get("/sus/preguntas", summary="Las 10 preguntas del SUS")
def preguntas():
    return {"preguntas": svc.PREGUNTAS_SUS, "escala": ["Muy en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Muy de acuerdo"]}


@router.get("/sus/me", summary="¿Ya respondí el SUS?")
def mi_sus(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    r = db.query(RespuestaSUS).filter_by(usuario_id=user.id).order_by(RespuestaSUS.id.desc()).first()
    return {"respondido": r is not None, "puntaje": r.puntaje if r else None,
            "adjetivo": svc.adjetivo_sus(r.puntaje) if r else None}


@router.post("/sus", status_code=201, summary="Enviar respuestas del SUS")
def enviar_sus(data: SusIn, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    try:
        puntaje = svc.puntaje_sus(data.respuestas)
    except ValueError as e:
        raise HTTPException(422, str(e))
    canal = pa.derivar(crud_perfil.obtener(db, user.id).datos)["canal_preferido"]
    db.add(RespuestaSUS(usuario_id=user.id, respuestas=data.respuestas, puntaje=puntaje,
                        comentario=data.comentario, canal_principal=canal))
    db.commit()
    return {"puntaje": puntaje, "adjetivo": svc.adjetivo_sus(puntaje)}


@router.get("/metricas", summary="Panel de métricas de usabilidad y uso (admin)")
def metricas(db: Session = Depends(get_db), _: Usuario = Depends(require_role("admin"))):
    sus = db.query(RespuestaSUS).all()
    eventos = [{"tipo": e.tipo, "datos": e.datos} for e in db.query(EventoInteraccion).all()]
    emociones: dict[str, int] = {}
    for p in db.query(PerfilUsuario).all():
        emo = pa.normalizar(p.datos)["emociones"]["actual"]
        if emo:
            emociones[emo] = emociones.get(emo, 0) + 1
    por_estado = dict(db.query(Solicitud.estado, func.count()).group_by(Solicitud.estado).all())
    kg = db.query(func.coalesce(func.sum(Solicitud.cantidad_kg), 0)).filter(Solicitud.estado == "completada").scalar()
    return {
        "usuarios_por_rol": dict(db.query(Usuario.rol, func.count()).group_by(Usuario.rol).all()),
        "solicitudes_por_estado": por_estado,
        "kg_reciclados": round(float(kg or 0), 1),
        "salas": db.query(Sala).count(),
        "sus": {**svc.resumen_sus([r.puntaje for r in sus]),
                "simuladas": sum(1 for r in sus if r.simulada),
                "por_canal": {c: svc.resumen_sus([r.puntaje for r in sus if r.canal_principal == c])["promedio"]
                              for c in {r.canal_principal for r in sus if r.canal_principal}}},
        "uso": svc.agregar_eventos(eventos),
        "emociones_actuales": emociones,
    }
