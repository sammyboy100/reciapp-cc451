from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func
from app.models.base import Base


class Sala(Base):
    """Espacio colaborativo: vecinos, condominio, colegio o empresa con una meta común."""
    __tablename__ = "salas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), nullable=False)
    descripcion = Column(String(300), nullable=True)
    codigo = Column(String(8), unique=True, nullable=False, index=True)   # código de invitación
    tipo = Column(String(20), nullable=False, default="barrio")           # barrio|condominio|colegio|empresa
    distrito = Column(String(80), nullable=True)
    meta_kg = Column(Float, nullable=False, default=100.0)
    emoji = Column(String(8), nullable=True, default="♻️")
    publica = Column(Boolean, nullable=False, default=True)
    creador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    meta_alcanzada = Column(Boolean, nullable=False, default=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())


class MiembroSala(Base):
    __tablename__ = "miembros_sala"
    __table_args__ = (UniqueConstraint("sala_id", "usuario_id", name="uq_miembro_sala"),)

    id = Column(Integer, primary_key=True, index=True)
    sala_id = Column(Integer, ForeignKey("salas.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    rol = Column(String(20), nullable=False, default="miembro")   # anfitrion | miembro
    fecha_union = Column(DateTime(timezone=True), server_default=func.now())


class MensajeSala(Base):
    __tablename__ = "mensajes_sala"

    id = Column(Integer, primary_key=True, index=True)
    sala_id = Column(Integer, ForeignKey("salas.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)   # None = sistema
    tipo = Column(String(20), nullable=False, default="texto")              # texto|voz|sistema|logro
    contenido = Column(Text, nullable=False)
    reacciones = Column(JSON, nullable=False, default=dict)                 # emoji -> [usuario_id]
    fecha = Column(DateTime(timezone=True), server_default=func.now())
