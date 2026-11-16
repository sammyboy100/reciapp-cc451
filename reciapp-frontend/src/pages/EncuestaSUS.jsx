// PC3 · Encuesta SUS (System Usability Scale) dentro de la app: una pregunta por pantalla,
// botones grandes y lectura en voz alta opcional, para que también la respondan Rosa o Miguel.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Icon, PrimaryButton, GhostButton, PageHead } from "../components/ui/Primitivos";
import ReciMascota from "../components/Reci/ReciMascota";
import { useAuth } from "../context/AuthContext";
import { usePerfil } from "../context/PerfilContext";
import { useVoz } from "../hooks/useVoz";
import { useConfetti } from "../components/ui/useConfetti";
import { preguntasSUS, enviarSUS, miSUS } from "../api/usabilidad";

const CARAS = ["😣", "🙁", "😐", "🙂", "😄"];

export default function EncuestaSUS() {
  const { user, logout } = useAuth();
  const { perfil } = usePerfil();
  const navigate = useNavigate();
  const voz = useVoz({ velocidad: perfil.derivado?.velocidad_voz || 1 });
  const { burst } = useConfetti();
  const [datos, setDatos] = useState(null);
  const [i, setI] = useState(0);
  const [resp, setResp] = useState(Array(10).fill(null));
  const [comentario, setComentario] = useState("");
  const [resultado, setResultado] = useState(null);
  const [previo, setPrevio] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { preguntasSUS().then(setDatos); miSUS().then(setPrevio).catch(() => {}); }, []);
  useEffect(() => {
    if (datos && perfil.preferencias?.lectura_automatica && i < 10) voz.hablar(`Pregunta ${i + 1}. ${datos.preguntas[i]}`);
  }, [i, datos]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = (v) => {
    const r = [...resp]; r[i] = v; setResp(r);
    if (navigator.vibrate) navigator.vibrate(12);
    setTimeout(() => setI((x) => Math.min(10, x + 1)), 260);   // avanza solo: menos toques
  };

  const enviar = async () => {
    setEnviando(true);
    try { const r = await enviarSUS(resp, comentario.trim() || null); setResultado(r); burst(); voz.hablar(`¡Gracias! Tu puntaje fue ${r.puntaje}.`); }
    finally { setEnviando(false); }
  };

  const progreso = resp.filter((x) => x !== null).length / 10;

  return (
    <div className="paper-tex" style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar user={user?.nombre?.split(" ")[0]} role={user?.rol} onLogout={() => { logout(); navigate("/login"); }} />
      <main className="screen" style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 32px) 120px" }}>
        <PageHead eyebrow="Tu opinión cuenta" title="¿Qué tal te parece ReciApp?" sub="10 preguntas cortas (unos 2 minutos). Nos ayuda a mejorar la app para todo el barrio." />
        {previo?.respondido && !resultado && (
          <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-soft)", margin: "-8px 0 16px" }}>Ya respondiste antes ({previo.puntaje} puntos). Puedes responder otra vez si tu experiencia cambió.</p>
        )}

        {!datos ? <p style={{ fontFamily: "var(--sans)" }}>Cargando…</p> : resultado ? (
          <section className="pop" style={{ textAlign: "center", background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 24, padding: "28px 22px", boxShadow: "0 3px 0 oklch(0.88 0.03 120)" }}>
            <ReciMascota estado="celebrando" size={96} style={{ margin: "0 auto 14px" }} />
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 30, margin: "0 0 4px", color: "var(--ink)" }}>¡Gracias, {user?.nombre?.split(" ")[0]}!</h2>
            <p style={{ fontFamily: "var(--sans)", fontSize: 15, color: "var(--ink-soft)", margin: "0 0 18px" }}>Tu experiencia con ReciApp:</p>
            <div style={{ fontFamily: "var(--serif)", fontSize: 64, color: "var(--green-deep)", lineHeight: 1 }}>{resultado.puntaje}</div>
            <div style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 16, color: "var(--ink)", marginTop: 6 }}>{resultado.adjetivo} · escala SUS de 0 a 100</div>
            <div style={{ marginTop: 22 }}><PrimaryButton type="button" onClick={() => navigate(-1)}>Volver</PrimaryButton></div>
          </section>
        ) : i < 10 ? (
          <section aria-live="polite" style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 24, padding: "22px 22px 26px", boxShadow: "0 3px 0 oklch(0.88 0.03 120)" }}>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={i + 1} aria-label={`Pregunta ${i + 1} de 10`} style={{ height: 10, borderRadius: 999, background: "oklch(0.9 0.03 120)", overflow: "hidden", marginBottom: 18 }}>
              <div style={{ width: `${Math.max(4, progreso * 100)}%`, height: "100%", background: "var(--green)", borderRadius: 999, transition: "width .3s" }} />
            </div>
            <p style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: "var(--green-deep)", margin: 0 }}>Pregunta {i + 1} de 10</p>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(24px, 4vw, 30px)", color: "var(--ink)", margin: "6px 0 20px", lineHeight: 1.25 }}>{datos.preguntas[i]}</h2>
            <div role="radiogroup" aria-label="Tu respuesta" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
              {datos.escala.map((txt, k) => {
                const on = resp[i] === k + 1;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => elegir(k + 1)} className={on ? "bump" : ""}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 4px", minHeight: 96, borderRadius: 16, cursor: "pointer",
                      border: "1.5px solid " + (on ? "var(--green)" : "var(--line)"), background: on ? "color-mix(in oklch, var(--green) 15%, var(--cream-card))" : "var(--cream-card)", boxShadow: on ? "0 3px 0 var(--green-deep)" : "none" }}>
                    <span aria-hidden="true" style={{ fontSize: 30 }}>{CARAS[k]}</span>
                    <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textAlign: "center", lineHeight: 1.2 }}>{txt}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, gap: 10 }}>
              {i > 0 ? <GhostButton onClick={() => setI(i - 1)}><Icon name="chevronLeft" size={17} stroke="var(--ink-soft)" />Anterior</GhostButton> : <span />}
              {voz.soportaTTS && <GhostButton onClick={() => voz.hablar(datos.preguntas[i])}>🔊 Leer pregunta</GhostButton>}
            </div>
          </section>
        ) : (
          <section style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 24, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, margin: 0, color: "var(--ink)" }}>¿Algo más que quieras contarnos?</h2>
            <label><span className="sr-only">Comentario opcional</span>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} rows={4} placeholder="Opcional: qué te gustó o qué te costó"
                style={{ width: "100%", fontFamily: "var(--sans)", fontSize: 15.5, padding: 14, borderRadius: 16, border: "1.5px solid var(--line)", background: "#fff", color: "var(--ink)", resize: "vertical" }} />
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <GhostButton onClick={() => setI(9)}><Icon name="chevronLeft" size={17} stroke="var(--ink-soft)" />Revisar</GhostButton>
              <PrimaryButton type="button" loading={enviando} onClick={enviar}>Enviar respuestas</PrimaryButton>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
