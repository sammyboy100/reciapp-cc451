// Sala colaborativa: meta común, ranking de aportes y chat en tiempo real (WebSocket),
// con reacciones, indicador de "escribiendo…" y dictado por voz.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Icon, Avatar, Starburst } from "../components/ui/Primitivos";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { useVoz } from "../hooks/useVoz";
import { useConfetti } from "../components/ui/useConfetti";
import { usePerfil } from "../context/PerfilContext";
import { detalleSala, reaccionar } from "../api/salas";
import { enviarOEncolar } from "../lib/colaOffline";
import JornadasSala from "../components/Salas/JornadasSala";
import { TIPOS_SALA } from "./Salas";

const REACCIONES = ["💚", "👏", "🎉", "💪", "♻️"];

function Anillo({ p, size = 132 }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={r} fill="none" stroke="oklch(0.45 0.12 143)" strokeWidth="12" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--yellow)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, p))} transform="rotate(-90 60 60)" className="anillo" />
      <text x="60" y="58" textAnchor="middle" fontFamily="DM Serif Display, serif" fontSize="28" fill="#fff">{Math.round(p * 100)}%</text>
      <text x="60" y="76" textAnchor="middle" fontFamily="Hanken Grotesk, sans-serif" fontSize="10" fontWeight="700" fill="oklch(0.95 0.05 130)">DE LA META</text>
    </svg>
  );
}

