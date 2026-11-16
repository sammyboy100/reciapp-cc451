// PWA: aviso de instalación (beforeinstallprompt) y estado sin conexión.
import React, { useEffect, useState } from "react";
import { Icon, ReciLogo } from "../ui/Primitivos";
import { leerCola } from "../../lib/colaOffline";

export default function BarraPWA() {
  const [evento, setEvento] = useState(null);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pendientes, setPendientes] = useState(() => leerCola().length);
  const [oculto, setOculto] = useState(() => { try { return localStorage.getItem("reciapp_pwa_oculto") === "1"; } catch { return false; } });

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvento(e); };
    const on = () => setOnline(true), off = () => setOnline(false);
    const onCola = (e) => setPendientes(e.detail?.pendientes ?? leerCola().length);
    window.addEventListener("reciapp:cola", onCola);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("reciapp:cola", onCola); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const instalar = async () => { evento.prompt(); await evento.userChoice; setEvento(null); };
  const cerrar = () => { setOculto(true); try { localStorage.setItem("reciapp_pwa_oculto", "1"); } catch { /* sin storage */ } };

  return (
    <>
      {!online && (
        <div role="status" style={{ position: "sticky", top: 0, zIndex: 60, background: "var(--orange)", color: "#fff", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, textAlign: "center", padding: "8px 16px" }}>
          Sin conexión · Puedes ver lo que ya cargaste; tus acciones se enviarán al volver la red.{pendientes > 0 && ` (${pendientes} en cola)`}
        </div>
      )}
      {online && pendientes > 0 && (
        <div role="status" style={{ position: "sticky", top: 0, zIndex: 60, background: "var(--blue)", color: "#fff", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, textAlign: "center", padding: "8px 16px" }}>
          Enviando {pendientes} acción{pendientes > 1 ? "es" : ""} guardada{pendientes > 1 ? "s" : ""} sin conexión…
        </div>
      )}
      {evento && !oculto && (
        <div className="pop" style={{ position: "fixed", left: 16, bottom: 18, zIndex: 80, maxWidth: 360, display: "flex", alignItems: "center", gap: 12, background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 20, padding: "12px 14px", boxShadow: "0 4px 0 oklch(0.85 0.03 120), 0 20px 40px -20px oklch(0.3 0.05 130 / 0.5)" }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: "var(--green)", display: "grid", placeItems: "center", flexShrink: 0 }}><ReciLogo size={28} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 17, color: "var(--ink)" }}>Instala ReciApp</p>
            <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--ink-soft)" }}>Ábrela como app, incluso sin señal.</p>
          </div>
          <button type="button" onClick={instalar} style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, color: "#fff", background: "var(--green)", border: "none", borderRadius: 999, padding: "9px 14px", cursor: "pointer", boxShadow: "0 3px 0 var(--green-deep)" }}>Instalar</button>
          <button type="button" aria-label="Ahora no" onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}><Icon name="x" size={16} stroke="var(--ink-soft)" /></button>
        </div>
      )}
    </>
  );
}
