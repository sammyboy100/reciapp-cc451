"""Salas colaborativas: crear, unirse por código, ranking, chat y reacciones en vivo."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.db.session import get_db
from app.models.sala import MensajeSala, MiembroSala, Sala
from app.models.user import Usuario
from app.schemas.sala import MensajeIn, MensajeOut, ReaccionIn, SalaCreate, SalaDetalleOut, SalaOut, UnirseIn
from app.services import salas as svc
from app.websockets.manager import manager

router = APIRouter()


def _sala_o_404(db: Session, sala_id: int) -> Sala:
    sala = db.get(Sala, sala_id)
    if not sala:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    return sala


def _exigir_miembro(db: Session, sala_id: int, user: Usuario) -> None:
    if not svc.es_miembro(db, sala_id, user.id):
        raise HTTPException(status_code=403, detail="Únete a la sala para participar")


@router.get("", response_model=list[SalaOut], summary="Mis salas")
def mis_salas(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    salas = (db.query(Sala).join(MiembroSala, MiembroSala.sala_id == Sala.id)
             .filter(MiembroSala.usuario_id == user.id).order_by(Sala.fecha_creacion.desc()).all())
    return [svc.resumen(db, s, user.id) for s in salas]


@router.get("/explorar", response_model=list[SalaOut], summary="Salas públicas para unirse")
def explorar(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    salas = db.query(Sala).filter(Sala.publica == True).order_by(Sala.fecha_creacion.desc()).limit(30).all()  # noqa: E712
    return [svc.resumen(db, s, user.id) for s in salas]


@router.post("", response_model=SalaOut, status_code=status.HTTP_201_CREATED, summary="Crear sala")
def crear(data: SalaCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    sala = Sala(**data.model_dump(), codigo=svc.generar_codigo(db), creador_id=user.id)
    db.add(sala)
    db.commit()
    db.refresh(sala)
    db.add(MiembroSala(sala_id=sala.id, usuario_id=user.id, rol="anfitrion"))
    db.commit()
    svc.publicar(db, sala, f"{user.nombre.split(' ')[0]} creó la sala. ¡Comparte el código {sala.codigo}!", "sistema")
    return svc.resumen(db, sala, user.id)


@router.post("/unirse", response_model=SalaOut, summary="Unirse con código de invitación")
def unirse_por_codigo(data: UnirseIn, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    sala = db.query(Sala).filter(Sala.codigo == data.codigo.strip().upper()).first()
    if not sala:
        raise HTTPException(status_code=404, detail="Código no válido. Revisa mayúsculas y números.")
    return _unir(db, sala, user)


@router.post("/{sala_id}/unirse", response_model=SalaOut, summary="Unirse a una sala pública")
def unirse(sala_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    sala = _sala_o_404(db, sala_id)
    if not sala.publica:
        raise HTTPException(status_code=403, detail="Sala privada: necesitas el código de invitación")
    return _unir(db, sala, user)


def _unir(db: Session, sala: Sala, user: Usuario):
    if not svc.es_miembro(db, sala.id, user.id):
        db.add(MiembroSala(sala_id=sala.id, usuario_id=user.id, rol="miembro"))
        db.commit()
        svc.publicar(db, sala, f"{user.nombre.split(' ')[0]} se unió a la sala 👋", "sistema")
    return svc.resumen(db, sala, user.id)


@router.delete("/{sala_id}/miembros/me", status_code=204, summary="Salir de la sala")
def salir(sala_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    m = db.query(MiembroSala).filter_by(sala_id=sala_id, usuario_id=user.id).first()
    if m:
        db.delete(m)
        db.commit()


@router.get("/{sala_id}", response_model=SalaDetalleOut, summary="Detalle: meta, ranking y chat")
def detalle(sala_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    sala = _sala_o_404(db, sala_id)
    if not sala.publica:
        _exigir_miembro(db, sala_id, user)
    aportes = svc.aportes_por_miembro(db, sala)
    filas = (db.query(MiembroSala, Usuario).join(Usuario, Usuario.id == MiembroSala.usuario_id)
             .filter(MiembroSala.sala_id == sala_id).all())
    nombres = {u.id: u.nombre for _, u in filas}
    miembros = sorted([
        {"usuario_id": u.id, "nombre": u.nombre, "rol_app": u.rol, "rol_sala": m.rol,
         "kg_aportados": round(aportes.get(u.id, (0, 0))[0], 1), "recolecciones": aportes.get(u.id, (0, 0))[1],
         "en_linea": manager.is_connected(u.id)}
        for m, u in filas], key=lambda x: -x["kg_aportados"])
    mensajes = (db.query(MensajeSala).filter(MensajeSala.sala_id == sala_id)
                .order_by(MensajeSala.id.desc()).limit(60).all())
    return {**svc.resumen(db, sala, user.id), "miembros": miembros,
            "mensajes": [svc.mensaje_out(db, m, nombres) for m in reversed(mensajes)]}


@router.post("/{sala_id}/mensajes", response_model=MensajeOut, status_code=201, summary="Enviar mensaje (texto o dictado)")
def enviar_mensaje(sala_id: int, data: MensajeIn, db: Session = Depends(get_db),
                   user: Usuario = Depends(get_current_user)):
    sala = _sala_o_404(db, sala_id)
    _exigir_miembro(db, sala_id, user)
    m = svc.publicar(db, sala, data.contenido.strip(), data.tipo, user.id)
    return svc.mensaje_out(db, m, {user.id: user.nombre})


@router.post("/{sala_id}/mensajes/{mensaje_id}/reacciones", response_model=MensajeOut,
             summary="Reaccionar (toggle) a un mensaje")
def reaccionar(sala_id: int, mensaje_id: int, data: ReaccionIn, db: Session = Depends(get_db),
               user: Usuario = Depends(get_current_user)):
    _exigir_miembro(db, sala_id, user)
    m = db.query(MensajeSala).filter_by(id=mensaje_id, sala_id=sala_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    reac = {k: list(v) for k, v in (m.reacciones or {}).items()}
    lista = reac.setdefault(data.emoji, [])
    if user.id in lista:
        lista.remove(user.id)
    else:
        lista.append(user.id)
    m.reacciones = {k: v for k, v in reac.items() if v}
    db.commit()
    db.refresh(m)
    out = svc.mensaje_out(db, m)
    svc.difundir(db, sala_id, {"tipo": "sala_reaccion", "sala_id": sala_id, "mensaje": out})
    return out
