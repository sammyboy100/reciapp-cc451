"""Personalización continua: el perfil se actualiza con cada uso.

El perfil es un dict JSON con cuatro bloques:
  preferencias : lo que el usuario elige explícitamente (accesibilidad, voz, tono)
  aprendido    : lo que el sistema infiere del uso (materiales, franja, ritmo, canal)
  errores      : conteos por contexto + marcas de tiempo recientes
  emociones    : historial de emociones declaradas o inferidas

`aplicar_evento` es una función pura (perfil, evento) -> perfil nuevo, así que
todo el comportamiento adaptativo es testeable sin base de datos.
"""
from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone

ALFA_EMA = 0.3                  # peso del dato nuevo en promedios móviles
VENTANA_FRUSTRACION_MIN = 5     # errores dentro de esta ventana…
UMBRAL_FRUSTRACION = 3          # …a partir de este número => frustración inferida
MAX_HISTORIAL = 30

EMOCIONES_VALIDAS = {"alegria", "calma", "frustracion", "ansiedad", "tristeza", "cansancio"}

TONO_POR_EMOCION = {
    "frustracion": "empatico",
    "ansiedad": "directo",
    "tristeza": "calido",
    "cansancio": "calido",
    "alegria": "celebratorio",
    "calma": "amigable",
}


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def perfil_por_defecto() -> dict:
    return {
        "version": 1,
        "preferencias": {
            "voz_activada": True,          # mostrar micrófono y asistente
            "lectura_automatica": False,   # el asistente lee en voz alta sus respuestas
            "velocidad_voz": None,         # None = adaptativa; si no, 0.6–1.4
            "tamano_fuente": "normal",     # normal | grande | muy_grande
            "alto_contraste": False,
            "reducir_movimiento": False,
            "tono_preferido": "auto",      # auto | amigable | formal | celebratorio
            "modo_simple": False,          # menos opciones por pantalla
            "notificaciones": False,       # avisos del sistema operativo (PWA)
            "idioma": "es-PE",
        },
        "aprendido": {
            "materiales": {},              # material -> veces solicitado
            "franjas": {},                 # franja -> veces elegida
            "direccion_habitual": None,
            "coords_habituales": None,
            "kg_promedio": None,
            "seg_por_solicitud": None,     # ritmo: EMA del tiempo para crear una solicitud
            "seg_por_paso": None,          # ritmo: EMA del tiempo por paso del asistente
            "canal": {"voz": 0, "texto": 0, "tactil": 0},
            "interacciones": 0,
            "ultima_actividad": None,
        },
        "errores": {"total": 0, "por_contexto": {}, "recientes": []},
        "emociones": {"actual": None, "fuente": None, "historial": []},
    }


