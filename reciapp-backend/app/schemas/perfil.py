from typing import Literal

from pydantic import BaseModel, Field


class PreferenciasUpdate(BaseModel):
    voz_activada: bool | None = None
    lectura_automatica: bool | None = None
    velocidad_voz: float | None = Field(default=None, ge=0.6, le=1.4)
    usar_velocidad_adaptativa: bool | None = None
    tamano_fuente: Literal["normal", "grande", "muy_grande"] | None = None
    alto_contraste: bool | None = None
    reducir_movimiento: bool | None = None
    tono_preferido: Literal["auto", "amigable", "formal", "celebratorio"] | None = None
    modo_simple: bool | None = None
    notificaciones: bool | None = None


TipoEvento = Literal["solicitud_creada", "paso_completado", "error", "emocion", "interaccion"]


class EventoIn(BaseModel):
    tipo: TipoEvento
    datos: dict = Field(default_factory=dict)


class PerfilOut(BaseModel):
    usuario_id: int
    preferencias: dict
    aprendido: dict
    errores: dict
    emociones: dict
    derivado: dict
