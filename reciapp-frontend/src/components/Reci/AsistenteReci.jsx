// ============================================================
// Asistente "Reci": interfaz de voz + LLM, disponible en toda la app.
// - Dictado (STT) y lectura en voz alta (TTS) con velocidad adaptativa.
// - Texto como alternativa equivalente (personas sordas / sin micrófono).
// - El tono y la expresión de Reci cambian según la emoción detectada.
// Ábrelo desde cualquier parte con:  window.dispatchEvent(new CustomEvent("reci:abrir", { detail: { mensaje } }))
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, PrimaryButton, GhostButton } from "../ui/Primitivos";
import ReciMascota, { expresionPara } from "./ReciMascota";
import NuevaSolicitudModal from "../NuevaSolicitud/NuevaSolicitudModal";
import { useAuth } from "../../context/AuthContext";
import { usePerfil } from "../../context/PerfilContext";
import { useFeedback } from "../../context/FeedbackContext";
import { useVoz } from "../../hooks/useVoz";
import { useConfetti } from "../ui/useConfetti";
import { chatAsistente } from "../../api/asistente";
import { enviarOEncolar } from "../../lib/colaOffline";
import { MAT, FRANJAS } from "../../lib/datos";

const TONO_LABEL = { amigable: "Amigable", empatico: "Empático", celebratorio: "Festivo", directo: "Directo", calido: "Cálido", formal: "Formal" };
const DIA_LABEL = (d) => (d === 0 ? "Hoy" : d === 1 ? "Mañana" : d === 2 ? "Pasado mañana" : `En ${d} días`);

function saludoInicial(nombre, derivado, rol) {
  if (derivado?.emocion_actual === "frustracion")
    return `Hola, ${nombre}. Noté que algo no salió bien hace un rato. Dime con tus palabras qué necesitas y lo hacemos juntos.`;
  if (rol === "reciclador") return `¡Hola, ${nombre}! Pregúntame qué solicitudes hay disponibles o ajusta cómo te hablo.`;
  const mat = derivado?.material_frecuente ? MAT[derivado.material_frecuente]?.label.toLowerCase() : null;
  return mat
    ? `¡Hola, ${nombre}! ¿Reciclamos ${mat} otra vez? Dime, por ejemplo: «3 kilos de ${mat} mañana».`
    : `¡Hola, ${nombre}! Soy Reci. Dime qué quieres reciclar y cuándo, y yo lo programo.`;
}

