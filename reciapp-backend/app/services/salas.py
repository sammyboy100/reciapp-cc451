"""Salas colaborativas (multiusuario): metas comunes, ranking y chat en vivo."""
from __future__ import annotations

import secrets
import string

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.sala import MensajeSala, MiembroSala, Sala
from app.models.solicitud import Solicitud
from app.models.user import Usuario
from app.websockets.manager import manager

_ALFABETO = string.ascii_uppercase.replace("O", "").replace("I", "") + "23456789"


def generar_codigo(db: Session) -> str:
    while True:
        codigo = "".join(secrets.choice(_ALFABETO) for _ in range(6))
        if not db.query(Sala).filter(Sala.codigo == codigo).first():
            return codigo


def miembros_ids(db: Session, sala_id: int) -> list[int]:
    return [m.usuario_id for m in db.query(MiembroSala).filter(MiembroSala.sala_id == sala_id).all()]


def es_miembro(db: Session, sala_id: int, usuario_id: int) -> bool:
    return db.query(MiembroSala).filter_by(sala_id=sala_id, usuario_id=usuario_id).first() is not None


def aportes_por_miembro(db: Session, sala: Sala) -> dict[int, tuple[float, int]]:
    """kg y nº de recolecciones completadas por cada miembro desde que existe la sala.
    Ciudadanos aportan lo que entregan; recicladores, lo que recogen."""
    ids = miembros_ids(db, sala.id)
    if not ids:
        return {}
    out: dict[int, tuple[float, int]] = {}
    filas_c = (db.query(Solicitud.ciudadano_id, func.coalesce(func.sum(Solicitud.cantidad_kg), 0), func.count())
               .filter(Solicitud.estado == "completada", Solicitud.ciudadano_id.in_(ids))
               .group_by(Solicitud.ciudadano_id).all())
    filas_r = (db.query(Solicitud.reciclador_id, func.coalesce(func.sum(Solicitud.cantidad_kg), 0), func.count())
               .filter(Solicitud.estado == "completada", Solicitud.reciclador_id.in_(ids))
               .group_by(Solicitud.reciclador_id).all())
    for uid, kg, n in list(filas_c) + list(filas_r):
        kg0, n0 = out.get(uid, (0.0, 0))
        out[uid] = (kg0 + float(kg), n0 + int(n))
    return out


def kg_sala(db: Session, sala: Sala) -> float:
    """Total de la sala sin contar doble (cada solicitud completada una vez)."""
    ids = miembros_ids(db, sala.id)
    if not ids:
        return 0.0
    total = (db.query(func.coalesce(func.sum(Solicitud.cantidad_kg), 0))
             .filter(Solicitud.estado == "completada",
                     (Solicitud.ciudadano_id.in_(ids)) | (Solicitud.reciclador_id.in_(ids)))
             .scalar())
    return round(float(total or 0), 1)


def resumen(db: Session, sala: Sala, usuario_id: int) -> dict:
    kg = kg_sala(db, sala)
    return {
        "id": sala.id, "nombre": sala.nombre, "descripcion": sala.descripcion, "codigo": sala.codigo,
        "tipo": sala.tipo, "distrito": sala.distrito, "meta_kg": sala.meta_kg, "emoji": sala.emoji,
        "publica": sala.publica, "creador_id": sala.creador_id, "kg_acumulados": kg,
        "progreso": round(min(kg / sala.meta_kg, 1.0), 3) if sala.meta_kg else 0,
        "miembros_count": len(miembros_ids(db, sala.id)),
        "soy_miembro": es_miembro(db, sala.id, usuario_id),
        "fecha_creacion": sala.fecha_creacion,
    }


def mensaje_out(db: Session, m: MensajeSala, nombres: dict[int, str] | None = None) -> dict:
    autor = None
    if m.usuario_id:
        autor = (nombres or {}).get(m.usuario_id)
        if autor is None:
            u = db.get(Usuario, m.usuario_id)
            autor = u.nombre if u else "Usuario"
    return {"id": m.id, "sala_id": m.sala_id, "usuario_id": m.usuario_id, "autor": autor, "tipo": m.tipo,
            "contenido": m.contenido, "reacciones": m.reacciones or {},
            "fecha": m.fecha.isoformat() if m.fecha else None}


def difundir(db: Session, sala_id: int, mensaje: dict, excepto: int | None = None) -> None:
    for uid in miembros_ids(db, sala_id):
        if uid != excepto:
            manager.notify_from_thread(uid, mensaje)


def publicar(db: Session, sala: Sala, contenido: str, tipo: str = "texto",
             usuario_id: int | None = None) -> MensajeSala:
    m = MensajeSala(sala_id=sala.id, usuario_id=usuario_id, tipo=tipo, contenido=contenido, reacciones={})
    db.add(m)
    db.commit()
    db.refresh(m)
    difundir(db, sala.id, {"tipo": "sala_mensaje", "sala_id": sala.id, "mensaje": mensaje_out(db, m)})
    return m


def registrar_aporte(db: Session, solicitud: Solicitud) -> None:
    """Al completarse una recolección: mensaje de logro en cada sala del ciudadano
    y, si se cruza la meta, celebración colectiva."""
    from app.llm.nlu import ETIQUETA_MATERIAL

    ciudadano = db.get(Usuario, solicitud.ciudadano_id)
    salas = (db.query(Sala).join(MiembroSala, MiembroSala.sala_id == Sala.id)
             .filter(MiembroSala.usuario_id == solicitud.ciudadano_id).all())
    for sala in salas:
        nombre = ciudadano.nombre.split(" ")[0] if ciudadano else "Un vecino"
        mat = ETIQUETA_MATERIAL.get(solicitud.tipo_residuo, solicitud.tipo_residuo)
        publicar(db, sala, f"{nombre} aportó {solicitud.cantidad_kg:g} kg de {mat} 🌱", tipo="logro")
        kg = kg_sala(db, sala)
        if not sala.meta_alcanzada and kg >= sala.meta_kg:
            sala.meta_alcanzada = True
            db.commit()
            publicar(db, sala, f"¡Meta cumplida! La sala llegó a {sala.meta_kg:g} kg. Gracias a todos 🎉", tipo="logro")
            difundir(db, sala.id, {"tipo": "sala_meta_alcanzada", "sala_id": sala.id, "meta_kg": sala.meta_kg})