def _fusionar(base: dict, extra: dict) -> dict:
    """Completa claves nuevas del esquema sin pisar datos existentes."""
    out = copy.deepcopy(base)
    for k, v in (extra or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _fusionar(out[k], v)
        else:
            out[k] = v
    return out


def normalizar(perfil: dict | None) -> dict:
    return _fusionar(perfil_por_defecto(), perfil or {})


def _ema(previo: float | None, nuevo: float) -> float:
    return round(nuevo if previo is None else (1 - ALFA_EMA) * previo + ALFA_EMA * nuevo, 2)


def _registrar_emocion(p: dict, emocion: str, fuente: str, momento: datetime) -> None:
    if emocion not in EMOCIONES_VALIDAS:
        return
    p["emociones"]["actual"] = emocion
    p["emociones"]["fuente"] = fuente
    p["emociones"]["historial"].append({"emocion": emocion, "fuente": fuente, "t": momento.isoformat()})
    p["emociones"]["historial"] = p["emociones"]["historial"][-MAX_HISTORIAL:]


def aplicar_evento(perfil: dict | None, evento: dict, momento: datetime | None = None) -> dict:
    """Devuelve un perfil nuevo con el evento aplicado."""
    p = normalizar(perfil)
    momento = momento or _ahora()
    tipo = evento.get("tipo")
    d = evento.get("datos") or {}
    ap = p["aprendido"]

    canal = d.get("canal")
    if canal in ap["canal"]:
        ap["canal"][canal] += 1
    ap["interacciones"] += 1
    ap["ultima_actividad"] = momento.isoformat()

    if tipo == "solicitud_creada":
        for mat in d.get("tipos") or ([d["tipo_residuo"]] if d.get("tipo_residuo") else []):
            ap["materiales"][mat] = ap["materiales"].get(mat, 0) + 1
        if d.get("franja_horaria"):
            f = d["franja_horaria"]
            ap["franjas"][f] = ap["franjas"].get(f, 0) + 1
        if d.get("direccion"):
            ap["direccion_habitual"] = d["direccion"]
        if d.get("latitud") is not None and d.get("longitud") is not None:
            ap["coords_habituales"] = [d["latitud"], d["longitud"]]
        if d.get("cantidad_kg"):
            ap["kg_promedio"] = _ema(ap["kg_promedio"], float(d["cantidad_kg"]))
        if d.get("duracion_seg"):
            ap["seg_por_solicitud"] = _ema(ap["seg_por_solicitud"], float(d["duracion_seg"]))
        # Completar una tarea con éxito "enfría" la frustración
        if p["emociones"]["actual"] == "frustracion" and p["emociones"]["fuente"] == "inferida":
            _registrar_emocion(p, "calma", "inferida", momento)

    elif tipo == "paso_completado":
        if d.get("duracion_seg"):
            ap["seg_por_paso"] = _ema(ap["seg_por_paso"], float(d["duracion_seg"]))

    elif tipo == "error":
        ctx = d.get("contexto", "general")
        e = p["errores"]
        e["total"] += 1
        e["por_contexto"][ctx] = e["por_contexto"].get(ctx, 0) + 1
        limite = momento - timedelta(minutes=VENTANA_FRUSTRACION_MIN)
        e["recientes"] = [t for t in e["recientes"] if datetime.fromisoformat(t) >= limite]
        e["recientes"].append(momento.isoformat())
        if len(e["recientes"]) >= UMBRAL_FRUSTRACION:
            _registrar_emocion(p, "frustracion", "inferida", momento)

    elif tipo == "emocion":
        _registrar_emocion(p, d.get("emocion", ""), d.get("fuente", "declarada"), momento)

    elif tipo == "preferencias":
        for k, v in d.items():
            if k in p["preferencias"]:
                p["preferencias"][k] = v

    return p


# ── Derivados que consume el frontend y el asistente ─────────────────────────

def _top(conteos: dict) -> str | None:
    return max(conteos.items(), key=lambda kv: kv[1])[0] if conteos else None


def derivar(perfil: dict | None) -> dict:
    p = normalizar(perfil)
    ap, pref = p["aprendido"], p["preferencias"]
    emocion = p["emociones"]["actual"]

    tono = pref["tono_preferido"]
    if tono == "auto":
        tono = TONO_POR_EMOCION.get(emocion or "", "amigable")

    # Ritmo: < 45 s por solicitud = rápido, > 120 s = pausado
    seg = ap["seg_por_solicitud"]
    ritmo = "normal" if seg is None else "rapido" if seg < 45 else "pausado" if seg > 120 else "normal"

    velocidad = pref["velocidad_voz"]
    if velocidad is None:
        velocidad = {"rapido": 1.1, "normal": 1.0, "pausado": 0.88}[ritmo]
        if emocion in {"frustracion", "tristeza", "cansancio"}:
            velocidad = min(velocidad, 0.92)

    errores_recientes = len(p["errores"]["recientes"])
    nivel_guia = "guiado" if (pref["modo_simple"] or ritmo == "pausado" or errores_recientes >= 2) else (
        "experto" if ritmo == "rapido" and p["errores"]["total"] <= 2 else "estandar")

    canal = ap["canal"]
    canal_preferido = _top({k: v for k, v in canal.items() if v}) or "tactil"

    return {
        "tono_asistente": tono,
        "ritmo": ritmo,
        "velocidad_voz": round(float(velocidad), 2),
        "nivel_guia": nivel_guia,
        "material_frecuente": _top(ap["materiales"]),
        "franja_preferida": _top(ap["franjas"]),
        "direccion_habitual": ap["direccion_habitual"],
        "coords_habituales": ap["coords_habituales"],
        "kg_sugerido": round(ap["kg_promedio"]) if ap["kg_promedio"] else None,
        "canal_preferido": canal_preferido,
        "emocion_actual": emocion,
        "sugerir_voz": canal_preferido == "voz" or pref["tamano_fuente"] != "normal",
    }
