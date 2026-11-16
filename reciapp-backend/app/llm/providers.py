"""Implementaciones concretas de LLMProvider.

- LocalReglasProvider : offline, determinista, sin API key (por defecto).
- OpenAICompatProvider: OpenAI, Groq, OpenRouter, Ollama, LM Studio, vLLM
                        (cualquier servidor con /v1/chat/completions).
- AnthropicProvider   : API Messages de Anthropic (Claude).
- GeminiProvider      : API generateContent de Google Gemini.
"""
from __future__ import annotations

import json
import time

import httpx

from app.llm import nlu
from app.llm.base import LLMError, LLMProvider, Mensaje, RespuestaLLM


class LocalReglasProvider(LLMProvider):
    """'LLM' local basado en reglas: devuelve el mismo JSON que se le pide a
    los modelos remotos, para que el resto del sistema no note la diferencia."""
    nombre = "local"

    def completar(self, mensajes, temperatura=0.4, max_tokens=500, json_mode=True):
        t0 = time.perf_counter()
        ultimo = next((m.contenido for m in reversed(mensajes) if m.rol == "user"), "")
        analisis = nlu.analizar(ultimo)
        payload = {
            "intencion": analisis["intencion"],
            "slots": analisis["slots"],
            "emocion": analisis["emocion"],
            "respuesta": None,   # el servicio redacta con plantillas según el tono
        }
        return RespuestaLLM(texto=json.dumps(payload, ensure_ascii=False), proveedor=self.nombre,
                            modelo=self.modelo or "reglas-es-pe-v1",
                            latencia_ms=int((time.perf_counter() - t0) * 1000))


class OpenAICompatProvider(LLMProvider):
    nombre = "openai"

    def completar(self, mensajes, temperatura=0.4, max_tokens=500, json_mode=True):
        url = (self.base_url or "https://api.openai.com/v1") + "/chat/completions"
        body = {
            "model": self.modelo or "gpt-4o-mini",
            "messages": [{"role": m.rol, "content": m.contenido} for m in mensajes],
            "temperature": temperatura,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        t0 = time.perf_counter()
        try:
            r = httpx.post(url, json=body, headers=headers, timeout=self.timeout)
            r.raise_for_status()
            texto = r.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise LLMError(f"{self.nombre}: {exc}") from exc
        return RespuestaLLM(texto=texto, proveedor=self.nombre, modelo=body["model"],
                            latencia_ms=int((time.perf_counter() - t0) * 1000))


class OllamaProvider(OpenAICompatProvider):
    """Ollama expone /v1/chat/completions compatible con OpenAI."""
    nombre = "ollama"

    def completar(self, mensajes, temperatura=0.4, max_tokens=500, json_mode=True):
        if not self.base_url:
            self.base_url = "http://localhost:11434/v1"
        if not self.modelo:
            self.modelo = "llama3.2:3b"
        return super().completar(mensajes, temperatura, max_tokens, json_mode)


class AnthropicProvider(LLMProvider):
    nombre = "anthropic"

    def completar(self, mensajes, temperatura=0.4, max_tokens=500, json_mode=True):
        url = (self.base_url or "https://api.anthropic.com") + "/v1/messages"
        system = "\n\n".join(m.contenido for m in mensajes if m.rol == "system")
        body = {
            "model": self.modelo or "claude-haiku-5-5",
            "max_tokens": max_tokens,
            "temperature": temperatura,
            "system": system,
            "messages": [{"role": m.rol, "content": m.contenido} for m in mensajes if m.rol != "system"],
        }
        headers = {"x-api-key": self.api_key, "anthropic-version": "2023-06-01",
                   "content-type": "application/json"}
        t0 = time.perf_counter()
        try:
            r = httpx.post(url, json=body, headers=headers, timeout=self.timeout)
            r.raise_for_status()
            texto = "".join(b.get("text", "") for b in r.json()["content"] if b.get("type") == "text")
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise LLMError(f"anthropic: {exc}") from exc
        return RespuestaLLM(texto=texto, proveedor=self.nombre, modelo=body["model"],
                            latencia_ms=int((time.perf_counter() - t0) * 1000))


class GeminiProvider(LLMProvider):
    nombre = "gemini"

    def completar(self, mensajes, temperatura=0.4, max_tokens=500, json_mode=True):
        modelo = self.modelo or "gemini-2.0-flash"
        base = self.base_url or "https://generativelanguage.googleapis.com/v1beta"
        url = f"{base}/models/{modelo}:generateContent?key={self.api_key}"
        system = "\n\n".join(m.contenido for m in mensajes if m.rol == "system")
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {"role": "model" if m.rol == "assistant" else "user", "parts": [{"text": m.contenido}]}
                for m in mensajes if m.rol != "system"
            ],
            "generationConfig": {"temperature": temperatura, "maxOutputTokens": max_tokens,
                                 **({"responseMimeType": "application/json"} if json_mode else {})},
        }
        t0 = time.perf_counter()
        try:
            r = httpx.post(url, json=body, timeout=self.timeout)
            r.raise_for_status()
            texto = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise LLMError(f"gemini: {exc}") from exc
        return RespuestaLLM(texto=texto, proveedor=self.nombre, modelo=modelo,
                            latencia_ms=int((time.perf_counter() - t0) * 1000))


REGISTRO: dict[str, type[LLMProvider]] = {
    "local": LocalReglasProvider,
    "mock": LocalReglasProvider,
    "openai": OpenAICompatProvider,
    "groq": OpenAICompatProvider,
    "openrouter": OpenAICompatProvider,
    "ollama": OllamaProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
}

URL_POR_DEFECTO = {
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
}
