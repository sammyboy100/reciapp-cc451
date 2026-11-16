"""Mide la precisión del NLU local sobre datos_simulados/corpus_nlu.json.

Uso:  python -m app.evaluacion_nlu            (imprime el reporte)
      python -m app.evaluacion_nlu --markdown  (además escribe ../docs/evaluacion-nlu.md)

La fecha de referencia es un lunes fijo para que «el viernes» o «mañana» sean deterministas.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

from app.llm import nlu

RAIZ = Path(__file__).resolve().parent.parent
LUNES = date(2026, 11, 9)


def evaluar(conjunto: str | None = None) -> dict:
    corpus = json.loads((RAIZ / "datos_simulados" / "corpus_nlu.json").read_text(encoding="utf-8"))["frases"]
    if conjunto:
        corpus = [c for c in corpus if c.get("conjunto") == conjunto]
    filas, ok_int, slots_ok, slots_tot = [], 0, 0, 0
    por_int: dict[str, list[int]] = {}
    for c in corpus:
        a = nlu.analizar(c["frase"], hoy=LUNES)
        acierto = a["intencion"] == c["intencion"]
        ok_int += acierto
        por_int.setdefault(c["intencion"], [0, 0])
        por_int[c["intencion"]][0] += acierto
        por_int[c["intencion"]][1] += 1
        fallos = []
        for k, v in c["slots"].items():
            slots_tot += 1
            got = a["slots"].get(k)
            if got == v:
                slots_ok += 1
            else:
                fallos.append(f"{k}: esperado {v}, obtenido {got}")
        filas.append({"id": c["id"], "frase": c["frase"], "esperada": c["intencion"], "obtenida": a["intencion"],
                      "ok": acierto, "fallos_slots": fallos})
    return {
        "n": len(corpus),
        "precision_intencion": round(ok_int / len(corpus), 3),
        "precision_slots": round(slots_ok / slots_tot, 3) if slots_tot else None,
        "slots_evaluados": slots_tot,
        "por_intencion": {k: f"{v[0]}/{v[1]}" for k, v in sorted(por_int.items())},
        "errores": [f for f in filas if not f["ok"] or f["fallos_slots"]],
    }


def markdown(r: dict, dev: dict, prueba: dict, v1: dict | None = None) -> str:
    lin = [
        "# Evaluación del NLU de Reci", "",
        f"Corpus: **{r['n']} frases** etiquetadas a mano (`reciapp-backend/datos_simulados/corpus_nlu.json`): "
        f"{dev['n']} de **desarrollo** (usadas para ajustar las reglas) y {prueba['n']} de **prueba** (escritas aparte, nunca usadas para ajustar).", "",
        "| Conjunto | Precisión de intención | Precisión de slots |", "|---|---|---|",
        *([f"| Desarrollo, versión 1 (antes de ajustar) | {v1['precision_intencion'] * 100:.1f} % | {v1['precision_slots'] * 100:.1f} % |"] if v1 else []),
        f"| Desarrollo, versión 2 (después de ajustar) | {dev['precision_intencion'] * 100:.1f} % | {dev['precision_slots'] * 100:.1f} % |",
        f"| **Prueba (generalización)** | **{prueba['precision_intencion'] * 100:.1f} %** | **{prueba['precision_slots'] * 100:.1f} %** |", "",
        "La cifra que cuenta para el criterio de usabilidad (≥ 85 %) es la del conjunto de **prueba**.", "",
        "## Total (80 frases)", "",
        "| Métrica | Resultado | Meta (criterio de usabilidad) |", "|---|---|---|",
        f"| Precisión de intención | **{r['precision_intencion'] * 100:.1f} %** | ≥ 85 % |",
        f"| Precisión de slots ({r['slots_evaluados']} slots) | **{r['precision_slots'] * 100:.1f} %** | — |", "",
        "## Por intención", "", "| Intención | Aciertos |", "|---|---|",
        *[f"| {k} | {v} |" for k, v in r["por_intencion"].items()], "",
        "## Casos con error", "",
    ]
    if not r["errores"]:
        lin.append("Ninguno.")
    for e in r["errores"]:
        det = "; ".join(e["fallos_slots"]) or ""
        lin.append(f"- #{e['id']} «{e['frase']}» → esperada `{e['esperada']}`, obtenida `{e['obtenida']}`"
                   + (f" · {det}" if det else ""))
    lin += ["", "Reproducir: `cd reciapp-backend && python -m app.evaluacion_nlu --markdown`"]
    return "\n".join(lin) + "\n"


if __name__ == "__main__":
    r = evaluar()
    print(json.dumps({k: v for k, v in r.items() if k != "errores"}, ensure_ascii=False, indent=2))
    for e in r["errores"]:
        print("✗", e["id"], e["frase"], "→", e["obtenida"], e["fallos_slots"])
    if "--markdown" in sys.argv:
        v1p = RAIZ / "datos_simulados" / "evaluacion_nlu_v1.json"
        v1 = json.loads(v1p.read_text(encoding="utf-8")) if v1p.exists() else None
        md = markdown(r, evaluar("desarrollo"), evaluar("prueba"), v1)
        (RAIZ.parent / "docs" / "evaluacion-nlu.md").write_text(md, encoding="utf-8")
