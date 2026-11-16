// Capa global PC3: envía la cola offline al volver la red y convierte los
// eventos en tiempo real en notificaciones del sistema cuando la app está oculta.
import { useCallback, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePerfil } from "../../context/PerfilContext";
import { useFeedback } from "../../context/FeedbackContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { sincronizar } from "../../lib/colaOffline";
import { notificar } from "../../lib/notificaciones";

const AVISOS = {
  solicitud_asignada: () => ["Tu recojo fue aceptado 🙌", "Un reciclador tomó tu solicitud.", "/ciudadano/solicitudes"],
  solicitud_en_camino: () => ["Tu reciclador va en camino 🚲", "Toca para verlo en el mapa.", "/ciudadano/solicitudes"],
  evidencia_registrada: () => ["Confirma tu entrega", "El reciclador registró la evidencia.", "/ciudadano/solicitudes"],
  eco_creditos_acreditados: (m) => ["¡Eco-créditos recibidos! 🌱", `Sumaste ${m.eco_creditos ?? ""} eco-créditos.`, "/perfil"],
  solicitud_disponible: () => ["Nueva solicitud cerca", "Hay un recojo disponible para tomar.", "/reciclador"],
  sala_jornada: (m) => ["Novedades en tu sala 📅", "Hay cambios en una jornada de recojo.", `/salas/${m.sala_id}`],
  sala_mensaje: (m) => [`Mensaje en tu sala`, `${m.mensaje?.autor?.split(" ")[0] || "Aviso"}: ${m.mensaje?.contenido || ""}`, `/salas/${m.sala_id}`],
  sala_meta_alcanzada: (m) => ["¡Meta cumplida! 🎉", `Tu sala llegó a ${m.meta_kg} kg.`, `/salas/${m.sala_id}`],
};

export default function SincronizadorGlobal() {
  const { user } = useAuth();
  const { perfil } = usePerfil();
  const { avisar } = useFeedback();
  const activas = perfil.preferencias?.notificaciones;

  const enviarPendientes = useCallback(async () => {
    const r = await sincronizar();
    if (r.enviadas) avisar(r.enviadas === 1 ? "Volvió la conexión: se envió tu acción pendiente" : `Volvió la conexión: se enviaron ${r.enviadas} acciones pendientes`, "exito", 4500);
    if (r.descartadas) avisar(`${r.descartadas} acción(es) no se pudieron enviar`, "error", 4500);
  }, [avisar]);

  useEffect(() => {
    if (!user) return undefined;
    enviarPendientes();
    window.addEventListener("online", enviarPendientes);
    return () => window.removeEventListener("online", enviarPendientes);
  }, [user, enviarPendientes]);

  const onMsg = useCallback((m) => {
    if (!activas || document.visibilityState === "visible") return;
    if (m.tipo === "sala_mensaje" && m.mensaje?.usuario_id === user?.id) return;
    const f = AVISOS[m.tipo];
    if (f) { const [t, c, u] = f(m); notificar(t, c, u); }
  }, [activas, user?.id]);
  useWebSocket(onMsg, Boolean(user && activas));
  return null;
}
