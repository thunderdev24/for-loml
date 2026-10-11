// Public: GET /api/push/key  and  POST /api/push/subscribe
import { getStore } from '@netlify/blobs';
import { getVapid, getSubs } from './lib/push.mjs';
import { sendOwner } from './lib/owner.mjs';

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const hits = [];

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/push\/?/, '').replace(/\/$/, '');
  const store = getStore('ifra-site');

  if (route === 'key' && req.method === 'GET') {
    const v = await getVapid(store);
    return json({ key: v.publicKey });
  }

  if (route === 'subscribe' && req.method === 'POST') {
    const now = Date.now();
    while (hits.length && now - hits[0] > 3600e3) hits.shift();
    if (hits.length >= 20) return json({ error: 'slow down' }, 429);
    hits.push(now);

    let sub;
    try { sub = (await req.json()).subscription; } catch (e) { return json({ error: 'bad json' }, 400); }
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) ||
        !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ error: 'bad subscription' }, 400);
    const clean = { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } };
    const subs = await getSubs(store);
    const isNew = !subs.some(s => s.endpoint === clean.endpoint);
    if (isNew) {
      if (subs.length >= 25) return json({ error: 'too many devices' }, 429);
      subs.push(clean);
      await store.setJSON('push/subs.json', subs);
      sendOwner('Ifra turned on her birthday reminders 🔔', 'Reminders enabled').catch(() => { });
    }
    return json({ ok: true });
  }
  return json({ error: 'Not found' }, 404);
};

export const config = { path: '/api/push/*' };
