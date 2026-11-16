// PC3 · Jornadas de recojo compartidas: la colaboración pasa del chat a la acción.
// Un vecino organiza, los demás se suman con su material, un reciclador la toma y la completa.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Icon, PrimaryButton, GhostButton, Field } from "../ui/Primitivos";
import { MATERIALES, MAT, FRANJAS } from "../../lib/datos";
import { useFeedback } from "../../context/FeedbackContext";
import { useAuth } from "../../context/AuthContext";
import { useConfetti } from "../ui/useConfetti";
import { listarJornadas, crearJornada, participarJornada, retirarseJornada, tomarJornada, completarJornada } from "../../api/salas";

const ESTADO = {
  abierta:    { label: "Abierta",    bg: "var(--yellow)", fg: "var(--ink)" },
  asignada:   { label: "Con reciclador", bg: "var(--blue)", fg: "#fff" },
  completada: { label: "Completada", bg: "var(--green)", fg: "#fff" },
  cancelada:  { label: "Cancelada",  bg: "var(--line)", fg: "var(--ink)" },
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

function Chip({ on, children, onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label}
      style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5, padding: "8px 12px", minHeight: 40, borderRadius: 999, cursor: "pointer", border: "1.5px solid " + (on ? "var(--green)" : "var(--line)"), background: on ? "var(--green)" : "var(--cream-card)", color: on ? "#fff" : "var(--ink)" }}>{children}</button>
  );
}

function FormSumarme({ inicial, onGuardar, onCancelar }) {
  const [mat, setMat] = useState(inicial?.tipo_residuo || "carton");
  const [kg, setKg] = useState(inicial?.cantidad_kg || 3);
  return (
    <div className="pop" style={{ marginTop: 10, background: "var(--cream)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div role="radiogroup" aria-label="Material" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MATERIALES.map((m) => <Chip key={m.id} on={mat === m.id} onClick={() => setMat(m.id)}>{m.label}</Chip>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" aria-label="Menos kilos" onClick={() => setKg((k) => Math.max(1, k - 1))} style={{ width: 44, height: 44, borderRadius: "50%", border: "1.5px solid var(--line)", background: "var(--cream-card)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="minus" size={18} stroke="var(--ink)" /></button>
        <span aria-live="polite" style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--ink)", minWidth: 70, textAlign: "center" }}>{kg} kg</span>
        <button type="button" aria-label="Más kilos" onClick={() => setKg((k) => Math.min(200, k + 1))} style={{ width: 44, height: 44, borderRadius: "50%", border: "1.5px solid var(--line)", background: "var(--cream-card)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="plus" size={18} stroke="var(--ink)" /></button>
        <span style={{ flex: 1 }} />
        <GhostButton onClick={onCancelar}>Cancelar</GhostButton>
        <PrimaryButton type="button" size="sm" onClick={() => onGuardar({ tipo_residuo: mat, cantidad_kg: kg })}><Icon name="check" size={16} stroke="#fff" />Listo</PrimaryButton>
      </div>
    </div>
  );
}

function TarjetaJornada({ j, rol, uid, onAccion }) {
  const [form, setForm] = useState(false);
  const [d, m] = [Number(j.fecha.slice(8, 10)), MESES[Number(j.fecha.slice(5, 7)) - 1]];
  const e = ESTADO[j.estado] || ESTADO.abierta;
  const franja = FRANJAS.find((f) => f.id === j.franja_horaria);
  const mio = j.participantes.find((p) => p.usuario_id === uid);
  const activa = j.estado === "abierta" || j.estado === "asignada";
  return (
    <article style={{ border: "1.5px solid var(--line)", borderRadius: 16, padding: 14, background: "var(--cream-card)" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div role="img" aria-label={`Fecha ${d} de ${m}`} style={{ width: 56, flexShrink: 0, alignSelf: "flex-start", borderRadius: 12, background: "var(--green)", color: "#fff", textAlign: "center", padding: "6px 0", boxShadow: "0 3px 0 var(--green-deep)" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 26, lineHeight: 1 }}>{d}</div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{m}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h4 style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)", fontWeight: 400 }}>{j.titulo}</h4>
            <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 700, background: e.bg, color: e.fg, borderRadius: 999, padding: "2px 9px" }}>{e.label}</span>
          </div>
          <p style={{ margin: "3px 0 0", fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-soft)" }}>{franja?.label} · {j.punto_encuentro}</p>
          <p style={{ margin: "6px 0 0", fontFamily: "var(--sans)", fontSize: 13.5, color: "var(--ink)" }}>
            <strong>{j.kg_total} kg</strong> · {j.participantes.length} vecino{j.participantes.length !== 1 ? "s" : ""}
            {j.reciclador && <> · 🚲 {j.reciclador.split(" ")[0]}</>}
          </p>
          {j.participantes.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
              {j.participantes.map((p) => (
                <span key={p.usuario_id} title={`${p.nombre}: ${p.cantidad_kg} kg de ${MAT[p.tipo_residuo]?.label}`} style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, color: p.tipo_residuo === "papel" ? "var(--ink)" : "#fff", background: MAT[p.tipo_residuo]?.color || "var(--green)", borderRadius: 999, padding: "2px 8px" }}>
                  {p.nombre.split(" ")[0]} · {p.cantidad_kg}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {activa && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {rol === "ciudadano" && !form && (mio
            ? <><GhostButton onClick={() => setForm(true)}><Icon name="edit" size={15} stroke="var(--ink-soft)" />Cambiar ({mio.cantidad_kg} kg)</GhostButton>
                <GhostButton onClick={() => onAccion("retirarse", j)}>Retirarme</GhostButton></>
            : <PrimaryButton type="button" size="sm" onClick={() => setForm(true)}><Icon name="plus" size={16} stroke="#fff" />Sumarme</PrimaryButton>)}
          {rol === "reciclador" && j.estado === "abierta" && <PrimaryButton type="button" size="sm" onClick={() => onAccion("tomar", j)}><Icon name="truck" size={16} stroke="#fff" />Tomar jornada</PrimaryButton>}
          {rol === "reciclador" && j.estado === "asignada" && j.reciclador_id === uid && <PrimaryButton type="button" size="sm" onClick={() => onAccion("completar", j)}><Icon name="check" size={16} stroke="#fff" />Marcar completada</PrimaryButton>}
        </div>
      )}
      {form && <FormSumarme inicial={mio} onCancelar={() => setForm(false)} onGuardar={(datos) => { setForm(false); onAccion("participar", j, datos); }} />}
    </article>
  );
}

function FormNueva({ onCrear, onCancelar }) {
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ titulo: "", fecha: manana, franja_horaria: "manana", punto_encuentro: "" });
  const [err, setErr] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErr(""); };
  return (
    <form className="pop" onSubmit={(e) => { e.preventDefault(); if (f.titulo.trim().length < 3 || f.punto_encuentro.trim().length < 4) { setErr("Completa el nombre y el punto de encuentro."); return; } onCrear(f); }}
      style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--cream)", borderRadius: 14, padding: 12 }}>
      <Field label="Nombre de la jornada" value={f.titulo} onChange={(v) => set("titulo", v)} placeholder="Ej. Cartón del parque" error={err} />
      <label style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13.5, color: "var(--ink)", display: "flex", flexDirection: "column", gap: 6 }}>
        Fecha
        <input type="date" value={f.fecha} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set("fecha", e.target.value)} style={{ fontFamily: "var(--sans)", fontSize: 15, padding: "11px 14px", borderRadius: 14, border: "1.5px solid var(--line)", background: "#fff", color: "var(--ink)" }} />
      </label>
      <div role="radiogroup" aria-label="Franja horaria" style={{ display: "flex", gap: 6 }}>
        {FRANJAS.map((x) => <Chip key={x.id} on={f.franja_horaria === x.id} onClick={() => set("franja_horaria", x.id)}>{x.label}</Chip>)}
      </div>
      <Field label="Punto de encuentro" value={f.punto_encuentro} onChange={(v) => set("punto_encuentro", v)} placeholder="Ej. Losa deportiva, Jr. Los Pinos" />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <GhostButton onClick={onCancelar}>Cancelar</GhostButton>
        <PrimaryButton size="sm"><Icon name="calendar" size={16} stroke="#fff" />Organizar</PrimaryButton>
      </div>
    </form>
  );
}

