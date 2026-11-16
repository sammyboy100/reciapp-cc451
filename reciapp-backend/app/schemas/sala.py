from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SalaCreate(BaseModel):
    nombre: str = Field(min_length=3, max_length=80)
    descripcion: str | None = Field(default=None, max_length=300)
    tipo: Literal["barrio", "condominio", "colegio", "empresa"] = "barrio"
    distrito: str | None = Field(default="Puente Piedra", max_length=80)
    meta_kg: float = Field(default=100, gt=0, le=100000)
    emoji: str | None = Field(default="♻️", max_length=8)
    publica: bool = True


class UnirseIn(BaseModel):
    codigo: str = Field(min_length=4, max_length=8)


class MensajeIn(BaseModel):
    contenido: str = Field(min_length=1, max_length=500)
    tipo: Literal["texto", "voz"] = "texto"


class ReaccionIn(BaseModel):
    emoji: Literal["💚", "👏", "🎉", "💪", "♻️"]


class MiembroOut(BaseModel):
    usuario_id: int
    nombre: str
    rol_app: str
    rol_sala: str
    kg_aportados: float
    recolecciones: int
    en_linea: bool = False


class MensajeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sala_id: int
    usuario_id: int | None
    autor: str | None = None
    tipo: str
    contenido: str
    reacciones: dict
    fecha: datetime | None


class SalaOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    codigo: str
    tipo: str
    distrito: str | None
    meta_kg: float
    emoji: str | None
    publica: bool
    creador_id: int
    kg_acumulados: float
    progreso: float
    miembros_count: int
    soy_miembro: bool
    fecha_creacion: datetime | None


class SalaDetalleOut(SalaOut):
    miembros: list[MiembroOut]
    mensajes: list[MensajeOut]
