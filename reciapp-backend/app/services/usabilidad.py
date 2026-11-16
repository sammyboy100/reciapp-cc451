"""Métricas de usabilidad: SUS y agregados de la bitácora de eventos (ISO 9241-11)."""
from __future__ import annotations

from statistics import median

PREGUNTAS_SUS = [
    "Creo que me gustaría usar ReciApp con frecuencia.",
    "Encontré ReciApp innecesariamente compleja.",
    "Pensé que ReciApp era fácil de usar.",
    "Creo que necesitaría ayuda de una persona con conocimientos técnicos para usarla.",
    "Las funciones de ReciApp están bien integradas.",
    "Pensé que había demasiada inconsistencia en ReciApp.",
    "Imagino que la mayoría de personas aprendería a usar ReciApp muy rápido.",
    "Encontré ReciApp muy incómoda de usar.",
    "Me sentí muy seguro/a usando ReciApp.",
    "Necesité aprender muchas cosas antes de poder usar ReciApp.",
]


def puntaje_sus(respuestas: list[int]) -> float:
    """Ítems impares suman (r-1); pares suman (5-r); total × 2,5."""
    if len(respuestas) != 10 or any(not isinstance(r, int) or r < 1 or r > 5 for r in respuestas):
        raise ValueError("Se requieren 10 respuestas enteras entre 1 y 5")
    total = sum((r - 1) if i % 2 == 0 else (5 - r) for i, r in enumerate(respuestas))
    return total * 2.5


def adjetivo_sus(p: float) -> str:
    """Escala adjetiva de Bangor, Kortum y Miller (2009)."""
    if p >= 85.5:
        return "Excelente"
    if p >= 72.6:
        return "Bueno"
    if p >= 52.0:
        return "Aceptable"
    if p >= 39.2:
        return "Pobre"
    return "Inaceptable"


def resumen_sus(puntajes: list[float]) -> dict:
    if not puntajes:
        return {"n": 0, "promedio": None, "mediana": None, "adjetivo": None, "meta": 75, "cumple_meta": None}
    prom = round(sum(puntajes) / len(puntajes), 1)
    return {"n": len(puntajes), "promedio": prom, "mediana": round(median(puntajes), 1),
            "adjetivo": adjetivo_sus(prom), "meta": 75, "cumple_meta": prom >= 75}


def agregar_eventos(eventos: list[dict]) -> dict:
    """eventos: [{tipo, datos}] → métricas de eficiencia, errores y canal."""
    canal: dict[str, int] = {}
    errores: dict[str, int] = {}
    intenciones: dict[str, int] = {}
    duraciones: dict[str, list[float]] = {}
    for e in eventos:
        d = e.get("datos") or {}
        c = d.get("canal")
        if c:
            canal[c] = canal.get(c, 0) + 1
        if e["tipo"] == "error":
            ctx = d.get("contexto", "general")
            errores[ctx] = errores.get(ctx, 0) + 1
        elif e["tipo"] == "interaccion" and d.get("intencion"):
            intenciones[d["intencion"]] = intenciones.get(d["intencion"], 0) + 1
        elif e["tipo"] == "solicitud_creada" and d.get("duracion_seg"):
            duraciones.setdefault(d.get("canal") or "tactil", []).append(float(d["duracion_seg"]))
    creadas = sum(1 for e in eventos if e["tipo"] == "solicitud_creada")
    total_err = sum(errores.values())
    return {
        "eventos": len(eventos),
        "por_canal": dict(sorted(canal.items(), key=lambda kv: -kv[1])),
        "errores_por_contexto": dict(sorted(errores.items(), key=lambda kv: -kv[1])),
        "errores_por_solicitud": round(total_err / creadas, 2) if creadas else None,
        "intenciones": dict(sorted(intenciones.items(), key=lambda kv: -kv[1])),
        "mediana_seg_por_canal": {k: round(median(v), 1) for k, v in duraciones.items()},
        "metas": {"voz_seg": 45, "tactil_seg": 90, "errores_por_tarea": 1},
    }
