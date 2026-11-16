import React, { useState, useEffect, useRef } from "react";
import { Icon, PrimaryButton, GhostButton, StatusBadge } from "../ui/Primitivos";
import { FRANJAS } from "../../lib/datos";
import { enviarOEncolar } from "../../lib/colaOffline";
import { usePerfil } from "../../context/PerfilContext";
import { useFeedback } from "../../context/FeedbackContext";
import { useConfetti } from "../ui/useConfetti";
import ReciMascota from "../Reci/ReciMascota";
import BarraPasos from "./BarraPasos";
import Paso1Tipo from "./Paso1Tipo";
import Paso2Cantidad from "./Paso2Cantidad";
import Paso3FechaFranja from "./Paso3FechaFranja";
import Paso4Confirmacion from "./Paso4Confirmacion";

const PISTAS = [
  "Elige al menos un material para continuar.",
  "",
  "",
  "Escribe tu dirección y toca el mapa para marcar el punto de recojo.",
];

function SolicitudCreada({ data, onClose, encolada }) {
  const franja = FRANJAS.find((f) => f.id === data.franja);
  return (
    <div className="screen" style={{ textAlign: "center", padding: "10px 0 6px" }}>
      <ReciMascota estado="celebrando" size={96} style={{ margin: "6px auto 20px" }} />
      <h3 style={{ fontFamily: "var(--serif)", fontSize: 28, color: "var(--ink)", margin: "0 0 8px" }}>{encolada ? "¡Guardada sin conexión!" : "¡Solicitud creada!"}</h3>
      <p style={{ fontFamily: "var(--sans)", fontSize: 15, color: "var(--ink-soft)", margin: "0 auto 20px", maxWidth: 340, lineHeight: 1.55 }}>{encolada
        ? <>No hay señal ahora, pero tu pedido quedó guardado en el celular. <strong style={{ color: "var(--ink)" }}>Se enviará solo</strong> apenas vuelva la conexión.</>
        : <>Buscamos un reciclador disponible cerca de <strong style={{ color: "var(--ink)" }}>{data.direccion}</strong>. Te avisaremos cuando alguien la acepte.</>}</p>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 22 }}>{encolada ? <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: "#fff", background: "var(--orange)", borderRadius: 999, padding: "4px 11px" }}>⏳ En cola</span> : <StatusBadge estado="pendiente" />}<span style={{ fontFamily: "var(--sans)", fontSize: 13.5, color: "var(--ink-soft)" }}>{data.kg} kg · {franja?.label}</span></div>
      <div><PrimaryButton type="button" onClick={onClose} full>Ver mis solicitudes</PrimaryButton></div>
    </div>
  );
}

function datosIniciales(derivado) {
  // Personalización continua: arranca con lo que el usuario suele elegir
  return {
    tipos: [], kg: derivado?.kg_sugerido || 5, dia: 0,
    franja: derivado?.franja_preferida || "manana",
    direccion: derivado?.direccion_habitual || "",
    lat: derivado?.coords_habituales?.[0] ?? null, lon: derivado?.coords_habituales?.[1] ?? null,
  };
}

/**
 * Props:
 *  - inicial: { paso, data }  prellenado (p. ej. desde el asistente de voz)
 *  - canal:   "tactil" | "voz" (telemetría para el perfil adaptativo)
 */
