import { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "../components/ui/Primitivos";

/**
 * Retroalimentación afectiva global: toasts con color y emoción + vibración.
 * tipo: exito | info | animo | error
 */
const FeedbackContext = createContext(null);

const ESTILO = {
  exito: { bg: "var(--green)", deep: "var(--green-deep)", icon: "check", vib: [20, 40, 60] },
  info:  { bg: "var(--blue)", deep: "oklch(0.5 0.13 250)", icon: "bell", vib: [20] },
  animo: { bg: "var(--orange)", deep: "oklch(0.6 0.15 50)", icon: "star", vib: [15, 30, 15] },
  error: { bg: "var(--pink)", deep: "oklch(0.6 0.16 8)", icon: "alert", vib: [80] },
};

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const avisar = useCallback((texto, tipo = "info", ms = 3600) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, texto, tipo }]);
    if (navigator.vibrate) navigator.vibrate(ESTILO[tipo]?.vib || 20);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  return (
    <FeedbackContext.Provider value={{ avisar }}>
      {children}
      <div role="status" aria-live="polite" style={{ position: "fixed", left: "50%", top: 78, transform: "translateX(-50%)", zIndex: 200, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", pointerEvents: "none", width: "min(440px, calc(100% - 32px))" }}>
        {toasts.map((t) => {
          const e = ESTILO[t.tipo] || ESTILO.info;
          return (
            <div key={t.id} className="toast-in" style={{ display: "flex", alignItems: "center", gap: 10, background: e.bg, color: "#fff", borderRadius: 999, padding: "11px 18px 11px 12px", boxShadow: `0 4px 0 ${e.deep}, 0 14px 30px -12px oklch(0.2 0.04 130 / 0.5)`, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14.5 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "oklch(1 0 0 / 0.22)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name={e.icon} size={16} stroke="#fff" sw={2.4} /></span>
              {t.texto}
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext) || { avisar: () => {} };
}
