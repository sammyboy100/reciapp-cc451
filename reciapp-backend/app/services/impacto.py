"""Impacto ambiental estimado (nivel reflexivo del diseño emocional).

Factores aproximados de emisiones evitadas por kg reciclado (kg CO2e/kg),
redondeados de referencias habituales de la EPA (WARM) y del MINAM.
Se muestran al usuario siempre como "estimado".
"""
from __future__ import annotations

CO2_EVITADO_POR_KG = {
    "plastico": 1.5, "papel": 0.9, "carton": 0.9, "vidrio": 0.3,
    "metal": 4.0, "organico": 0.2, "electronicos": 2.0,
}
CO2_POR_ARBOL_ANIO = 21.0   # kg CO2 que absorbe un árbol adulto en un año

NIVELES = [  # (kg mínimos, nombre, mensaje)
    (0, "Semilla", "Todo gran bosque empezó así."),
    (10, "Brote", "Ya se nota tu huella verde."),
    (50, "Árbol", "Tu barrio respira mejor gracias a ti."),
    (150, "Bosque", "Eres referente de reciclaje en tu comunidad."),
]


def nivel_para(kg: float) -> dict:
    actual = NIVELES[0]
    siguiente = None
    for i, n in enumerate(NIVELES):
        if kg >= n[0]:
            actual = n
            siguiente = NIVELES[i + 1] if i + 1 < len(NIVELES) else None
    progreso = 1.0 if not siguiente else (kg - actual[0]) / (siguiente[0] - actual[0])
    return {
        "nombre": actual[1], "mensaje": actual[2],
        "siguiente": siguiente[1] if siguiente else None,
        "kg_para_siguiente": round(siguiente[0] - kg, 1) if siguiente else 0,
        "progreso": round(min(max(progreso, 0), 1), 3),
    }


def calcular(solicitudes_completadas: list[dict]) -> dict:
    """solicitudes_completadas: [{tipo_residuo, cantidad_kg, fecha}]"""
    kg_total = sum(s["cantidad_kg"] for s in solicitudes_completadas)
    por_material: dict[str, float] = {}
    for s in solicitudes_completadas:
        por_material[s["tipo_residuo"]] = por_material.get(s["tipo_residuo"], 0) + s["cantidad_kg"]
    co2 = sum(CO2_EVITADO_POR_KG.get(m, 0.5) * kg for m, kg in por_material.items())
    return {
        "kg_total": round(kg_total, 1),
        "recolecciones": len(solicitudes_completadas),
        "co2_evitado_kg": round(co2, 1),
        "arboles_equivalentes": round(co2 / CO2_POR_ARBOL_ANIO, 1),
        "por_material": {k: round(v, 1) for k, v in sorted(por_material.items(), key=lambda kv: -kv[1])},
        "nivel": nivel_para(kg_total),
    }
