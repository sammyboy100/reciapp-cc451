// Multiusuario: salas colaborativas (barrio, condominio, colegio, empresa).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Icon, PageHead, PrimaryButton, GhostButton, Field, Starburst } from "../components/ui/Primitivos";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { misSalas, explorarSalas, crearSala, unirsePorCodigo, unirseSala } from "../api/salas";

export const TIPOS_SALA = {
  barrio:     { label: "Barrio",     color: "var(--green)",  icon: "home" },
  condominio: { label: "Condominio", color: "var(--blue)",   icon: "shield" },
  colegio:    { label: "Colegio",    color: "var(--orange)", icon: "clipboard" },
  empresa:    { label: "Empresa",    color: "var(--pink)",   icon: "truck" },
};

export function BarraMeta({ kg, meta, alto = 10, claro }) {
  const p = Math.min(1, meta ? kg / meta : 0);
  return (
    <div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={kg} aria-label={`${kg} de ${meta} kilos`} style={{ height: alto, borderRadius: 999, background: claro ? "oklch(0.45 0.12 143)" : "oklch(0.9 0.03 120)", overflow: "hidden" }}>
        <div className="barra-crece" style={{ width: `${Math.max(3, p * 100)}%`, height: "100%", borderRadius: 999, background: p >= 1 ? "var(--yellow)" : claro ? "var(--yellow)" : "var(--green)" }} />
      </div>
    </div>
  );
}

function SalaCard({ s, onAbrir, onUnirse }) {
  const [h, setH] = useState(false);
  const t = TIPOS_SALA[s.tipo] || TIPOS_SALA.barrio;
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: "var(--cream-card)", border: "1.5px solid " + (h ? t.color : "var(--line)"), borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12,
        boxShadow: h ? "0 12px 26px -16px oklch(0.3 0.04 130 / 0.55)" : "0 2px 0 oklch(0.88 0.03 120)", transform: h ? "translateY(-3px)" : "none", transition: "all .15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 50, height: 50, borderRadius: 15, background: t.color, display: "grid", placeItems: "center", fontSize: 26, flexShrink: 0, boxShadow: "inset 0 -4px 0 oklch(0 0 0 / 0.12)" }}>{s.emoji || "♻️"}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)", margin: 0, lineHeight: 1.15 }}>{s.nombre}</h3>
          <div style={{ display: "flex", gap: 8, marginTop: 4, fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 600, flexWrap: "wrap" }}>
            <span>{t.label}</span>·<span>{s.miembros_count} miembro{s.miembros_count !== 1 ? "s" : ""}</span>{!s.publica && <>·<span>🔒 Privada</span></>}
          </div>
        </div>
      </div>
      {s.descripcion && <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.45 }}>{s.descripcion}</p>}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--sans)", fontSize: 13, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>{s.kg_acumulados} kg</span>
          <span style={{ color: "var(--ink-soft)" }}>Meta {s.meta_kg} kg</span>
        </div>
        <BarraMeta kg={s.kg_acumulados} meta={s.meta_kg} />
      </div>
      <div style={{ marginTop: "auto" }}>
        {s.soy_miembro
          ? <PrimaryButton type="button" size="sm" onClick={onAbrir}>Entrar a la sala<Icon name="arrowRight" size={17} stroke="#fff" /></PrimaryButton>
          : <GhostButton onClick={onUnirse}><Icon name="plus" size={16} stroke="var(--ink-soft)" />Unirme</GhostButton>}
      </div>
    </div>
  );
}

function CrearSalaSheet({ onClose, onCreada }) {
  const [f, setF] = useState({ nombre: "", descripcion: "", tipo: "barrio", meta_kg: 100, emoji: "🏘️", publica: true });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const enviar = async (e) => {
    e.preventDefault();
    if (f.nombre.trim().length < 3) { setError("Ponle un nombre de al menos 3 letras."); return; }
    setCargando(true);
    try { onCreada(await crearSala(f)); } catch { setError("No se pudo crear. Intenta otra vez."); } finally { setCargando(false); }
  };
  const Chip = ({ on, children, onClick }) => (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, padding: "9px 14px", borderRadius: 999, cursor: "pointer", border: "1.5px solid " + (on ? "var(--green)" : "var(--line)"), background: on ? "var(--green)" : "var(--cream-card)", color: on ? "#fff" : "var(--ink)" }}>{children}</button>
  );
  return (
    <div className="ov-anim" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "oklch(0.2 0.02 140 / 0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <form role="dialog" aria-label="Crear sala" onSubmit={enviar} onClick={(e) => e.stopPropagation()} className="sheet-anim" style={{ width: "min(560px, 100%)", maxHeight: "94vh", overflowY: "auto", background: "var(--cream-card)", borderRadius: "26px 26px 0 0", padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, margin: 0, color: "var(--ink)" }}>Nueva sala</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid var(--line)", background: "var(--cream)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="x" size={18} stroke="var(--ink-soft)" /></button>
        </div>
        <Field label="Nombre de la sala" value={f.nombre} onChange={(v) => { set("nombre", v); setError(""); }} placeholder="Ej. Vecinos del Jr. Los Pinos" error={error} />
        <Field label="¿De qué trata? (opcional)" value={f.descripcion} onChange={(v) => set("descripcion", v)} placeholder="Ej. Juntamos cartón para la parroquia" />
        <div>
          <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Tipo</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{Object.entries(TIPOS_SALA).map(([id, t]) => <Chip key={id} on={f.tipo === id} onClick={() => set("tipo", id)}>{t.label}</Chip>)}</div>
        </div>
        <div>
          <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Meta común</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{[50, 100, 200, 500].map((m) => <Chip key={m} on={f.meta_kg === m} onClick={() => set("meta_kg", m)}>{m} kg</Chip>)}</div>
        </div>
        <div>
          <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Ícono</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{["🏘️", "🏢", "🎒", "🏭", "🌳", "♻️", "⛪", "⚽"].map((e) => <Chip key={e} on={f.emoji === e} onClick={() => set("emoji", e)}>{e}</Chip>)}</div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--sans)", fontSize: 14.5, color: "var(--ink)", cursor: "pointer" }}>
          <input type="checkbox" checked={!f.publica} onChange={(e) => set("publica", !e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--green)" }} />
          Sala privada (solo con código de invitación)
        </label>
        <PrimaryButton loading={cargando} full>Crear sala</PrimaryButton>
      </form>
    </div>
  );
}

