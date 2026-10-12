/* Ifra site service worker:
   1) shows the birthday reminders (push notifications)
   2) lets the site be installed as an app and keep working offline */
const VERSION = 'ifra-v2';
const SHELL = ['/', '/index.html', '/ifra.css', '/ifra.js', '/content.js', '/site-loader.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
const MEDIA_RE = /\.(m4a|mp3|mp4|wav|ogg|oga|aac|opus|webm)$/i;
const FILE_RE = /\.(webp|jpe?g|png|gif|svg|ico|avif|woff2?)$/i;
const MAX_MEDIA = 40 * 1024 * 1024;   // do not store a single song bigger than this

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => { }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.indexOf('ifra-') === 0 && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== location.origin) {
    if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(staleWhileRevalidate(req));
    return;
  }
  const p = url.pathname;
  if (p.indexOf('/api/') === 0 && p !== '/api/live.js') return;   // push, admin, uploads: always live
  if (p.indexOf('/admin') === 0) return;
  if (MEDIA_RE.test(p)) { event.respondWith(media(event, req, url)); return; }
  if (FILE_RE.test(p)) { event.respondWith(staleWhileRevalidate(req)); return; }
  event.respondWith(networkFirst(req));
});

/* pages, scripts, styles, saved content: newest from the network, cached copy when offline */
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => { });
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const home = (await cache.match('/index.html')) || (await cache.match('/'));
      if (home) return home;
    }
    throw e;
  }
}

/* photos, fonts: instant from the cache, refreshed quietly in the background */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => { });
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

/* songs and voice messages: phones ask for them in small pieces (Range requests).
   First play streams normally while a full copy is saved; after that it works offline. */
const filling = new Set();
async function media(event, req, url) {
  const cache = await caches.open(VERSION);
  const key = url.origin + url.pathname;
  const hit = await cache.match(key);
  const range = req.headers.get('range');
  if (hit) return range ? sliceRange(hit, range) : hit;
  event.waitUntil(fillMedia(cache, key));
  return fetch(req);
}
function fillMedia(cache, key) {
  if (filling.has(key)) return Promise.resolve();
  filling.add(key);
  return fetch(key).then(res => {
    if (!res.ok || res.status !== 200) return;
    const len = Number(res.headers.get('content-length')) || 0;
    if (len > MAX_MEDIA) return;
    return cache.put(key, res);
  }).catch(() => { }).then(() => { filling.delete(key); });
}
async function sliceRange(res, range) {
  const buf = await res.clone().arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range || '');
  if (!m || (m[1] === '' && m[2] === '')) return res;
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Number(m[2]); }
  if (!(start >= 0) || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mp4',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

/* ---------- birthday reminders (push) ---------- */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'A message for you', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'A message for you 💌';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'ifra-birthday',
    renotify: true,
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url).catch(() => { }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
