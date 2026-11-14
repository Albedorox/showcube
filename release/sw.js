// ShowCube Service Worker: macht das Panel installierbar und startet es auch ohne Netz.
// Der Build setzt VERSION auf einen Fingerabdruck der fertigen Dateien. Ändert sich etwas,
// lädt der Browser den neuen Worker, und das Panel bietet „Neu laden“ an.
const VERSION = 'e8315002b3fd';
const CACHE = 'showcube-' + VERSION;
const CORE = ['panel.html', 'player.html', 'panel.webmanifest', 'pwa/icon-192.png', 'pwa/icon-512.png', 'pwa/maskable-512.png', 'pwa/apple-touch-icon.png', 'pwa/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('showcube-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Seiten: zuerst Netz (damit Änderungen sofort ankommen), nach 4 Sekunden oder offline aus dem Speicher.
// Alles andere aus derselben Quelle: zuerst Speicher, im Hintergrund auffrischen.
// Fremde Adressen (z.B. Wetter von Open-Meteo) gehen unverändert durch.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});

async function page(req) {
  const cache = await caches.open(CACHE);
  const key = new URL(req.url); key.search = ''; key.hash = '';
  const net = fetch(req).then(res => { if (res.ok) cache.put(key.href, res.clone()); return res; });
  net.catch(() => {});
  const late = new Promise(r => setTimeout(r, 4000));
  try {
    const res = await Promise.race([net, late]);
    if (res) return res;
  } catch (err) { /* offline */ }
  const hit = await cache.match(key.href) || await cache.match('panel.html');
  return hit || net;
}

self.addEventListener('message', e => { if (e.data === 'version') e.source.postMessage({ version: VERSION }); });
