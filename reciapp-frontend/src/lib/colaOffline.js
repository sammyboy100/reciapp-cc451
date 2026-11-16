// Cola offline de acciones (RF-28): si no hay red, la acción se guarda y se envía
// sola al volver la conexión. Se guarda en localStorage del dispositivo.
import { crearSolicitud } from "../api/solicitudes";
import { enviarMensaje } from "../api/salas";

const CLAVE = "reciapp_cola_offline";
const EJECUTORES = {
  solicitud: (p) => crearSolicitud(p),
  mensaje_sala: (p) => enviarMensaje(p.sala_id, p.contenido, p.tipo || "texto"),
};

export function leerCola() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "[]"); } catch { return []; }
}
function guardar(cola) {
  try { localStorage.setItem(CLAVE, JSON.stringify(cola)); } catch { /* sin storage: la cola vive solo en memoria */ }
  window.dispatchEvent(new CustomEvent("reciapp:cola", { detail: { pendientes: cola.length } }));
}

const esErrorDeRed = (err) => !navigator.onLine || (err && !err.response);

/** Ejecuta la acción; si falla por red la encola. Devuelve { ok, encolada, data }. */
export async function enviarOEncolar(tipo, payload, descripcion) {
  if (navigator.onLine) {
    try {
      return { ok: true, encolada: false, data: await EJECUTORES[tipo](payload) };
    } catch (err) {
      if (!esErrorDeRed(err)) throw err;
    }
  }
  const cola = leerCola();
  cola.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), tipo, payload, descripcion, creada: new Date().toISOString() });
  guardar(cola);
  return { ok: true, encolada: true, data: null };
}

let sincronizando = false;
/** Envía en orden lo pendiente. Devuelve { enviadas, descartadas, pendientes }. */
export async function sincronizar() {
  if (sincronizando || !navigator.onLine) return { enviadas: 0, descartadas: 0, pendientes: leerCola().length };
  sincronizando = true;
  let enviadas = 0, descartadas = 0;
  try {
    let cola = leerCola();
    while (cola.length) {
      const [accion, ...resto] = cola;
      try {
        await EJECUTORES[accion.tipo](accion.payload);
        enviadas++;
      } catch (err) {
        if (esErrorDeRed(err)) break;          // la red volvió a caer: se reintenta luego
        descartadas++;                          // 4xx: datos inválidos, no se reintenta
      }
      cola = resto;
      guardar(cola);
    }
    return { enviadas, descartadas, pendientes: cola.length };
  } finally {
    sincronizando = false;
  }
}
