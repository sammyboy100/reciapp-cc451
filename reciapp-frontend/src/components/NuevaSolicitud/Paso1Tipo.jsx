import React from "react";
import { MaterialCard } from "../ui/Primitivos";
import { MATERIALES, MAT } from "../../lib/datos";
import { usePerfil } from "../../context/PerfilContext";

export default function Paso1Tipo({ data, set }) {
  const { perfil } = usePerfil();
  const frecuente = perfil.derivado?.material_frecuente;
  const toggle = (id) => {
    const next = data.tipos.includes(id) ? data.tipos.filter((t) => t !== id) : [...data.tipos, id];
    set({ tipos: next });
  };
  // Personalización: el material habitual aparece primero
  const orden = frecuente ? [MAT[frecuente], ...MATERIALES.filter((m) => m.id !== frecuente)] : MATERIALES;
  return (
    <div className="screen">
      <h3 style={{ fontFamily: "var(--serif)", fontSize: 25, color: "var(--ink)", margin: "0 0 4px" }}>¿Qué vas a reciclar?</h3>
      <p style={{ fontFamily: "var(--sans)", fontSize: 14.5, color: "var(--ink-soft)", margin: "0 0 14px" }}>Elige uno o varios tipos de residuo.</p>
      {frecuente && !data.tipos.length && (
        <button type="button" onClick={() => set({ tipos: [frecuente] })} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5, color: "var(--green-deep)", background: "color-mix(in oklch, var(--green) 14%, var(--cream-card))", border: "1.5px dashed var(--green)", borderRadius: 999, padding: "7px 14px", cursor: "pointer" }}>
          ✨ Lo de siempre: {MAT[frecuente]?.label}
        </button>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 12 }}>
        {orden.map((m) => <MaterialCard key={m.id} mat={m} selected={data.tipos.includes(m.id)} onClick={() => toggle(m.id)} />)}
      </div>
    </div>
  );
}
