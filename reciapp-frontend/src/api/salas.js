import client from "./client";

export const misSalas       = () => client.get("/api/salas").then((r) => r.data);
export const explorarSalas  = () => client.get("/api/salas/explorar").then((r) => r.data);
export const crearSala      = (data) => client.post("/api/salas", data).then((r) => r.data);
export const unirsePorCodigo = (codigo) => client.post("/api/salas/unirse", { codigo }).then((r) => r.data);
export const unirseSala     = (id) => client.post(`/api/salas/${id}/unirse`).then((r) => r.data);
export const salirSala      = (id) => client.delete(`/api/salas/${id}/miembros/me`);
export const detalleSala    = (id) => client.get(`/api/salas/${id}`).then((r) => r.data);
export const enviarMensaje  = (id, contenido, tipo = "texto") =>
  client.post(`/api/salas/${id}/mensajes`, { contenido, tipo }).then((r) => r.data);
export const reaccionar     = (id, mid, emoji) =>
  client.post(`/api/salas/${id}/mensajes/${mid}/reacciones`, { emoji }).then((r) => r.data);

// Jornadas de recojo compartidas (PC3)
export const listarJornadas   = (id) => client.get(`/api/salas/${id}/jornadas`).then((r) => r.data);
export const crearJornada     = (id, data) => client.post(`/api/salas/${id}/jornadas`, data).then((r) => r.data);
export const participarJornada = (id, jid, data) => client.post(`/api/salas/${id}/jornadas/${jid}/participar`, data).then((r) => r.data);
export const retirarseJornada = (id, jid) => client.delete(`/api/salas/${id}/jornadas/${jid}/participar`).then((r) => r.data);
export const tomarJornada     = (id, jid) => client.post(`/api/salas/${id}/jornadas/${jid}/tomar`).then((r) => r.data);
export const completarJornada = (id, jid) => client.post(`/api/salas/${id}/jornadas/${jid}/completar`).then((r) => r.data);
