from typing import Literal

from pydantic import BaseModel, Field


class TurnoHistorial(BaseModel):
    rol: Literal["user", "assistant"]
    texto: str


class ChatIn(BaseModel):
    mensaje: str = Field(min_length=1, max_length=600)
    canal: Literal["voz", "texto"] = "texto"
    historial: list[TurnoHistorial] = Field(default_factory=list)
    borrador: dict | None = None


class ChatOut(BaseModel):
    respuesta: str
    intencion: str
    tono: str
    emocion_detectada: str | None
    borrador: dict | None
    faltantes: list[str]
    accion: dict
    sugerencias: list[str]
    velocidad_voz: float
    proveedor: str
    modelo: str
    uso_respaldo: bool
    latencia_ms: int
