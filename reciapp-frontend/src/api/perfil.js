import client from "./client";

export const getPerfilAdaptativo = () =>
  client.get("/api/perfil-adaptativo/me").then((r) => r.data);

export const putPreferencias = (prefs) =>
  client.put("/api/perfil-adaptativo/me/preferencias", prefs).then((r) => r.data);

export const postEvento = (tipo, datos = {}) =>
  client.post("/api/perfil-adaptativo/eventos", { tipo, datos }).then((r) => r.data);

export const getImpacto = () =>
  client.get("/api/perfil-adaptativo/me/impacto").then((r) => r.data);