export default function NuevaSolicitudModal({ open, onClose, onSubmit, inicial, canal = "tactil" }) {
  const { perfil, registrar, refrescar } = usePerfil();
  const { avisar } = useFeedback();
  const { burst } = useConfetti();
  const [paso, setPaso] = useState(0);
  const [data, setData] = useState(datosIniciales(perfil.derivado));
  const [status, setStatus] = useState("idle");
  const [encolada, setEncolada] = useState(false);
  const [pista, setPista] = useState("");
  const [shake, setShake] = useState(false);
  const t0 = useRef(Date.now());
  const tPaso = useRef(Date.now());
  const set = (patch) => { setData((d) => ({ ...d, ...patch })); setPista(""); };

  useEffect(() => {
    if (open) {
      const base = datosIniciales(perfil.derivado);
      setPaso(inicial?.paso || 0);
      setData(inicial?.data ? { ...base, ...inicial.data } : base);
      setStatus("idle"); setPista("");
      t0.current = Date.now(); tPaso.current = Date.now();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;

  const puedeSeguir = paso === 0
    ? data.tipos.length > 0
    : paso === 3
      ? data.direccion.trim().length > 3 && data.lat !== null && data.lon !== null
      : true;

  const intentarSinCompletar = () => {
    // Micro-interacción de error + el perfil aprende (3 seguidos => frustración inferida)
    setPista(PISTAS[paso]);
    setShake(true); setTimeout(() => setShake(false), 450);
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    registrar("error", { contexto: `nueva_solicitud_paso_${paso + 1}`, canal });
  };

  const next = async () => {
    if (!puedeSeguir) { intentarSinCompletar(); return; }
    registrar("paso_completado", { paso: paso + 1, duracion_seg: Math.round((Date.now() - tPaso.current) / 1000), canal });
    tPaso.current = Date.now();
    if (paso < 3) { setPaso(paso + 1); return; }
    setStatus("loading");
    try {
      const hoy = new Date();
      hoy.setDate(hoy.getDate() + data.dia);
      const fecha = hoy.toISOString().split("T")[0];
      const r = await enviarOEncolar("solicitud", {
        tipo_residuo: data.tipos[0],
        cantidad_kg: data.kg,
        fecha_recoleccion: fecha,
        franja_horaria: data.franja,
        direccion: data.direccion,
        ...(data.lat !== null && { latitud: data.lat, longitud: data.lon }),
        canal, duracion_seg: Math.round((Date.now() - t0.current) / 1000),
      }, `Recojo de ${data.kg} kg`);
      setEncolada(r.encolada);
      setStatus("done");
      burst({ x: 0.5, y: 0.55 });
      refrescar();
    } catch {
      setStatus("idle");
      registrar("error", { contexto: "crear_solicitud", canal });
      avisar("No pudimos crear la solicitud. Revisa tu conexión e inténtalo de nuevo.", "error");
    }
  };

  const steps = [Paso1Tipo, Paso2Cantidad, Paso3FechaFranja, Paso4Confirmacion];
  const StepComp = steps[paso];
  const frustrado = perfil.derivado?.emocion_actual === "frustracion";

  return (
    <div className="ov-anim" style={{ position: "fixed", inset: 0, zIndex: 100, background: "oklch(0.2 0.02 140 / 0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
      <div role="dialog" aria-label="Nueva solicitud de recolección" onClick={(e) => e.stopPropagation()} className="sheet-anim" style={{ width: "min(560px, 100%)", maxHeight: "94vh", display: "flex", flexDirection: "column", background: "var(--cream-card)", borderRadius: "26px 26px 0 0", boxShadow: "0 -10px 50px -10px oklch(0.2 0.04 130 / 0.4)", overflow: "hidden" }}>
        {/* header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 11, background: "var(--green)", display: "grid", placeItems: "center" }}><Icon name="truck" size={20} stroke="#fff" /></span>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", margin: 0 }}>Nueva solicitud</h2>
            </div>
            <button type="button" aria-label="Cerrar" onClick={onClose} style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid var(--line)", background: "var(--cream)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="x" size={18} stroke="var(--ink-soft)" /></button>
          </div>
          {status !== "done" && <BarraPasos paso={paso} />}
        </div>

        {/* body */}
        <div className="no-bar" style={{ padding: 22, overflowY: "auto", flex: 1 }}>
          {status !== "done" && frustrado && paso === 0 && (
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("reci:abrir")); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "color-mix(in oklch, var(--orange) 12%, var(--cream-card))", border: "1.5px solid var(--orange)", borderRadius: 16, padding: "10px 14px", marginBottom: 16, cursor: "pointer" }}>
              <ReciMascota estado="empatico" size={44} />
              <span style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink)" }}><strong>¿Se complicó?</strong> Dímelo con tu voz y yo lleno todo por ti.</span>
            </button>
          )}
          {status === "done"
            ? <SolicitudCreada data={data} encolada={encolada} onClose={() => { onSubmit && onSubmit(data); onClose(); }} />
            : <StepComp data={data} set={set} />}
        </div>

        {/* footer */}
        {status !== "done" && (
          <div style={{ padding: "12px 22px 16px", borderTop: "1px solid var(--line)", background: "var(--cream-card)" }}>
            {pista && <p role="alert" style={{ margin: "0 0 10px", fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600, color: "oklch(0.5 0.16 30)", display: "flex", alignItems: "center", gap: 6 }}><Icon name="alert" size={15} stroke="oklch(0.5 0.16 30)" />{pista}</p>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              {paso > 0 ? <GhostButton onClick={() => { setPaso(paso - 1); setPista(""); }}><Icon name="chevronLeft" size={18} stroke="var(--ink-soft)" />Atrás</GhostButton> : <span />}
              <span className={shake ? "shake" : ""} style={{ display: "inline-flex" }}>
                <PrimaryButton type="button" loading={status === "loading"} onClick={next} color={puedeSeguir ? "var(--green)" : "var(--line)"} deep={puedeSeguir ? "var(--green-deep)" : "oklch(0.8 0.02 120)"} size="sm">
                  {paso === 3 ? "Confirmar solicitud" : "Siguiente"}{paso < 3 && <Icon name="arrowRight" size={18} stroke="#fff" />}
                </PrimaryButton>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
