from sqlalchemy.orm import Session

from app.models.perfil import EventoInteraccion, PerfilUsuario
from app.models.solicitud import Solicitud
from app.services import perfil_adaptativo as pa


def obtener(db: Session, usuario_id: int) -> PerfilUsuario:
    perfil = db.query(PerfilUsuario).filter(PerfilUsuario.usuario_id == usuario_id).first()
    if perfil is None:
        perfil = PerfilUsuario(usuario_id=usuario_id, datos=pa.perfil_por_defecto())
        db.add(perfil)
        db.commit()
        db.refresh(perfil)
    return perfil


def registrar_evento(db: Session, usuario_id: int, tipo: str, datos: dict | None = None) -> PerfilUsuario:
    perfil = obtener(db, usuario_id)
    # Reasignar el dict completo para que SQLAlchemy detecte el cambio en la columna JSON
    perfil.datos = pa.aplicar_evento(perfil.datos, {"tipo": tipo, "datos": datos or {}})
    db.add(EventoInteraccion(usuario_id=usuario_id, tipo=tipo, datos=datos or {}))
    db.commit()
    db.refresh(perfil)
    return perfil


def solicitudes_completadas(db: Session, usuario_id: int, rol: str) -> list[dict]:
    q = db.query(Solicitud).filter(Solicitud.estado == "completada")
    q = q.filter(Solicitud.reciclador_id == usuario_id) if rol == "reciclador" else q.filter(
        Solicitud.ciudadano_id == usuario_id)
    return [{"tipo_residuo": s.tipo_residuo, "cantidad_kg": s.cantidad_kg,
             "fecha": s.fecha_recoleccion} for s in q.all()]
