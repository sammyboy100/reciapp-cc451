import client from "./client";

export const preguntasSUS = () => client.get("/api/usabilidad/sus/preguntas").then((r) => r.data);
export const miSUS        = () => client.get("/api/usabilidad/sus/me").then((r) => r.data);
export const enviarSUS    = (respuestas, comentario) => client.post("/api/usabilidad/sus", { respuestas, comentario }).then((r) => r.data);
export const metricas     = () => client.get("/api/usabilidad/metricas").then((r) => r.data);