function Mensaje({ m, mio, uid, onReaccion }) {
  const [abrirReac, setAbrirReac] = useState(false);
  if (m.tipo === "sistema") {
    return <div style={{ alignSelf: "center", fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--ink-soft)", background: "var(--cream)", border: "1px solid var(--line)", borderRadius: 999, padding: "4px 12px" }}>{m.contenido}</div>;
  }
  const reac = Object.entries(m.reacciones || {}).filter(([, v]) => v.length);
  const logro = m.tipo === "logro";
  return (
    <div className="msg-in" style={{ alignSelf: logro ? "stretch" : mio ? "flex-end" : "flex-start", maxWidth: logro ? "100%" : "82%" }}>
      {!mio && !logro && <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginLeft: 8 }}>{m.autor?.split(" ")[0]}</span>}
      <div onDoubleClick={() => !m.pendiente && onReaccion(m, "💚")} onClick={() => !m.pendiente && setAbrirReac((v) => !v)} style={{
        position: "relative", cursor: "pointer",
        background: logro ? "color-mix(in oklch, var(--yellow) 26%, var(--cream-card))" : mio ? "var(--green)" : "var(--cream-card)",
        color: mio && !logro ? "#fff" : "var(--ink)", border: logro ? "1.5px solid var(--yellow)" : mio ? "none" : "1.5px solid var(--line)",
        borderRadius: logro ? 16 : mio ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: logro ? "12px 14px" : "9px 14px",
        fontFamily: "var(--sans)", fontSize: 15, lineHeight: 1.45, display: "flex", alignItems: "center", gap: 10,
        boxShadow: mio && !logro ? "0 3px 0 var(--green-deep)" : "0 2px 0 oklch(0.88 0.03 120)",
      }}>
        {logro && <span style={{ flexShrink: 0 }}><Starburst points={14} color="var(--orange)" size={30} inner={0.55} /></span>}
        {m.tipo === "voz" && <span aria-label="dictado">🎙️</span>}
        <span style={{ fontWeight: logro ? 700 : 400 }}>{m.contenido}</span>
        {m.pendiente && <span title="Pendiente de envío" style={{ fontSize: 12, opacity: 0.85 }}>⏳</span>}
      </div>
      {(reac.length > 0 || abrirReac) && (
        <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap", justifyContent: mio ? "flex-end" : "flex-start" }}>
          {(abrirReac ? REACCIONES : reac.map(([e]) => e)).map((e) => {
            const lista = m.reacciones?.[e] || [];
            const yo = lista.includes(uid);
            return (
              <button key={e} type="button" onClick={() => { onReaccion(m, e); setAbrirReac(false); }} aria-label={`Reaccionar ${e}`} aria-pressed={yo} className="reac"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14, padding: "3px 9px", borderRadius: 999, cursor: "pointer", border: "1.5px solid " + (yo ? "var(--green)" : "var(--line)"), background: yo ? "color-mix(in oklch, var(--green) 14%, var(--cream-card))" : "var(--cream-card)", fontFamily: "var(--sans)", fontWeight: 700, color: "var(--ink)" }}>
                {e}{lista.length > 0 && <span style={{ fontSize: 12 }}>{lista.length}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SalaDetalle() {
  const { id } = useParams();
  const salaId = Number(id);
  const { user, logout } = useAuth();
  const { perfil } = usePerfil();
  const { avisar } = useFeedback();
  const { burst } = useConfetti();
  const navigate = useNavigate();
  const voz = useVoz({ velocidad: perfil.derivado?.velocidad_voz || 1 });
  const [sala, setSala] = useState(null);
  const [texto, setTexto] = useState("");
  const [escribiendo, setEscribiendo] = useState(null);
  const listaRef = useRef(null);
  const ultimoAviso = useRef(0);
  const timer = useRef(null);
  const jornadasRef = useRef(null);

  const cargar = useCallback(() => detalleSala(salaId).then(setSala).catch(() => navigate("/salas")), [salaId, navigate]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { listaRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [sala?.mensajes?.length, escribiendo]);

  const onWs = useCallback((msg) => {
    if (msg.sala_id !== salaId) return;
    if (msg.tipo === "sala_mensaje") {
      setSala((s) => s && !s.mensajes.some((x) => x.id === msg.mensaje.id) ? { ...s, mensajes: [...s.mensajes, msg.mensaje] } : s);
      setEscribiendo(null);
      if (msg.mensaje.tipo === "logro") cargar();
      if (perfil.preferencias?.lectura_automatica && msg.mensaje.usuario_id !== user?.id) voz.hablar(`${msg.mensaje.autor?.split(" ")[0] || "Aviso"}: ${msg.mensaje.contenido}`);
    } else if (msg.tipo === "sala_reaccion") {
      setSala((s) => s && { ...s, mensajes: s.mensajes.map((x) => (x.id === msg.mensaje.id ? msg.mensaje : x)) });
    } else if (msg.tipo === "sala_escribiendo") {
      setEscribiendo(msg.nombre);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setEscribiendo(null), 3500);
    } else if (msg.tipo === "sala_jornada") {
      jornadasRef.current?.recargar();
    } else if (msg.tipo === "sala_meta_alcanzada") {
      burst(); avisar("¡La sala cumplió su meta! 🎉", "exito", 5000);
    }
  }, [salaId, cargar, burst, avisar, perfil.preferencias?.lectura_automatica, user?.id, voz]);
  const wsRef = useWebSocket(onWs, true);

  const avisarEscribiendo = () => {
    const ws = wsRef.current;
    if (ws?.readyState === 1 && Date.now() - ultimoAviso.current > 2500) {
      ws.send(JSON.stringify({ tipo: "sala_escribiendo", sala_id: salaId }));
      ultimoAviso.current = Date.now();
    }
  };

  const mandar = async (contenido, tipo = "texto") => {
    const c = contenido.trim();
    if (!c) return;
    setTexto("");
    try {
      const r = await enviarOEncolar("mensaje_sala", { sala_id: salaId, contenido: c, tipo }, "Mensaje en sala");
      if (r.encolada) {
        // Se muestra al instante como pendiente; se envía solo al volver la red
        setSala((s) => ({ ...s, mensajes: [...s.mensajes, { id: "pend-" + Date.now(), sala_id: salaId, usuario_id: user?.id, autor: user?.nombre, tipo, contenido: c, reacciones: {}, pendiente: true }] }));
        avisar("Sin conexión: tu mensaje se enviará al volver la red", "animo");
        return;
      }
      const m = r.data;
      setSala((s) => s.mensajes.some((x) => x.id === m.id) ? s : { ...s, mensajes: [...s.mensajes, m] });
      if (navigator.vibrate) navigator.vibrate(15);
    } catch { avisar("No se envió. Revisa tu conexión.", "error"); setTexto(c); }
  };

  const onReaccion = async (m, emoji) => {
    try {
      const nuevo = await reaccionar(salaId, m.id, emoji);
      setSala((s) => ({ ...s, mensajes: s.mensajes.map((x) => (x.id === nuevo.id ? nuevo : x)) }));
      if (navigator.vibrate) navigator.vibrate(10);
    } catch { /* noop */ }
  };

  const dictar = async () => {
    if (voz.escuchando) { voz.detener(); return; }
    avisarEscribiendo();
    const t = await voz.escuchar();
    if (t) mandar(t, "voz");
  };

  const compartir = async () => {
    const txt = `Únete a mi sala "${sala.nombre}" en ReciApp con el código ${sala.codigo} ♻️`;
    try {
      if (navigator.share) await navigator.share({ title: "ReciApp", text: txt, url: window.location.origin + "/salas" });
      else { await navigator.clipboard.writeText(txt); avisar("Invitación copiada", "exito"); }
    } catch { /* cancelado */ }
  };

  if (!sala) return <div className="paper-tex" style={{ minHeight: "100vh", background: "var(--cream)" }}><Navbar user={user?.nombre?.split(" ")[0]} role={user?.rol} onLogout={logout} /></div>;
  const t = TIPOS_SALA[sala.tipo] || TIPOS_SALA.barrio;
  const yo = sala.miembros.find((m) => m.usuario_id === user?.id);

  return (
    <div className="paper-tex" style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar user={user?.nombre?.split(" ")[0]} role={user?.rol} onLogout={() => { logout(); navigate("/login"); }} />
      <main className="screen" style={{ maxWidth: 1120, margin: "0 auto", padding: "22px clamp(16px, 4vw, 36px) 120px" }}>
        <button type="button" onClick={() => navigate("/salas")} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, color: "var(--ink-soft)", padding: "6px 0", marginBottom: 10 }}>
          <Icon name="chevronLeft" size={18} stroke="var(--ink-soft)" />Mis salas
        </button>

        {/* cabecera con meta */}
        <section style={{ position: "relative", overflow: "hidden", background: "var(--green)", borderRadius: 26, boxShadow: "0 6px 0 var(--green-deep)", padding: "22px 24px", display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <img src="/bolsas.png" alt="" style={{ position: "absolute", right: -50, bottom: -60, width: 220, opacity: 0.4, pointerEvents: "none" }} />
          <Anillo p={sala.progreso} />
          <div style={{ position: "relative", flex: "1 1 280px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 30 }}>{sala.emoji}</span>
              <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: t.color === "var(--green)" ? "var(--green-deep)" : "#fff", background: t.color === "var(--green)" ? "var(--cream)" : t.color, borderRadius: 999, padding: "4px 11px" }}>{t.label}{!sala.publica && " · Privada"}</span>
            </div>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px, 4vw, 40px)", color: "#fff", margin: "8px 0 4px", lineHeight: 1.1 }}>{sala.nombre}</h1>
            {sala.descripcion && <p style={{ fontFamily: "var(--sans)", fontSize: 15, color: "#fff", margin: 0 }}>{sala.descripcion}</p>}
            <p style={{ fontFamily: "var(--sans)", fontSize: 15, color: "#fff", margin: "10px 0 0" }}><strong style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 400 }}>{sala.kg_acumulados} kg</strong> de {sala.meta_kg} kg · {sala.miembros_count} miembros</p>
          </div>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
            <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#fff", textAlign: "center" }}>Código de invitación</span>
            <span style={{ fontFamily: "var(--serif)", fontSize: 30, letterSpacing: 4, color: "var(--green-deep)", background: "var(--cream)", borderRadius: 16, padding: "6px 16px", textAlign: "center" }}>{sala.codigo}</span>
            <button type="button" onClick={compartir} style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, color: "#fff", background: "var(--green-deep)", border: "none", borderRadius: 999, padding: "10px 16px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Icon name="upload" size={16} stroke="#fff" />Invitar vecinos</button>
          </div>
        </section>

        <div className="sala-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 18, marginTop: 20 }}>
          {/* chat */}
          <section aria-label="Chat de la sala" style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 22, display: "flex", flexDirection: "column", height: "min(620px, 72vh)", overflow: "hidden", boxShadow: "0 2px 0 oklch(0.88 0.03 120)" }}>
            <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: 21, margin: 0, color: "var(--ink)" }}>Conversación</h2>
              <span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-soft)" }}>Toca un mensaje para reaccionar</span>
            </header>
            <div ref={listaRef} className="no-bar" aria-live="polite" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {sala.mensajes.map((m) => <Mensaje key={m.id} m={m} mio={m.usuario_id === user?.id} uid={user?.id} onReaccion={onReaccion} />)}
              {escribiendo && <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>{[0, 1, 2].map((d) => <span key={d} className="typing-dot" style={{ animationDelay: d * 0.15 + "s" }} />)}{escribiendo} está escribiendo…</div>}
              {voz.escuchando && <div style={{ alignSelf: "flex-end", fontFamily: "var(--sans)", fontStyle: "italic", color: "var(--ink-soft)" }}>{voz.parcial || "Te escucho…"}</div>}
            </div>
            {sala.soy_miembro ? (
              <form onSubmit={(e) => { e.preventDefault(); mandar(texto); }} style={{ display: "flex", gap: 9, padding: 12, borderTop: "1px solid var(--line)" }}>
                {voz.soportaSTT && perfil.preferencias?.voz_activada !== false && (
                  <button type="button" onClick={dictar} aria-label={voz.escuchando ? "Detener dictado" : "Dictar mensaje"} className={voz.escuchando ? "mic-on" : ""}
                    style={{ width: 48, height: 48, borderRadius: "50%", border: "none", flexShrink: 0, cursor: "pointer", display: "grid", placeItems: "center", background: voz.escuchando ? "var(--pink)" : "var(--green)", boxShadow: "0 3px 0 var(--green-deep)" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
                  </button>
                )}
                <label style={{ flex: 1, minWidth: 0 }}><span className="sr-only">Mensaje</span>
                  <input value={texto} onChange={(e) => { setTexto(e.target.value); avisarEscribiendo(); }} placeholder="Escribe a tu comunidad…" maxLength={500}
                    style={{ width: "100%", fontFamily: "var(--sans)", fontSize: 15, background: "#fff", border: "1.5px solid var(--line)", borderRadius: 999, padding: "12px 16px", outline: "none", color: "var(--ink)" }} />
                </label>
                <button type="submit" aria-label="Enviar" disabled={!texto.trim()} style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: texto.trim() ? "var(--green-deep)" : "var(--line)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}><Icon name="arrowRight" size={20} stroke="#fff" sw={2.4} /></button>
              </form>
            ) : <p style={{ margin: 0, padding: 14, textAlign: "center", fontFamily: "var(--sans)", color: "var(--ink-soft)", borderTop: "1px solid var(--line)" }}>Únete para conversar.</p>}
          </section>

          {/* ranking */}
          <aside aria-label="Ranking y jornadas de la sala" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {sala.soy_miembro && <JornadasSala salaId={salaId} rol={user?.rol} refrescoSala={cargar} ref={jornadasRef} />}
            {yo && (
              <div style={{ background: "var(--cream-card)", border: "1.5px solid var(--green-soft)", borderRadius: 20, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 34 }}>🌱</span>
                <div>
                  <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--ink-soft)" }}>Tu aporte</p>
                  <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 26, color: "var(--green-deep)" }}>{yo.kg_aportados} kg</p>
                  <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-soft)" }}>{sala.kg_acumulados ? Math.round((yo.kg_aportados / sala.kg_acumulados) * 100) : 0}% de lo que lleva la sala</p>
                </div>
              </div>
            )}
            <div style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 22, padding: "16px 18px", boxShadow: "0 2px 0 oklch(0.88 0.03 120)" }}>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: 21, margin: "0 0 12px", color: "var(--ink)" }}>Ranking</h2>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {sala.miembros.map((m, i) => (
                  <li key={m.usuario_id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ width: 24, fontFamily: "var(--serif)", fontSize: 18, color: i < 3 ? ["var(--orange)", "var(--ink-soft)", "oklch(0.6 0.1 60)"][i] : "var(--line)", textAlign: "center" }}>{i + 1}</span>
                    <span style={{ position: "relative" }}>
                      <Avatar name={m.nombre} size={36} bg={m.rol_app === "reciclador" ? "var(--orange)" : "var(--green-soft)"} />
                      <span title={m.en_linea ? "En línea" : "Desconectado"} style={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: "50%", border: "2px solid var(--cream-card)", background: m.en_linea ? "var(--green)" : "var(--line)" }} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nombre.split(" ").slice(0, 2).join(" ")}{m.usuario_id === user?.id && " (tú)"}</span>
                      <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-soft)" }}>{m.rol_app === "reciclador" ? "Reciclador" : "Vecino"}{m.rol_sala === "anfitrion" && " · Anfitrión"}</span>
                    </span>
                    <span style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--green-deep)" }}>{m.kg_aportados}<span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-soft)" }}> kg</span></span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
