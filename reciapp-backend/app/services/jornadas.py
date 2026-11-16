"""Jornadas de recojo compartidas: colaboración multiusuario dentro de una sala.

Flujo: un miembro crea la jornada → los vecinos se suman con su material y kg →
un reciclador miembro la toma → al completarla se genera una solicitud completada
por participante (cuenta para el impacto, los eco-créditos y la meta de la sala).
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.eco_creditos import calcular
from app.llm.nlu import ETIQUETA_MATERIAL
from app.models.jornada import JornadaSala, ParticipanteJornada
from app.models.sala import Sala
from app.models.solicitud import Solicitud
from app.models.user import Usuario
from app.services import salas as salas_svc


def resumen(db: Session, j: JornadaSala, usuario_id: int) -> dict:
    parts = db.query(ParticipanteJornada, Usuario).join(Usuario, Usuario.id == ParticipanteJornada.usuario_id) \
        .filter(ParticipanteJornada.jornada_id == j.id).all()
    rec = db.get(Usuario, j.reciclador_id) if j.reciclador_id else None
    return {
        "id": j.id, "sala_id": j.sala_id, "titulo": j.titulo, "fecha": j.fecha, "franja_horaria": j.franja_horaria,
        "punto_encuentro": j.punto_encuentro, "latitud": j.latitud, "longitud": j.longitud, "estado": j.estado,
        "creador_id": j.creador_id, "reciclador_id": j.reciclador_id, "reciclador": rec.nombre if rec else None,
        "participantes": [{"usuario_id": u.id, "nombre": u.nombre, "tipo_residuo": p.tipo_residuo,
                           "cantidad_kg": p.cantidad_kg} for p, u in parts],
        "kg_total": round(sum(p.cantidad_kg for p, _ in parts), 1),
        "participo": any(u.id == usuario_id for _, u in parts),
    }


def avisar(db: Session, sala: Sala, j: JornadaSala, texto: str) -> None:
    salas_svc.publicar(db, sala, texto, "sistema")
    salas_svc.difundir(db, sala.id, {"tipo": "sala_jornada", "sala_id": sala.id, "jornada_id": j.id, "estado": j.estado})


def completar(db: Session, sala: Sala, j: JornadaSala) -> int:
    """Crea una solicitud completada por participante y acredita eco-créditos."""
    parts = db.query(ParticipanteJornada).filter(ParticipanteJornada.jornada_id == j.id).all()
    for p in parts:
        db.add(Solicitud(ciudadano_id=p.usuario_id, reciclador_id=j.reciclador_id, tipo_residuo=p.tipo_residuo,
                         cantidad_kg=p.cantidad_kg, fecha_recoleccion=j.fecha, franja_horaria=j.franja_horaria,
                         direccion=j.punto_encuentro, latitud=j.latitud, longitud=j.longitud, estado="completada"))
        u = db.get(Usuario, p.usuario_id)
        if u and u.rol == "ciudadano":
            u.eco_creditos = (u.eco_creditos or 0) + calcular(p.tipo_residuo, p.cantidad_kg)
    j.estado = "completada"
    db.commit()
    kg = sum(p.cantidad_kg for p in parts)
    mats = sorted({ETIQUETA_MATERIAL.get(p.tipo_residuo, p.tipo_residuo) for p in parts})
    salas_svc.publicar(db, sala, f"Jornada «{j.titulo}» completada: {kg:g} kg de {', '.join(mats)} entre "
                                 f"{len(parts)} vecino{'s' if len(parts) != 1 else ''} 🎉", "logro")
    if not sala.meta_alcanzada and salas_svc.kg_sala(db, sala) >= sala.meta_kg:
        sala.meta_alcanzada = True
        db.commit()
        salas_svc.publicar(db, sala, f"¡Meta cumplida! La sala llegó a {sala.meta_kg:g} kg. Gracias a todos 🎉", "logro")
        salas_svc.difundir(db, sala.id, {"tipo": "sala_meta_alcanzada", "sala_id": sala.id, "meta_kg": sala.meta_kg})
    return len(parts)