export default function Salas() {
  const { user, logout } = useAuth();
  const { avisar } = useFeedback();
  const navigate = useNavigate();
  const [mias, setMias] = useState([]);
  const [publicas, setPublicas] = useState([]);
  const [codigo, setCodigo] = useState("");
  const [errCodigo, setErrCodigo] = useState("");
  const [crear, setCrear] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = () => Promise.all([misSalas(), explorarSalas()])
    .then(([a, b]) => { setMias(a); setPublicas(b.filter((s) => !s.soy_miembro)); })
    .catch(() => {}).finally(() => setCargando(false));
  useEffect(() => { cargar(); }, []);

  const unirCodigo = async (e) => {
    e.preventDefault();
    try {
      const s = await unirsePorCodigo(codigo);
      avisar(`¡Bienvenido a ${s.nombre}!`, "exito");
      navigate(`/salas/${s.id}`);
    } catch (err) {
      setErrCodigo(err.response?.data?.detail || "Código no válido");
    }
  };

  return (
    <div className="paper-tex" style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar user={user?.nombre?.split(" ")[0]} role={user?.rol} onLogout={() => { logout(); navigate("/login"); }} />
      <main className="screen" style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(26px, 4vw, 44px) clamp(16px, 4vw, 36px) 120px", position: "relative" }}>
        <div style={{ position: "absolute", right: "2%", top: 10, pointerEvents: "none", animation: "floaty 9s ease-in-out infinite", zIndex: 0 }}><Starburst points={18} color="var(--pink)" size={74} inner={0.52} style={{ opacity: 0.8 }} /></div>
        <PageHead eyebrow="Comunidad" title={<>Reciclar <span style={{ color: "var(--green)", fontStyle: "italic" }}>juntos</span> rinde más</>}
          sub="Únete a la sala de tu barrio, colegio o condominio: metas compartidas, ranking y chat en vivo."
          right={<PrimaryButton type="button" size="sm" onClick={() => setCrear(true)}><Icon name="plus" size={18} stroke="#fff" />Crear sala</PrimaryButton>} />

        <form onSubmit={unirCodigo} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", background: "var(--cream-card)", border: "1.5px dashed var(--green-soft)", borderRadius: 20, padding: "16px 18px", marginBottom: 26 }}>
          <div style={{ flex: "1 1 240px" }}>
            <Field label="¿Te invitaron? Ingresa el código" value={codigo} maxLength={8} onChange={(v) => { setCodigo(v.toUpperCase()); setErrCodigo(""); }} placeholder="Ej. STROSA" error={errCodigo} />
          </div>
          <PrimaryButton size="sm"><Icon name="arrowRight" size={17} stroke="#fff" />Unirme</PrimaryButton>
        </form>

        <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--ink)", margin: "0 0 14px" }}>Mis salas</h2>
        {cargando ? <p style={{ fontFamily: "var(--sans)", color: "var(--ink-soft)" }}>Cargando…</p> :
          mias.length === 0 ? (
            <div style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 20, padding: 26, textAlign: "center", fontFamily: "var(--sans)", color: "var(--ink-soft)" }}>
              Aún no estás en ninguna sala. Crea una o únete a la de tus vecinos 👇
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {mias.map((s) => <SalaCard key={s.id} s={s} onAbrir={() => navigate(`/salas/${s.id}`)} />)}
            </div>
          )}

        {publicas.length > 0 && <>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--ink)", margin: "34px 0 14px" }}>Salas públicas cerca</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {publicas.map((s) => <SalaCard key={s.id} s={s} onUnirse={async () => { await unirseSala(s.id); avisar(`Te uniste a ${s.nombre}`, "exito"); navigate(`/salas/${s.id}`); }} />)}
          </div>
        </>}
      </main>
      {crear && <CrearSalaSheet onClose={() => setCrear(false)} onCreada={(s) => { setCrear(false); avisar("¡Sala creada! Comparte el código " + s.codigo, "exito", 5000); navigate(`/salas/${s.id}`); }} />}
    </div>
  );
}
