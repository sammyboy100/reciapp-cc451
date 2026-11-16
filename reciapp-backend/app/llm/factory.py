"""Fábrica de proveedores LLM con caída automática al modo local."""
from __future__ import annotations

import logging
from functools import lru_cache

from app.core.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_PROVIDER, LLM_TIMEOUT
from app.llm.base import LLMError, LLMProvider, Mensaje, RespuestaLLM
from app.llm.providers import REGISTRO, URL_POR_DEFECTO, LocalReglasProvider

log = logging.getLogger("reciapp.llm")


def crear_proveedor(nombre: str, modelo: str = "", api_key: str = "", base_url: str = "",
                    timeout: float = 20.0) -> LLMProvider:
    nombre = (nombre or "local").lower()
    cls = REGISTRO.get(nombre)
    if cls is None:
        raise ValueError(f"Proveedor LLM desconocido: {nombre}. Opciones: {sorted(REGISTRO)}")
    prov = cls(modelo=modelo, api_key=api_key, base_url=base_url or URL_POR_DEFECTO.get(nombre, ""),
               timeout=timeout)
    prov.nombre = "local" if nombre == "mock" else nombre
    return prov


@lru_cache(maxsize=1)
def proveedor_activo() -> LLMProvider:
    nombre = LLM_PROVIDER
    # Sin API key no tiene sentido llamar a un proveedor remoto que la exige
    if nombre in {"openai", "groq", "openrouter", "anthropic", "gemini"} and not LLM_API_KEY:
        log.warning("LLM_PROVIDER=%s sin LLM_API_KEY: se usa el proveedor local", nombre)
        nombre = "local"
    return crear_proveedor(nombre, LLM_MODEL, LLM_API_KEY, LLM_BASE_URL, LLM_TIMEOUT)


_local = LocalReglasProvider()


def completar_con_respaldo(mensajes: list[Mensaje], proveedor: LLMProvider | None = None,
                           **kw) -> tuple[RespuestaLLM, bool]:
    """Intenta con el proveedor activo; si falla, usa el local.
    Devuelve (respuesta, uso_respaldo)."""
    prov = proveedor or proveedor_activo()
    try:
        return prov.completar(mensajes, **kw), False
    except LLMError as exc:
        log.warning("LLM remoto falló, usando respaldo local: %s", exc)
        return _local.completar(mensajes, **kw), True