const JornadasSala = forwardRef(function JornadasSala({ salaId, rol, refrescoSala }, ref) {
  const { avisar } = useFeedback();
  const { burst } = useConfetti();
  const [lista, setLista] = useState([]);
  const [nueva, setNueva] = useState(false);
  const { user } = useAuth();
  const uid = user?.id;

  const recargar = useCallback(() => listarJornadas(salaId).then(setLista).catch(() => {}), [salaId]);
  useImperativeHandle(ref, () => ({ recargar }), [recargar]);
  useEffect(() => { recargar(); }, [recargar]);

  const accion = async (tipo, j, datos) => {
    try {
      if (tipo === "participar") { await participarJornada(salaId, j.id, datos); avisar("¡Te sumaste a la jornada! 🙌", "exito"); }
      if (tipo === "retirarse") { await retirarseJornada(salaId, j.id); avisar("Te retiraste de la jornada", "info"); }
      if (tipo === "tomar") { await tomarJornada(salaId, j.id); avisar("Jornada tomada. ¡Gracias!", "exito"); }
      if (tipo === "completar") { await completarJornada(salaId, j.id); burst(); avisar("Jornada completada 🎉", "exito"); refrescoSala?.(); }
      recargar();
    } catch (e) {
      avisar(e.response?.data?.detail || "No se pudo completar la acción", "error");
    }
  };

  const proximas = lista.filter((j) => j.estado !== "completada" && j.estado !== "cancelada");
  const pasadas = lista.filter((j) => j.estado === "completada").slice(-2);

  return (
    <section aria-label="Jornadas de recojo compartidas" style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 22, padding: "16px 18px", boxShadow: "0 2px 0 oklch(0.88 0.03 120)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 21, margin: 0, color: "var(--ink)" }}>Jornadas de recojo</h2>
        {!nueva && rol === "ciudadano" && <GhostButton onClick={() => setNueva(true)}><Icon name="plus" size={15} stroke="var(--ink-soft)" />Organizar</GhostButton>}
      </div>
      {nueva && <div style={{ marginBottom: 12 }}><FormNueva onCancelar={() => setNueva(false)} onCrear={async (f) => {
        try { await crearJornada(salaId, f); setNueva(false); avisar("Jornada organizada. Tus vecinos ya fueron avisados 📅", "exito"); recargar(); }
        catch (e) { avisar(e.response?.data?.detail?.[0]?.msg || "Revisa los datos de la jornada", "error"); }
      }} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {proximas.length === 0 && !nueva && <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-soft)" }}>No hay jornadas próximas. ¡Organiza la primera y juntos rinde más!</p>}
        {proximas.map((j) => <TarjetaJornada key={j.id} j={j} rol={rol} uid={uid} onAccion={accion} />)}
        {pasadas.map((j) => <TarjetaJornada key={j.id} j={j} rol={rol} uid={uid} onAccion={accion} />)}
      </div>
    </section>
  );
});

export default JornadasSala;
