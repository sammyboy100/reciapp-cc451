// Nivel reflexivo + retroalimentación afectiva: el usuario declara cómo se siente
// y el asistente adapta su tono (empático, cálido, festivo…).
import React, { useState } from "react";
import { usePerfil } from "../../context/PerfilContext";
import { useFeedback } from "../../context/FeedbackContext";

const OPCIONES = [
  { id: "alegria",     emoji: "😄", label: "Con energía",  resp: "¡Esa energía se contagia! Hoy Reci te acompaña en modo festivo." },
  { id: "calma",       emoji: "🙂", label: "Tranquilo",    resp: "Qué bien. Vamos a tu ritmo." },
  { id: "cansancio",   emoji: "😴", label: "Cansado",      resp: "Te entiendo. Dímelo por voz y yo hago lo demás." },
  { id: "ansiedad",    emoji: "😬", label: "Apurado",      resp: "Iremos directo al grano, sin pasos de más." },
  { id: "frustracion", emoji: "😤", label: "Frustrado",    resp: "Lamento eso. Te hablaré con calma y te guiaré paso a paso." },
];

export default function CheckInEmocional({ compacto }) {
  const { perfil, registrar } = usePerfil();
  const { avisar } = useFeedback();
  const [elegido, setElegido] = useState(perfil.emociones?.fuente === "declarada" ? perfil.emociones?.actual : null);
  const [bump, setBump] = useState(null);

  const elegir = async (o) => {
    setElegido(o.id); setBump(o.id);
    setTimeout(() => setBump(null), 500);
    await registrar("emocion", { emocion: o.id, fuente: "declarada", canal: "tactil" });
    avisar(o.resp, o.id === "frustracion" || o.id === "cansancio" ? "animo" : "exito", 4200);
  };

  return (
    <div style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 20, padding: compacto ? "14px 16px" : "18px 20px", boxShadow: "0 2px 0 oklch(0.88 0.03 120)" }}>
      <p style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)", margin: "0 0 2px" }}>¿Cómo te sientes hoy?</p>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px" }}>Reci ajusta su tono según tu respuesta.</p>
      <div role="radiogroup" aria-label="Estado de ánimo" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {OPCIONES.map((o) => {
          const on = elegido === o.id;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => elegir(o)} className={bump === o.id ? "bump" : ""}
              style={{ flex: "1 1 60px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 60, padding: "9px 8px", borderRadius: 14, cursor: "pointer",
                border: "1.5px solid " + (on ? "var(--green)" : "var(--line)"), background: on ? "color-mix(in oklch, var(--green) 14%, var(--cream-card))" : "var(--cream-card)",
                boxShadow: on ? "0 3px 0 var(--green-deep)" : "none", transition: "all .15s" }}>
              <span style={{ fontSize: 26, lineHeight: 1, filter: elegido && !on ? "grayscale(0.7) opacity(0.6)" : "none", transition: "filter .2s" }}>{o.emoji}</span>
              <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 11.5, color: "var(--ink)" }}>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
