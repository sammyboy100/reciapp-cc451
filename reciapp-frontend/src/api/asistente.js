import client from "./client";

export const chatAsistente = (payload) =>
  client.post("/api/asistente/chat", payload).then((r) => r.data);

export const proveedorLLM = () =>
  client.get("/api/asistente/proveedor").then((r) => r.data);
