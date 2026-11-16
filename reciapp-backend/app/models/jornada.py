from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func
from app.models.base import Base


class JornadaSala(Base):
    """Recojo colectivo organizado dentro de una sala: varios vecinos, un punto y un reciclador."""
    __tablename__ = "jornadas_sala"

    id = Column(Integer, primary_key=True, index=True)
    sala_id = Column(Integer, ForeignKey("salas.id"), nullable=False, index=True)
    creador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    titulo = Column(String(80), nullable=False)
    fecha = Column(String(10), nullable=False)                 # ISO yyyy-mm-dd
    franja_horaria = Column(String(10), nullable=False, default="manana")
    punto_encuentro = Column(String(200), nullable=False)
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    estado = Column(String(20), nullable=False, default="abierta")   # abierta|asignada|completada|cancelada
    reciclador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())


class ParticipanteJornada(Base):
    __tablename__ = "participantes_jornada"
    __table_args__ = (UniqueConstraint("jornada_id", "usuario_id", name="uq_participante_jornada"),)

    id = Column(Integer, primary_key=True, index=True)
    jornada_id = Column(Integer, ForeignKey("jornadas_sala.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tipo_residuo = Column(String(20), nullable=False)
    cantidad_kg = Column(Float, nullable=False)
