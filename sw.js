// Service worker mínimo: guarda la "cáscara" de la app para que abra rápido y sin red.
// Los datos siempre se piden en vivo al backend (no se cachean aquí).
const CACHE = 'dbsh-v4';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'importers.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Red primero, caché como respaldo.
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});

// ---------- Notificaciones push (las manda la función de Netlify) ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'DBSHBOARD', body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Nuevo movimiento', {
      body: d.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'mov-' + Date.now(),
      data: { url: d.url || './' },
    });
    // Si la app está abierta, que se actualice sola
    (await self.clients.matchAll({ type: 'window' })).forEach((c) => c.postMessage('refresh'));
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length) { wins[0].postMessage('refresh'); return wins[0].focus(); }
    return self.clients.openWindow(self.registration.scope);
  })());
});
