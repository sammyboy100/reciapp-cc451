// PC3 · Panel de métricas de usabilidad (admin): compara el uso real con los
// criterios de usabilidad definidos en la PC2 (SUS ≥ 75, voz ≤ 45 s, táctil ≤ 90 s, ≤ 1 error por tarea).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Icon, PageHead } from "../components/ui/Primitivos";
import { useAuth } from "../context/AuthContext";
import { metricas } from "../api/usabilidad";

const ETQ = { voz: "Voz", texto: "Texto", tactil: "Táctil", alegria: "Alegría", calma: "Calma", frustracion: "Frustración", ansiedad: "Ansiedad", tristeza: "Tristeza", cansancio: "Cansancio" };
const COL = ["var(--green)", "var(--orange)", "var(--blue)", "var(--pink)", "var(--yellow)"];

function Tarjeta({ titulo, children, nota }) {
  return (
    <section style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 20, padding: "18px 20px", boxShadow: "0 2px 0 oklch(0.88 0.03 120)", display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 21, margin: 0, color: "var(--ink)" }}>{titulo}</h2>
      {children}
      {nota && <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--ink-soft)" }}>{nota}</p>}
    </section>
  );
}

function Barras({ datos, unidad = "" }) {
  const filas = Object.entries(datos || {});
  const max = Math.max(1, ...filas.map(([, v]) => v));
  if (!filas.length) return <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-soft)" }}>Sin datos todavía.</p>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {filas.map(([k, v], i) => (
        <li key={k} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 34%) 1fr 48px", alignItems: "center", gap: 10, fontFamily: "var(--sans)", fontSize: 13.5 }}>
          <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ETQ[k] || k.replaceAll("_", " ")}</span>
          <span style={{ height: 14, borderRadius: 999, background: "oklch(0.92 0.03 120)", overflow: "hidden" }}>
            <span className="barra-crece" style={{ display: "block", width: `${(v / max) * 100}%`, height: "100%", borderRadius: 999, background: COL[i % COL.length] }} />
          </span>
          <span style={{ fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>{v}{unidad}</span>
        </li>
      ))}
    </ul>
  );
}

function Meta({ etiqueta, valor, meta, unidad, menorEsMejor }) {
  const ok = valor == null ? null : menorEsMejor ? valor <= meta : valor >= meta;
  return (
    <div style={{ background: "var(--cream)", borderRadius: 16, padding: "14px 16px", border: "1.5px solid " + (ok === false ? "var(--orange)" : "var(--line)") }}>
      <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--ink-soft)" }}>{etiqueta}</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 34, color: "var(--ink)", lineHeight: 1.1 }}>{valor ?? "—"}<span style={{ fontSize: 16 }}>{valor != null ? unidad : ""}</span></div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 700, color: ok === null ? "var(--ink-soft)" : ok ? "var(--green-deep)" : "oklch(0.52 0.15 45)" }}>
        Meta {menorEsMejor ? "≤" : "≥"} {meta}{unidad} · {ok === null ? "sin datos" : ok ? "✓ cumple" : "✗ no cumple"}
      </div>
    </div>
  );
}

export default function AdminMetricas() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [m, setM] = useState(null);
  useEffect(() => { metricas().then(setM).catch(() => setM({ error: true })); }, []);
  const u = m?.uso;

  return (
    <div className="paper-tex" style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar user={user?.nombre?.split(" ")[0]} role={user?.rol} onLogout={() => { logout(); navigate("/login"); }} />
      <main className="screen" style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(26px, 4vw, 44px) clamp(16px, 4vw, 36px) 80px" }}>
        <PageHead eyebrow="Evaluación de usabilidad" title="Métricas de uso" sub="Criterios ISO 9241-11 definidos en la PC2, medidos con la bitácora de eventos y la encuesta SUS." />
        {!m ? <p style={{ fontFamily: "var(--sans)" }}>Cargando…</p> : m.error ? <p style={{ fontFamily: "var(--sans)" }}>No se pudieron cargar las métricas.</p> : <>
          {m.sus.simuladas > 0 && (
            <p role="note" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink)", background: "color-mix(in oklch, var(--yellow) 25%, var(--cream-card))", border: "1.5px solid var(--yellow)", borderRadius: 14, padding: "10px 14px", margin: "0 0 18px" }}>
              <Icon name="alert" size={17} stroke="var(--ink)" />Incluye {m.sus.simuladas} respuestas SUS y eventos <strong>simulados</strong> del seed para demostrar el panel; no son resultados de pruebas con usuarios.
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
            <Meta etiqueta={`SUS promedio (n = ${m.sus.n})`} valor={m.sus.promedio} meta={75} unidad="" />
            <Meta etiqueta="Mediana por voz" valor={u.mediana_seg_por_canal.voz} meta={45} unidad=" s" menorEsMejor />
            <Meta etiqueta="Mediana táctil" valor={u.mediana_seg_por_canal.tactil} meta={90} unidad=" s" menorEsMejor />
            <Meta etiqueta="Errores por solicitud" valor={u.errores_por_solicitud} meta={1} unidad="" menorEsMejor />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <Tarjeta titulo="Canal de interacción" nota="Cuántos eventos llegaron por voz, texto o toque."><Barras datos={u.por_canal} /></Tarjeta>
            <Tarjeta titulo="Dónde se equivocan" nota="Contextos con más errores: guía para la próxima iteración de diseño."><Barras datos={u.errores_por_contexto} /></Tarjeta>
            <Tarjeta titulo="Qué le piden a Reci" nota="Intenciones detectadas por el asistente."><Barras datos={u.intenciones} /></Tarjeta>
            <Tarjeta titulo="Cómo se sienten ahora" nota="Emoción actual en cada perfil (declarada o inferida)."><Barras datos={m.emociones_actuales} /></Tarjeta>
            <Tarjeta titulo="SUS por canal preferido"><Barras datos={Object.fromEntries(Object.entries(m.sus.por_canal || {}).filter(([, v]) => v != null))} /></Tarjeta>
            <Tarjeta titulo="Sistema">
              <Barras datos={{ ...m.usuarios_por_rol, salas: m.salas, "kg reciclados": m.kg_reciclados }} />
            </Tarjeta>
          </div>
        </>}
      </main>
    </div>
  );
}
