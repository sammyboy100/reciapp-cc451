// Preferencias explícitas (voz, accesibilidad, tono) + transparencia de lo aprendido.
import React from "react";
import { Icon } from "../ui/Primitivos";
import { usePerfil } from "../../context/PerfilContext";
import { useFeedback } from "../../context/FeedbackContext";
import { useVoz } from "../../hooks/useVoz";
import { MAT, FRANJAS } from "../../lib/datos";
import { pedirPermiso, notificar, soportaNotificaciones } from "../../lib/notificaciones";

function Interruptor({ label, desc, on, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{label}</span>
        {desc && <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-soft)" }}>{desc}</span>}
      </span>
      <input type="checkbox" role="switch" checked={!!on} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span aria-hidden="true" style={{ width: 52, height: 30, borderRadius: 999, background: on ? "var(--green)" : "var(--line)", position: "relative", transition: "background .2s", flexShrink: 0, boxShadow: on ? "inset 0 -3px 0 var(--green-deep)" : "none" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px oklch(0 0 0 / 0.2)", transition: "left .2s cubic-bezier(.34,1.56,.64,1)" }} />
      </span>
    </label>
  );
}

function Segmentado({ label, valor, opciones, onChange }) {
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 8 }}>{label}</span>
      <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {opciones.map(([id, txt]) => (
          <button key={id} type="button" role="radio" aria-checked={valor === id} onClick={() => onChange(id)}
            style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, padding: "9px 14px", borderRadius: 999, cursor: "pointer", border: "1.5px solid " + (valor === id ? "var(--green)" : "var(--line)"), background: valor === id ? "var(--green)" : "var(--cream-card)", color: valor === id ? "#fff" : "var(--ink)" }}>{txt}</button>
        ))}
      </div>
    </div>
  );
}

const EMO = { alegria: "😄 Con energía", calma: "🙂 Tranquilo", cansancio: "😴 Cansado", ansiedad: "😬 Apurado", frustracion: "😤 Frustrado", tristeza: "😔 Triste" };
const TONO = { amigable: "Amigable", empatico: "Empático", celebratorio: "Festivo", directo: "Directo", calido: "Cálido", formal: "Formal" };

