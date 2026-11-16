from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func
from app.models.base import Base


class RespuestaSUS(Base):
    """Cuestionario System Usability Scale (Brooke, 1996) respondido dentro de la app."""
    __tablename__ = "respuestas_sus"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    respuestas = Column(JSON, nullable=False)           # 10 enteros 1–5
    puntaje = Column(Float, nullable=False)             # 0–100
    comentario = Column(String(500), nullable=True)
    canal_principal = Column(String(10), nullable=True)  # voz | texto | tactil
    simulada = Column(Integer, nullable=False, default=0)  # 1 = dato simulado del seed
    fecha = Column(DateTime(timezone=True), server_default=func.now())
