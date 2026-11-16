// Nivel reflexivo de Norman: el usuario ve el significado de su esfuerzo
// (CO₂ evitado, árboles equivalentes, nivel que crece como una planta).
import React, { useEffect, useState } from "react";
import AnimatedCounter from "../ui/AnimatedCounter";
import { Icon, Starburst } from "../ui/Primitivos";
import { getImpacto } from "../../api/perfil";

const PLANTA = { Semilla: "🌰", Brote: "🌱", "Árbol": "🌳", Bosque: "🌲🌳🌲" };

export default function TarjetaImpacto({ creditos = 0 }) {
  const [imp, setImp] = useState(null);
  useEffect(() => { getImpacto().then(setImp).catch(() => setImp({ kg_total: 0, co2_evitado_kg: 0, arboles_equivalentes: 0, recolecciones: 0, nivel: { nombre: "Semilla", mensaje: "Todo gran bosque empezó así.", progreso: 0, siguiente: "Brote", kg_para_siguiente: 10 } })); }, []);
  if (!imp) return <div style={{ height: 210, borderRadius: 24, background: "var(--cream-card)", border: "1.5px solid var(--line)" }} />;
  const n = imp.nivel;
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "var(--green)", borderRadius: 24, boxShadow: "0 6px 0 var(--green-deep)", padding: "22px 24px", color: "#fff" }}>
      <div style={{ position: "absolute", right: -30, top: -34, pointerEvents: "none", animation: "floaty 9s ease-in-out infinite" }}><Starburst points={20} color="var(--yellow)" size={130} inner={0.55} style={{ opacity: 0.9 }} /></div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
        <span className="planta" aria-hidden="true" style={{ fontSize: 44, lineHeight: 1 }}>{PLANTA[n.nombre] || "🌱"}</span>
        <div>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#fff" }}>Tu nivel ReciApp</span>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 32, margin: 0, lineHeight: 1.05 }}>{n.nombre}</h3>
        </div>
      </div>
      <p style={{ position: "relative", fontFamily: "var(--sans)", fontSize: 15, margin: "8px 0 12px", color: "#fff" }}>{n.mensaje}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(n.progreso * 100)} aria-label={`Progreso al siguiente nivel ${Math.round(n.progreso * 100)}%`} style={{ position: "relative", height: 12, borderRadius: 999, background: "oklch(0.45 0.12 143)", overflow: "hidden" }}>
        <div className="barra-crece" style={{ width: `${Math.max(4, n.progreso * 100)}%`, height: "100%", borderRadius: 999, background: "var(--yellow)" }} />
      </div>
      <p style={{ position: "relative", fontFamily: "var(--sans)", fontSize: 12.5, margin: "7px 0 16px", color: "#fff" }}>
        {n.siguiente ? <>Te faltan <strong>{n.kg_para_siguiente} kg</strong> para ser {n.siguiente}.</> : "¡Llegaste al nivel máximo!"}
      </p>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
        {[[imp.kg_total, 1, "kg reciclados", "weight"], [imp.co2_evitado_kg, 1, "kg CO₂ evitado*", "leaf"], [imp.arboles_equivalentes, 1, "árboles / año*", "home"], [creditos, 0, "eco-créditos", "star"]].map(([v, d, l, ic]) => (
          <div key={l} style={{ background: "var(--cream-card)", color: "var(--ink)", borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
            <Icon name={ic} size={16} stroke="var(--green-deep)" />
            <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--green-deep)", lineHeight: 1.1 }}><AnimatedCounter value={v} decimals={d} /></div>
            <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-soft)", fontWeight: 600 }}>{l}</div>
          </div>
        ))}
      </div>
      <p style={{ position: "relative", fontFamily: "var(--sans)", fontSize: 11, margin: "10px 0 0", color: "#fff" }}>*Estimado con factores promedio de emisiones evitadas por material.</p>
    </div>
  );
}
