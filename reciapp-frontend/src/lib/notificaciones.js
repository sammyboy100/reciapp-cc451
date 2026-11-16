// Notificaciones del sistema operativo (RF-27) vía service worker de la PWA.
// Se muestran cuando la app está en segundo plano y el usuario las activó en su perfil.
export const soportaNotificaciones = () => typeof window !== "undefined" && "Notification" in window;

export async function pedirPermiso() {
  if (!soportaNotificaciones()) return "no_soportado";
  if (Notification.permission === "granted") return "granted";
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}

export async function notificar(titulo, cuerpo, url = "/") {
  if (!soportaNotificaciones() || Notification.permission !== "granted") return false;
  const opciones = { body: cuerpo, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url }, lang: "es-PE", tag: url };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(titulo, opciones); return true; }
    new Notification(titulo, opciones);
    return true;
  } catch { return false; }
}
