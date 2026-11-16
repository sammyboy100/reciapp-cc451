"""Genera gantt.png. Uso: python gantt_tareas.py"""
from datetime import date, timedelta
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as md
from matplotlib.patches import Patch

E = {"Erick": "#5aa84a", "Sebastián": "#4a7fd0", "Darcy": "#e07a9a", "Giordano": "#e08a3a", "Todos": "#6b6b5e"}
CORTE = date(2026, 10, 14)
T = [  # (fase, tarea, responsable, inicio, fin)
    ("Análisis", "Análisis de stakeholders y usuarios (incl. discapacidad)", "Darcy", "2026-08-31", "2026-09-11"),
    ("Análisis", "Análisis PACT de actividades", "Erick", "2026-09-07", "2026-09-16"),
    ("Análisis", "Análisis de sistemas similares", "Sebastián", "2026-09-10", "2026-09-19"),
    ("Requerimientos", "Requerimientos funcionales y no funcionales", "Erick", "2026-09-14", "2026-09-23"),
    ("Requerimientos", "Historias de usuario y criterios de aceptación", "Giordano", "2026-09-16", "2026-09-26"),
    ("Requerimientos", "Criterios de usabilidad medibles", "Darcy", "2026-09-21", "2026-09-26"),
    ("Diseño", "3 alternativas de diseño (prototipos)", "Darcy", "2026-09-24", "2026-10-03"),
    ("Diseño", "Diseño óptimo de fidelidad media + flujo de pantallas", "Giordano", "2026-09-30", "2026-10-08"),
    ("Diseño", "Arquitectura C4", "Sebastián", "2026-09-28", "2026-10-06"),
    ("Desarrollo", "Capa de abstracción LLM + asistente Reci", "Erick", "2026-09-28", "2026-10-11"),
    ("Desarrollo", "Interfaz de voz (STT/TTS + comandos)", "Erick", "2026-10-01", "2026-10-12"),
    ("Desarrollo", "PWA: manifest, service worker, offline", "Sebastián", "2026-10-03", "2026-10-11"),
    ("Desarrollo", "Perfil adaptativo (backend + datos simulados)", "Giordano", "2026-10-01", "2026-10-10"),
    ("Desarrollo", "Salas multiusuario + chat en tiempo real", "Giordano", "2026-10-05", "2026-10-12"),
    ("Desarrollo", "Diseño emocional (Reci, micro-interacciones, impacto)", "Darcy", "2026-10-04", "2026-10-12"),
    ("Desarrollo", "Panel de accesibilidad y personalización UI", "Darcy", "2026-10-08", "2026-10-12"),
    ("Entrega PC2", "Matriz de trazabilidad", "Erick", "2026-10-09", "2026-10-13"),
    ("Entrega PC2", "README, guía de instalación, LICENSE", "Sebastián", "2026-10-09", "2026-10-13"),
    ("Entrega PC2", "Simulación del flujo + video de sustentación", "Todos", "2026-10-12", "2026-10-14"),
    ("Post PC2", "Pruebas de usabilidad con usuarios (SUS, tareas)", "Darcy", "2026-10-19", "2026-10-31"),
    ("Post PC2", "Cola offline de acciones + notificaciones push", "Sebastián", "2026-10-26", "2026-11-13"),
    ("Post PC2", "Evaluación de proveedores LLM y prompts", "Erick", "2026-10-26", "2026-11-13"),
    ("Post PC2", "Salas: jornadas de recojo compartidas", "Giordano", "2026-11-02", "2026-11-20"),
    ("Post PC2", "Iteración de diseño + evaluación heurística", "Todos", "2026-11-16", "2026-12-04"),
]
HITOS = [("PC2", "2026-10-14"), ("Entrega final", "2026-12-09")]

def d(s): return date.fromisoformat(s)
if __name__ == "__main__":
    fig, ax = plt.subplots(figsize=(15, 9.5))
    n = len(T)
    for i, (fase, t, r, a, b) in enumerate(T):
        y = n - i
        ini, fin = d(a), d(b) + timedelta(days=1)
        hecho = fin <= CORTE + timedelta(days=1)
        ax.barh(y, (fin - ini).days, left=md.date2num(ini), height=0.62, color=E[r], alpha=1 if hecho else 0.35,
                edgecolor=E[r], hatch=None if hecho else "///", linewidth=1.2)
        ax.text(md.date2num(fin) + 0.6, y, r, va="center", fontsize=8.5, color="#444")
    ax.set_yticks([n - i for i in range(n)])
    ax.set_yticklabels([f"{t}" for _, t, *_ in T], fontsize=9)
    fases, prev = [], None
    for i, (f, *_r) in enumerate(T):
        if f != prev:
            ax.axhline(n - i + 0.5, color="#ccc", lw=0.8); ax.text(md.date2num(d("2026-08-27")), n - i + 0.15, f.upper(), fontsize=8, fontweight="bold", color="#3f8b35")
            prev = f
    for nombre, f in HITOS:
        x = md.date2num(d(f)); ax.axvline(x, color="#d04a3a", ls="--", lw=1.4)
        ax.text(x, n + 1.1, f"◆ {nombre}\n{d(f).strftime('%d/%m')}", ha="center", fontsize=9, color="#d04a3a", fontweight="bold")
    ax.xaxis.set_major_locator(md.WeekdayLocator(byweekday=0)); ax.xaxis.set_major_formatter(md.DateFormatter("%d %b"))
    plt.setp(ax.get_xticklabels(), rotation=45, fontsize=8)
    ax.set_xlim(md.date2num(d("2026-08-26")), md.date2num(d("2026-12-12"))); ax.set_ylim(0.3, n + 2)
    ax.grid(axis="x", color="#eee"); ax.set_axisbelow(True)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    ax.set_title("Diagrama de Gantt — Proyecto ReciApp (CC451 · 2026-2)", fontsize=15, fontweight="bold", loc="left")
    ax.legend(handles=[Patch(color=c, label=k) for k, c in E.items()] + [Patch(facecolor="white", edgecolor="#888", hatch="///", label="Planificado (post PC2)")],
              loc="lower left", ncol=6, fontsize=9, frameon=False)
    plt.tight_layout(); plt.savefig("gantt.png", dpi=150); print("ok")