function TarjetaBorrador({ b, auto = [], onConfirmar, onEditar, cargando }) {
  const franja = FRANJAS.find((f) => f.id === b.franja_horaria);
  const Fila = ({ icon, label, valor, aprendido }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--sans)", fontSize: 14 }}>
      <Icon name={icon} size={16} stroke="var(--green-deep)" />
      <span style={{ color: "var(--ink-soft)", width: 74, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 700, color: "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valor}</span>
      {aprendido && <span title="Lo aprendí de tus solicitudes anteriores" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--green-deep)", background: "color-mix(in oklch, var(--green) 16%, transparent)", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>✨ de tu perfil</span>}
    </div>
  );
  return (
    <div className="pop" style={{ background: "var(--cream)", border: "1.5px solid var(--green-soft)", borderRadius: 18, padding: 16, marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {(b.tipos || []).map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: MAT[t]?.color, color: "#fff", borderRadius: 999, padding: "5px 11px 5px 7px", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13 }}>
            <Icon name={MAT[t]?.icon} size={14} stroke="#fff" />{MAT[t]?.label}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Fila icon="weight" label="Cantidad" valor={`${b.cantidad_kg} kg aprox.`} />
        <Fila icon="calendar" label="Cuándo" valor={`${DIA_LABEL(b.dia_offset ?? 1)} · ${franja?.label || "—"}`} aprendido={auto.includes("franja_horaria")} />
        <Fila icon="pin" label="Dónde" valor={b.direccion || "Falta marcar en el mapa"} aprendido={auto.includes("direccion")} />
      </div>
      <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
        <PrimaryButton type="button" size="sm" loading={cargando} onClick={onConfirmar}><Icon name="check" size={17} stroke="#fff" />{b.latitud ? "Confirmar" : "Elegir punto"}</PrimaryButton>
        <GhostButton onClick={onEditar}><Icon name="edit" size={16} stroke="var(--ink-soft)" />Editar</GhostButton>
      </div>
    </div>
  );
}

function TarjetaImpacto({ imp }) {
  return (
    <div className="pop" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
      {[[imp.kg_total, "kg", "reciclados"], [imp.co2_evitado_kg, "kg", "CO₂ evitado"], [imp.arboles_equivalentes, "", "árboles/año"]].map(([v, u, l]) => (
        <div key={l} style={{ background: "var(--cream)", border: "1.5px solid var(--line)", borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--green-deep)", lineHeight: 1 }}>{v}<span style={{ fontSize: 13 }}> {u}</span></div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, color: "var(--ink-soft)", marginTop: 3 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

export default function AsistenteReci() {
  const { user } = useAuth();
  const { perfil, refrescar, registrar } = usePerfil();
  const { avisar } = useFeedback();
  const { burst } = useConfetti();
  const navigate = useNavigate();
  const pref = perfil.preferencias || {};
  const der = perfil.derivado || {};
  const voz = useVoz({ velocidad: der.velocidad_voz || 1 });

  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [tono, setTono] = useState(der.tono_asistente || "amigable");
  const [borrador, setBorrador] = useState(null);
  const [proveedor, setProveedor] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [celebrar, setCelebrar] = useState(false);
  const [creando, setCreando] = useState(false);
  const [modal, setModal] = useState(null);           // datos iniciales para NuevaSolicitudModal
  const inicioRef = useRef(null);
  const listaRef = useRef(null);
  const nombre = user?.nombre?.split(" ")[0] || "vecino";
  const vozActiva = pref.voz_activada !== false;

  // Mensaje de bienvenida personalizado al abrir
  useEffect(() => {
    if (!abierto || msgs.length) return;
    inicioRef.current = Date.now();
    const saludo = saludoInicial(nombre, der, user?.rol);
    setMsgs([{ rol: "assistant", texto: saludo }]);
    setTono(der.tono_asistente || "amigable");
    setSugerencias(user?.rol === "reciclador"
      ? ["¿Qué solicitudes hay?", "Mis salas", "Habla más lento"]
      : ["Reciclar plástico mañana", "¿Dónde está mi reciclador?", "¿Cuál es mi impacto?", "Letra más grande"]);
    if (pref.lectura_automatica) voz.hablar(saludo);
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { listaRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [msgs, pensando, voz.parcial]);

  const crearDesdeBorrador = useCallback(async (b, canal = "voz") => {
    if (!b?.latitud || !b?.longitud || !b?.direccion) {
      // Falta el punto en el mapa: abrir el asistente táctil en el paso de dirección
      setModal({ b, paso: 3 });
      return;
    }
    setCreando(true);
    try {
      const f = new Date(); f.setDate(f.getDate() + (b.dia_offset ?? 1));
      const r = await enviarOEncolar("solicitud", {
        tipo_residuo: b.tipos[0], cantidad_kg: b.cantidad_kg, fecha_recoleccion: f.toISOString().split("T")[0],
        franja_horaria: b.franja_horaria || "manana", direccion: b.direccion, latitud: b.latitud, longitud: b.longitud,
        canal, duracion_seg: inicioRef.current ? Math.round((Date.now() - inicioRef.current) / 1000) : null,
      }, `Recojo de ${b.cantidad_kg} kg`);
      if (r.encolada) {
        setBorrador(null);
        const txt = "No hay señal, pero guardé tu pedido. Lo envío solito apenas vuelva la conexión.";
        setMsgs((m) => [...m, { rol: "assistant", texto: txt }]);
        avisar("Pedido guardado sin conexión", "animo");
        if (pref.lectura_automatica || canal === "voz") voz.hablar(txt);
        return;
      }
      setBorrador(null);
      setCelebrar(true);
      burst();
      const fin = `¡Listo, ${nombre}! Tu recojo quedó programado. Gracias por reciclar 💚`;
      setMsgs((m) => [...m, { rol: "assistant", texto: fin }]);
      avisar("Solicitud creada por voz", "exito");
      if (pref.lectura_automatica || canal === "voz") voz.hablar(fin);
      refrescar();
      setTimeout(() => setCelebrar(false), 3200);
    } catch {
      registrar("error", { contexto: "crear_por_voz" });
      setMsgs((m) => [...m, { rol: "assistant", texto: "Uy, no pude registrarla. Probemos completando el formulario, ya lo dejé casi listo." }]);
      setModal({ b, paso: 3 });
    } finally {
      setCreando(false);
    }
  }, [avisar, burst, nombre, pref.lectura_automatica, refrescar, registrar, voz]);

  const ejecutarAccion = useCallback((r, canal) => {
    const a = r.accion || {};
    if (a.tipo === "navegar") {
      setTimeout(() => { navigate(a.ruta); setAbierto(false); }, 900);
    } else if (a.tipo === "aplicar_preferencias") {
      refrescar();
      avisar("Preferencias actualizadas", "exito");
    } else if (a.tipo === "crear_solicitud") {
      crearDesdeBorrador(a.borrador, canal);
    } else if (a.tipo === "cancelar_borrador") {
      setBorrador(null);
    }
  }, [avisar, crearDesdeBorrador, navigate, refrescar]);

  const enviar = useCallback(async (mensaje, canal = "texto") => {
    const limpio = (mensaje || "").trim();
    if (!limpio) return;
    const historial = msgs.slice(-6).map((m) => ({ rol: m.rol, texto: m.texto }));
    setMsgs((m) => [...m, { rol: "user", texto: limpio, canal }]);
    setTexto("");
    setPensando(true);
    try {
      const r = await chatAsistente({ mensaje: limpio, canal, historial, borrador });
      setTono(r.tono);
      setProveedor(r.proveedor + (r.uso_respaldo ? " (respaldo)" : ""));
      setSugerencias(r.sugerencias || []);
      setBorrador(r.borrador && (r.accion?.tipo === "confirmar_solicitud" || r.accion?.tipo === "preguntar") ? r.borrador : (r.accion?.tipo === "crear_solicitud" ? null : borrador));
      setMsgs((m) => [...m, { rol: "assistant", texto: r.respuesta, accion: r.accion, emocion: r.emocion_detectada }]);
      if (r.emocion_detectada === "frustracion") refrescar();
      if (pref.lectura_automatica || canal === "voz") voz.hablar(r.respuesta, { velocidad: r.velocidad_voz });
      ejecutarAccion(r, canal);
    } catch {
      registrar("error", { contexto: "asistente" });
      setMsgs((m) => [...m, { rol: "assistant", texto: "No logré conectarme. Revisa tu internet; mientras tanto puedes usar los botones de la app." }]);
    } finally {
      setPensando(false);
    }
  }, [borrador, ejecutarAccion, msgs, pref.lectura_automatica, refrescar, registrar, voz]);

  const dictar = async () => {
    if (voz.escuchando) { voz.detener(); return; }
    const dicho = await voz.escuchar();
    if (dicho) enviar(dicho, "voz");
    else if (voz.error && voz.error !== "no-speech") avisar("No pude acceder al micrófono", "error");
  };

  // Atajo del ícono instalado (manifest → /ciudadano?reci=1)
  useEffect(() => {
    if (user && new URLSearchParams(window.location.search).has("reci")) setAbierto(true);
  }, [user]);

  // Abrir desde cualquier pantalla
  useEffect(() => {
    const h = (e) => { setAbierto(true); if (e.detail?.mensaje) setTimeout(() => enviar(e.detail.mensaje, e.detail.canal || "texto"), 350); };
    window.addEventListener("reci:abrir", h);
    return () => window.removeEventListener("reci:abrir", h);
  }, [enviar]);

  if (!user || user.rol === "admin") return null;

  const expresion = expresionPara({ escuchando: voz.escuchando, hablando: voz.hablando, pensando, tono, celebrar });

  return (
    <>
      {!abierto && (
        <button type="button" className="reci-fab" onClick={() => setAbierto(true)} aria-label="Hablar con Reci, tu asistente de voz"
          style={{ position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(18px, env(safe-area-inset-bottom))", zIndex: 90, display: "flex", alignItems: "center", gap: 10, background: "var(--cream-card)", border: "2px solid var(--green)", borderRadius: 999, padding: "6px 18px 6px 6px", cursor: "pointer", boxShadow: "0 5px 0 var(--green-deep), 0 18px 30px -14px oklch(0.3 0.06 140 / 0.5)" }}>
          <ReciMascota estado={der.emocion_actual === "frustracion" ? "empatico" : "feliz"} size={50} />
          <span className="reci-fab-label" style={{ textAlign: "left", lineHeight: 1.1 }}>
            <span style={{ display: "block", fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)" }}>Habla con Reci</span>
            <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>{vozActiva && voz.soportaSTT ? "Toca y dicta 🎙️" : "Escríbele ✍️"}</span>
          </span>
        </button>
      )}

      {abierto && (
        <div className="ov-anim" onClick={() => setAbierto(false)} style={{ position: "fixed", inset: 0, zIndex: 95, background: "oklch(0.2 0.02 140 / 0.35)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "0 max(0px, env(safe-area-inset-right)) 0 0" }}>
          <section role="dialog" aria-label="Asistente Reci" onClick={(e) => e.stopPropagation()} className="sheet-anim reci-sheet"
            style={{ width: "min(440px, 100%)", height: "min(720px, 100dvh)", display: "flex", flexDirection: "column", background: "var(--cream-card)", borderRadius: "26px 26px 0 0", boxShadow: "0 -10px 50px -10px oklch(0.2 0.04 130 / 0.4)", overflow: "hidden", marginRight: "clamp(0px, 2vw, 24px)" }}>
            {/* cabecera */}
            <header style={{ position: "relative", overflow: "hidden", background: "var(--green)", padding: "16px 18px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/bolsas.png" alt="" style={{ position: "absolute", right: -40, top: -30, width: 150, opacity: 0.35, pointerEvents: "none" }} />
              <ReciMascota estado={expresion} size={64} nivel={voz.nivel} />
              <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, color: "#fff", margin: 0, lineHeight: 1 }}>Reci</h2>
                <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--green-deep)", background: "var(--cream)", borderRadius: 999, padding: "3px 9px" }}>Tono · {TONO_LABEL[tono] || tono}</span>
                  {proveedor && <span title="Proveedor de lenguaje activo (capa de abstracción LLM)" style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11, color: "#fff", background: "var(--green-deep)", borderRadius: 999, padding: "3px 9px" }}>LLM · {proveedor}</span>}
                </div>
              </div>
              <button type="button" onClick={() => { voz.callar(); setAbierto(false); }} aria-label="Cerrar asistente" style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--green-deep)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="x" size={20} stroke="#fff" /></button>
            </header>

            {/* conversación */}
            <div ref={listaRef} className="no-bar" aria-live="polite" style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
              {msgs.map((m, i) => (
                <div key={i} className="msg-in" style={{ alignSelf: m.rol === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
                  <div style={{
                    background: m.rol === "user" ? "var(--green)" : "var(--cream)", color: m.rol === "user" ? "#fff" : "var(--ink)",
                    border: m.rol === "user" ? "none" : "1.5px solid var(--line)", borderRadius: m.rol === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    padding: "10px 14px", fontFamily: "var(--sans)", fontSize: 15, lineHeight: 1.45, boxShadow: m.rol === "user" ? "0 3px 0 var(--green-deep)" : "0 2px 0 oklch(0.88 0.03 120)",
                  }}>
                    {m.canal === "voz" && <span aria-label="dictado" style={{ marginRight: 6 }}>🎙️</span>}
                    {m.texto}
                  </div>
                  {m.rol === "assistant" && voz.soportaTTS && i > 0 && (
                    <button type="button" onClick={() => voz.hablar(m.texto)} aria-label="Escuchar este mensaje" style={{ marginTop: 4, border: "none", background: "transparent", color: "var(--ink-soft)", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 4px" }}>🔊 Escuchar</button>
                  )}
                  {m.accion?.tipo === "confirmar_solicitud" && borrador && i === msgs.length - 1 && (
                    <TarjetaBorrador b={borrador} auto={m.accion.autocompletado} cargando={creando}
                      onConfirmar={() => crearDesdeBorrador(borrador, "voz")} onEditar={() => setModal({ b: borrador, paso: 0 })} />
                  )}
                  {m.accion?.tipo === "mostrar_impacto" && <TarjetaImpacto imp={m.accion.impacto} />}
                </div>
              ))}
              {pensando && (
                <div className="msg-in" style={{ alignSelf: "flex-start", background: "var(--cream)", border: "1.5px solid var(--line)", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", display: "flex", gap: 5 }} aria-label="Reci está pensando">
                  {[0, 1, 2].map((d) => <span key={d} className="typing-dot" style={{ animationDelay: d * 0.15 + "s" }} />)}
                </div>
              )}
              {voz.escuchando && (
                <div style={{ alignSelf: "flex-end", maxWidth: "88%", fontFamily: "var(--sans)", fontSize: 15, fontStyle: "italic", color: "var(--ink-soft)", padding: "6px 10px" }}>
                  {voz.parcial || "Te escucho…"}
                </div>
              )}
            </div>

            {/* sugerencias */}
            {sugerencias.length > 0 && !voz.escuchando && (
              <div className="no-bar" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "4px 16px 10px" }}>
                {sugerencias.map((s) => (
                  <button key={s} type="button" onClick={() => enviar(s, "texto")} style={{ flexShrink: 0, fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13.5, color: "var(--green-deep)", background: "var(--cream)", border: "1.5px solid var(--green-soft)", borderRadius: 999, padding: "7px 13px", cursor: "pointer" }}>{s}</button>
                ))}
              </div>
            )}

            {/* entrada */}
            <form onSubmit={(e) => { e.preventDefault(); enviar(texto, "texto"); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px max(14px, env(safe-area-inset-bottom))", borderTop: "1px solid var(--line)", background: "var(--cream-card)" }}>
              {vozActiva && voz.soportaSTT && (
                <button type="button" onClick={dictar} aria-label={voz.escuchando ? "Detener dictado" : "Dictar mensaje"} aria-pressed={voz.escuchando}
                  className={voz.escuchando ? "mic-on" : ""}
                  style={{ position: "relative", width: 58, height: 58, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0, display: "grid", placeItems: "center",
                    background: voz.escuchando ? "var(--pink)" : "var(--green)", boxShadow: `0 4px 0 ${voz.escuchando ? "oklch(0.6 0.16 8)" : "var(--green-deep)"}`,
                    transform: `scale(${1 + voz.nivel * 0.12})`, transition: "transform .08s, background .2s" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {voz.escuchando ? <rect x="7" y="7" width="10" height="10" rx="2" fill="#fff" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>}
                  </svg>
                </button>
              )}
              <label style={{ flex: 1, minWidth: 0 }}>
                <span className="sr-only">Escribe tu mensaje</span>
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={voz.escuchando ? "Escuchando…" : "Escribe o dicta tu pedido…"}
                  style={{ width: "100%", fontFamily: "var(--sans)", fontSize: 15.5, color: "var(--ink)", background: "#fff", border: "1.5px solid var(--line)", borderRadius: 999, padding: "13px 16px", outline: "none" }} />
              </label>
              <button type="submit" aria-label="Enviar" disabled={!texto.trim()} style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: texto.trim() ? "var(--green-deep)" : "var(--line)", cursor: texto.trim() ? "pointer" : "default", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="arrowRight" size={20} stroke="#fff" sw={2.4} />
              </button>
            </form>
          </section>
        </div>
      )}

      <NuevaSolicitudModal open={!!modal} onClose={() => setModal(null)} canal="voz"
        inicial={modal ? {
          paso: modal.paso,
          data: { tipos: modal.b.tipos || [], kg: Math.round(modal.b.cantidad_kg || 5), dia: modal.b.dia_offset ?? 1, franja: modal.b.franja_horaria || "manana",
            direccion: modal.b.direccion || "", lat: modal.b.latitud ?? null, lon: modal.b.longitud ?? null },
        } : null}
        onSubmit={() => { setModal(null); setBorrador(null); navigate("/ciudadano/solicitudes"); setAbierto(false); }} />
    </>
  );
}
