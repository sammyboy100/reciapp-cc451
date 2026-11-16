/* ReciApp · Service Worker (PWA)
 * - App shell en caché: la app abre sin conexión.
 * - Navegación: network-first con respaldo a index.html (SPA).
 * - Estáticos (JS/CSS/imágenes/fuentes): stale-while-revalidate.
 * - API: network-first; los GET exitosos se guardan para verlos offline.
 * - Teselas del mapa: cache-first con límite.
 */
const VERSION = "reciapp-v4";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/bolsas.png", "/pie-basura.png", "/icons/icon-192.png", "/icons/icon-512.png"];
const API_HOSTS_PATHS = ["/api/", "/auth/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION + "-shell").then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function recortar(nombre, max) {
  const c = await caches.open(nombre);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;               // POST/PUT siempre a la red
  const url = new URL(req.url);
  if (url.protocol === "ws:" || url.protocol === "wss:") return;

  // Navegación SPA
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }

  // API (otro origen, ej. :8000): network-first con copia offline
  if (API_HOSTS_PATHS.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSION + "-api").then((c) => c.put(req, copia)); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Teselas OpenStreetMap
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copia = res.clone();
        caches.open(VERSION + "-tiles").then((c) => c.put(req, copia)).then(() => recortar(VERSION + "-tiles", 300));
        return res;
      }))
    );
    return;
  }

  // Estáticos y fuentes: stale-while-revalidate
  e.respondWith(
    caches.match(req).then((hit) => {
      const red = fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") { const copia = res.clone(); caches.open(VERSION + "-static").then((c) => c.put(req, copia)); }
        return res;
      }).catch(() => hit);
      return hit || red;
    })
  );
});

// Notificaciones del sistema (PC3): al tocarla, enfoca la app o la abre en la ruta indicada
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
      return self.clients.openWindow(url);
    })
  );
});
