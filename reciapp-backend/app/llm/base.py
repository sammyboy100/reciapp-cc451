"""Contrato común para cualquier proveedor de LLM.

La aplicación solo conoce `LLMProvider.completar(mensajes)`; cambiar de
proveedor (OpenAI, Anthropic, Gemini, Groq, Ollama local o el modo offline)
es solo cambiar la variable de entorno LLM_PROVIDER.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Mensaje:
    rol: str          # "system" | "user" | "assistant"
    contenido: str


@dataclass
class RespuestaLLM:
    texto: str
    proveedor: str
    modelo: str
    latencia_ms: int = 0
    meta: dict = field(default_factory=dict)


class LLMError(RuntimeError):
    """Error recuperable: el servicio cae al proveedor local."""


class LLMProvider(ABC):
    nombre: str = "base"

    def __init__(self, modelo: str = "", api_key: str = "", base_url: str = "", timeout: float = 20.0):
        self.modelo = modelo
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    @abstractmethod
    def completar(self, mensajes: list[Mensaje], temperatura: float = 0.4,
                  max_tokens: int = 500, json_mode: bool = True) -> RespuestaLLM:
        """Devuelve el texto generado. Lanza LLMError si falla."""

    def descripcion(self) -> dict:
        return {"proveedor": self.nombre, "modelo": self.modelo, "remoto": self.nombre != "local"}
