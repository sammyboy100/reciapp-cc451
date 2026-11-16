"""Jornadas de recojo compartidas dentro de una sala (colaboración multiusuario)."""
from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.db.session import get_db
from app.models.jornada import JornadaSala, ParticipanteJornada
from app.models.sala import Sala
from app.models.user import Usuario
from app.schemas.jornada import JornadaCreate, ParticiparIn
from app.services import jornadas as svc
from app.services import salas as salas_svc

router = APIRouter()
FRANJA = {"manana": "mañana", "tarde": "tarde", "noche": "noche"}


def _contexto(db: Session, sala_id: int, user: Usuario) -> Sala:
    sala = db.get(Sala, sala_id)
    if not sala:
        raise HTTPException(404, "Sala no encontrada")
    if not salas_svc.es_miembro(db, sala_id, user.id):
        raise HTTPException(403, "Únete a la sala para participar")
    return sala


def _jornada(db: Session, sala_id: int, jid: int) -> JornadaSala:
    j = db.query(JornadaSala).filter_by(id=jid, sala_id=sala_id).first()
    if not j:
        raise HTTPException(404, "Jornada no encontrada")
    return j


@router.get("/{sala_id}/jornadas", summary="Jornadas de la sala")
def listar(sala_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    _contexto(db, sala_id, user)
    js = db.query(JornadaSala).filter(JornadaSala.sala_id == sala_id).order_by(JornadaSala.fecha).all()
    return [svc.resumen(db, j, user.id) for j in js]


@router.post("/{sala_id}/jornadas", status_code=201, summary="Crear jornada de recojo compartida")
def crear(sala_id: int, data: JornadaCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    sala = _contexto(db, sala_id, user)
    j = JornadaSala(sala_id=sala_id, creador_id=user.id, **data.model_dump())
    db.add(j)
    db.commit()
    db.refresh(j)
    svc.avisar(db, sala, j, f"{user.nombre.split(' ')[0]} organizó «{j.titulo}» el {j.fecha} en la "
                            f"{FRANJA[j.franja_horaria]} · {j.punto_encuentro}. ¡Súmate! 📅")
    return svc.resumen(db, j, user.id)


@router.post("/{sala_id}/jornadas/{jid}/participar", summary="Sumarme (o actualizar mi aporte)")
def participar(sala_id: int, jid: int, data: ParticiparIn, db: Session = Depends(get_db),
               user: Usuario = Depends(get_current_user)):
    sala = _contexto(db, sala_id, user)
    j = _jornada(db, sala_id, jid)
    if j.estado not in ("abierta", "asignada"):
        raise HTTPException(409, "La jornada ya no acepta participantes")
    p = db.query(ParticipanteJornada).filter_by(jornada_id=jid, usuario_id=user.id).first()
    nuevo = p is None
    if nuevo:
        p = ParticipanteJornada(jornada_id=jid, usuario_id=user.id, **data.model_dump())
        db.add(p)
    else:
        p.tipo_residuo, p.cantidad_kg = data.tipo_residuo, data.cantidad_kg
    db.commit()
    if nuevo:
        svc.avisar(db, sala, j, f"{user.nombre.split(' ')[0]} se sumó a «{j.titulo}» con {data.cantidad_kg:g} kg 🙌")
    return svc.resumen(db, j, user.id)


@router.delete("/{sala_id}/jornadas/{jid}/participar", summary="Retirarme de la jornada")
def retirarse(sala_id: int, jid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    _contexto(db, sala_id, user)
    j = _jornada(db, sala_id, jid)
    p = db.query(ParticipanteJornada).filter_by(jornada_id=jid, usuario_id=user.id).first()
    if p and j.estado in ("abierta", "asignada"):
        db.delete(p)
        db.commit()
    return svc.resumen(db, j, user.id)


@router.post("/{sala_id}/jornadas/{jid}/tomar", summary="Reciclador: tomar la jornada")
def tomar(sala_id: int, jid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    sala = _contexto(db, sala_id, user)
    if user.rol != "reciclador":
        raise HTTPException(403, "Solo un reciclador puede tomar la jornada")
    j = _jornada(db, sala_id, jid)
    if j.estado != "abierta":
        raise HTTPException(409, "La jornada ya tiene reciclador")
    j.estado, j.reciclador_id = "asignada", user.id
    db.commit()
    svc.avisar(db, sala, j, f"{user.nombre.split(' ')[0]} recogerá «{j.titulo}» 🚲")
    return svc.resumen(db, j, user.id)


@router.post("/{sala_id}/jornadas/{jid}/completar", summary="Reciclador asignado: marcar como completada")
def completar(sala_id: int, jid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    sala = _contexto(db, sala_id, user)
    j = _jornada(db, sala_id, jid)
    if j.reciclador_id != user.id:
        raise HTTPException(403, "Solo el reciclador asignado puede completarla")
    if j.estado != "asignada":
        raise HTTPException(409, "La jornada no está asignada")
    if not db.query(ParticipanteJornada).filter_by(jornada_id=jid).count():
        raise HTTPException(409, "La jornada no tiene participantes")
    svc.completar(db, sala, j)
    return svc.resumen(db, j, user.id)