export default function PanelAccesibilidad() {
  const { perfil, preferir } = usePerfil();
  const { avisar } = useFeedback();
  const p = perfil.preferencias || {};
  const d = perfil.derivado || {};
  const ap = perfil.aprendido || {};
  const voz = useVoz({ velocidad: d.velocidad_voz || 1 });
  const cambiar = async (c) => { await preferir(c); avisar("Guardado", "exito", 1600); };
  const adaptativa = p.velocidad_voz == null;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section id="preferencias" style={{ background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 22, padding: "8px 22px 14px", boxShadow: "0 2px 0 oklch(0.88 0.03 120)" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)", margin: "14px 0 4px", display: "flex", alignItems: "center", gap: 10 }}><Icon name="settings" size={22} stroke="var(--green-deep)" />Voz y accesibilidad</h2>
        <p style={{ fontFamily: "var(--sans)", fontSize: 13.5, color: "var(--ink-soft)", margin: "0 0 4px" }}>También puedes pedírselo a Reci: «letra más grande», «habla más lento», «léeme en voz alta».</p>
        <Interruptor label="Asistente de voz" desc="Muestra el micrófono para dictar pedidos y mensajes." on={p.voz_activada} onChange={(v) => cambiar({ voz_activada: v })} />
        <Interruptor label="Leer respuestas en voz alta" desc="Reci y los avisos de tus salas se escuchan automáticamente." on={p.lectura_automatica} onChange={(v) => cambiar({ lectura_automatica: v })} />
        <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>Velocidad de voz · {d.velocidad_voz?.toFixed(2)}×</span>
            <button type="button" onClick={() => voz.hablar(`Hola, así sueno a esta velocidad. Tono ${TONO[d.tono_asistente] || "amigable"}.`)} style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: "var(--green-deep)", background: "var(--cream)", border: "1.5px solid var(--green-soft)", borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}>🔊 Probar</button>
          </div>
          <input type="range" min="0.6" max="1.4" step="0.05" value={p.velocidad_voz ?? d.velocidad_voz ?? 1} aria-label="Velocidad de voz"
            onChange={(e) => preferir({ velocidad_voz: parseFloat(e.target.value) })} style={{ width: "100%", accentColor: "var(--green)", marginTop: 10 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--sans)", fontSize: 13.5, color: "var(--ink-soft)", marginTop: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={adaptativa} onChange={(e) => cambiar(e.target.checked ? { usar_velocidad_adaptativa: true } : { velocidad_voz: d.velocidad_voz || 1 })} style={{ accentColor: "var(--green)", width: 18, height: 18 }} />
            Adaptativa: se ajusta a tu ritmo y a cómo te sientes
          </label>
        </div>
        <Segmentado label="Tamaño de letra" valor={p.tamano_fuente} onChange={(v) => cambiar({ tamano_fuente: v })} opciones={[["normal", "Normal"], ["grande", "Grande"], ["muy_grande", "Muy grande"]]} />
        <Segmentado label="Tono de Reci" valor={p.tono_preferido} onChange={(v) => cambiar({ tono_preferido: v })} opciones={[["auto", "Automático"], ["amigable", "Amigable"], ["formal", "Formal"], ["celebratorio", "Festivo"]]} />
        <Interruptor label="Alto contraste" desc="Textos y bordes más oscuros." on={p.alto_contraste} onChange={(v) => cambiar({ alto_contraste: v })} />
        <Interruptor label="Reducir animaciones" desc="Sin movimientos ni confeti." on={p.reducir_movimiento} onChange={(v) => cambiar({ reducir_movimiento: v })} />
        <Interruptor label="Modo simple" desc="Reci te guía paso a paso con frases cortas." on={p.modo_simple} onChange={(v) => cambiar({ modo_simple: v })} />
        {soportaNotificaciones() && (
          <Interruptor label="Notificaciones del sistema" desc="Te avisamos cuando aceptan tu recojo, el reciclador va en camino o hay novedades en tus salas, aunque la app esté en segundo plano."
            on={p.notificaciones} onChange={async (v) => {
              if (!v) { cambiar({ notificaciones: false }); return; }
              const permiso = await pedirPermiso();
              if (permiso === "granted") { await cambiar({ notificaciones: true }); notificar("Notificaciones activadas ✅", "Así te avisaremos de tus recojos y salas.", "/perfil"); }
              else avisar("El navegador no dio permiso. Actívalo en la configuración del sitio.", "error", 5000);
            }} />
        )}
      </section>

      <section style={{ background: "var(--cream-card)", border: "1.5px dashed var(--green-soft)", borderRadius: 22, padding: "16px 22px 18px" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", margin: "0 0 4px" }}>Lo que ReciApp aprendió de ti ✨</h2>
        <p style={{ fontFamily: "var(--sans)", fontSize: 13.5, color: "var(--ink-soft)", margin: "0 0 12px" }}>Se actualiza con cada uso para ahorrarte pasos. Tú siempre puedes cambiarlo arriba.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[
            ["Material habitual", d.material_frecuente ? MAT[d.material_frecuente]?.label : "Aún no"],
            ["Franja preferida", FRANJAS.find((f) => f.id === d.franja_preferida)?.label || "Aún no"],
            ["Tu ritmo", { rapido: "Rápido ⚡", normal: "Normal", pausado: "Pausado 🐢" }[d.ritmo] || "Normal"],
            ["Canal favorito", { voz: "Voz 🎙️", texto: "Texto ✍️", tactil: "Táctil 👆" }[d.canal_preferido] || "Táctil"],
            ["Cómo te sientes", EMO[d.emocion_actual] || "Sin dato"],
            ["Tono de Reci", TONO[d.tono_asistente] || "Amigable"],
            ["Nivel de guía", { guiado: "Paso a paso", estandar: "Estándar", experto: "Experto" }[d.nivel_guia]],
            ["Interacciones", ap.interacciones ?? 0],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "var(--cream)", borderRadius: 14, padding: "10px 12px" }}>
              <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--ink-soft)" }}>{k}</div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
