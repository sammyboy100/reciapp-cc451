from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func
from app.models.base import Base


class PerfilUsuario(Base):
    """Perfil persistente que se actualiza con el uso (personalización continua)."""
    __tablename__ = "perfiles_usuario"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), unique=True, nullable=False, index=True)
    datos = Column(JSON, nullable=False, default=dict)
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EventoInteraccion(Base):
    """Bitácora de eventos de uso: alimenta el perfil y sirve para métricas de usabilidad."""
    __tablename__ = "eventos_interaccion"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(String(40), nullable=False)
    datos = Column(JSON, nullable=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
