/* Ifra site service worker:
   1) shows the birthday reminders (push notifications)
   2) lets the site be installed as an app and keep working offline */
const VERSION = 'ifra-v7';
const SHELL = ['/', '/index.html', '/ifra.css', '/ifra.js', '/plus.js', '/plus.css', '/player.js', '/player.css', '/polish.js', '/polish.css', '/typography.css', '/games.js', '/games-plus.js', '/content.js', '/site-loader.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/notif-badge.png', '/notif-banner.jpg'];
const MEDIA_RE = /\.(m4a|mp3|mp4|wav|ogg|oga|aac|opus|webm)$/i;
const FILE_RE = /\.(webp|jpe?g|png|gif|svg|ico|avif|woff2?)$/i;
const MAX_MEDIA = 25 * 1024 * 1024;   // do not store a single song bigger than this
/* weak phones (2 GB RAM or less) only stream songs; they do not keep a second copy */
const LOW_END = !!(self.navigator && self.navigator.deviceMemory && self.navigator.deviceMemory <= 2);

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
    if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(cacheFirst(req));
    return;
  }
  const p = url.pathname;
  if (p.indexOf('/api/') === 0 && p !== '/api/live.js') return;   // push, admin, uploads: always live
  if (p.indexOf('/admin') === 0) return;
  if (MEDIA_RE.test(p)) { event.respondWith(media(event, req, url)); return; }
  if (FILE_RE.test(p)) { event.respondWith(cacheFirst(req)); return; }
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

/* photos, fonts: straight from the cache when we have them (no second download every time) */
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => { });
  return res;
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
  if (!LOW_END) event.waitUntil(fillMedia(cache, key));
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
  const blob = await res.clone().blob();   // a Blob is not copied into memory, unlike an ArrayBuffer
  const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range || '');
  if (!m || (m[1] === '' && m[2] === '')) return res;
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Number(m[2]); }
  if (!(start >= 0) || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  end = Math.min(end, size - 1);
  return new Response(blob.slice(start, end + 1), {
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
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'A message for you 💌', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'A message for you 💌';
  const opts = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/notif-badge.png',            // small white heart in the Android status bar
    image: data.image || '/notif-banner.jpg',   // big picture under the text (Android / desktop Chrome)
    tag: data.tag || 'ifra-birthday',
    renotify: true,                        // buzz again even if an older one with the same tag is still showing
    requireInteraction: true,              // stays until she taps it (desktop; Android keeps it in the shade anyway)
    silent: false,
    vibrate: [250, 120, 250, 120, 600],    // Android: buzz-buzz-long-buzz
    timestamp: Date.now(),
    actions: [{ action: 'open', title: 'Open 💌' }],
    data: { url: data.url || '/' }
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, opts);
    // red dot / number on the installed app icon (Android + iPhone home-screen app)
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(1); } catch (e) { }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    try { if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch (e) { }
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) { if ('focus' in c) { c.navigate(url).catch(() => { }); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});

/* the phone sometimes rotates the push address on its own; re-register it with the server so reminders keep arriving */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const old = event.oldSubscription;
      const key = (event.newSubscription && event.newSubscription.options && event.newSubscription.options.applicationServerKey) ||
                  (old && old.options && old.options.applicationServerKey) || null;
      let sub = event.newSubscription;
      if (!sub && key) sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      if (!sub) return;
      await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() })
      });
    } catch (e) { }
  })());
});
