import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { getPerfilAdaptativo, postEvento, putPreferencias } from "../api/perfil";

/**
 * Perfil adaptativo (personalización continua). Expone:
 *  - perfil: { preferencias, aprendido, errores, emociones, derivado }
 *  - registrar(tipo, datos): manda un evento de uso y refresca lo derivado
 *  - preferir(cambios): guarda preferencias explícitas
 * y aplica las preferencias de accesibilidad al <html> (tamaño, contraste, movimiento).
 */
const PerfilContext = createContext(null);

const VACIO = {
  preferencias: { voz_activada: true, lectura_automatica: false, tamano_fuente: "normal", alto_contraste: false, reducir_movimiento: false, tono_preferido: "auto", modo_simple: false },
  aprendido: { materiales: {}, franjas: {}, canal: {} },
  errores: { total: 0, recientes: [] },
  emociones: { actual: null, historial: [] },
  derivado: { tono_asistente: "amigable", velocidad_voz: 1, nivel_guia: "estandar", ritmo: "normal" },
};

function aplicarAlDocumento(pref) {
  const html = document.documentElement;
  html.dataset.fuente = pref.tamano_fuente || "normal";
  html.dataset.contraste = pref.alto_contraste ? "alto" : "normal";
  const sistemaReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  html.dataset.movimiento = pref.reducir_movimiento || sistemaReduce ? "reducido" : "normal";
}

export function PerfilProvider({ children }) {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState(VACIO);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (!user) { setPerfil(VACIO); setCargado(false); aplicarAlDocumento(VACIO.preferencias); return; }
    getPerfilAdaptativo().then((p) => { setPerfil(p); setCargado(true); }).catch(() => setCargado(true));
  }, [user]);

  useEffect(() => { aplicarAlDocumento(perfil.preferencias); }, [perfil.preferencias]);

  const registrar = useCallback(async (tipo, datos = {}) => {
    try { const p = await postEvento(tipo, datos); setPerfil(p); return p; } catch { return null; }
  }, []);

  const preferir = useCallback(async (cambios) => {
    // Optimista: el cambio de accesibilidad se ve al instante
    setPerfil((p) => ({ ...p, preferencias: { ...p.preferencias, ...cambios } }));
    try { const p = await putPreferencias(cambios); setPerfil(p); return p; } catch { return null; }
  }, []);

  const refrescar = useCallback(() => getPerfilAdaptativo().then(setPerfil).catch(() => {}), []);

  return (
    <PerfilContext.Provider value={{ perfil, cargado, registrar, preferir, refrescar, setPerfil }}>
      {children}
    </PerfilContext.Provider>
  );
}

export function usePerfil() {
  const ctx = useContext(PerfilContext);
  if (!ctx) throw new Error("usePerfil debe usarse dentro de PerfilProvider");
  return ctx;
}
