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

    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const sub = body && body.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) ||
        !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ error: 'bad subscription' }, 400);

    const dev = (body && typeof body.device === 'object' && body.device) ? body.device : {};
    const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '';
    const country = req.headers.get('x-country') || '';

    let provider = 'Web Push';
    if (/fcm\.googleapis|android\.googleapis/i.test(sub.endpoint)) provider = 'Google FCM';
    else if (/push\.apple\.com/i.test(sub.endpoint)) provider = 'Apple APNs';
    else if (/notify\.windows\.com/i.test(sub.endpoint)) provider = 'Microsoft WNS';
    else if (/mozilla/i.test(sub.endpoint)) provider = 'Mozilla Autopush';

    const subs = await getSubs(store);
    const existingIdx = subs.findIndex(s => s.endpoint === sub.endpoint);
    const nowIso = new Date().toISOString();

    if (existingIdx >= 0) {
      const existing = subs[existingIdx];
      existing.keys = { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) };
      existing.lastSeenAt = nowIso;
      existing.pushProvider = provider;
      if (ip) existing.ip = ip;
      if (country) existing.country = country;
      existing.device = existing.device || {};
      const currentName = existing.device.name || existing.name;
      existing.device = {
        name: currentName || dev.name || 'Subscribed Phone',
        model: dev.model || existing.device.model || 'Unknown Model',
        os: dev.os || existing.device.os || 'Unknown OS',
        browser: dev.browser || existing.device.browser || 'Unknown Browser',
        type: dev.type || existing.device.type || 'mobile',
        screen: dev.screen || existing.device.screen || '',
        isStandalone: dev.isStandalone != null ? dev.isStandalone : existing.device.isStandalone,
        timezone: dev.timezone || existing.device.timezone || 'Asia/Karachi'
      };
      await store.setJSON('push/subs.json', subs);
    } else {
      if (subs.length >= 35) return json({ error: 'too many devices' }, 429);
      const newEntry = {
        id: 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
        endpoint: sub.endpoint,
        keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
        device: {
          name: dev.name || "Ifra's Phone",
          model: dev.model || 'Unknown Model',
          os: dev.os || 'Unknown OS',
          browser: dev.browser || 'Unknown Browser',
          type: dev.type || 'mobile',
          screen: dev.screen || '',
          isStandalone: !!dev.isStandalone,
          timezone: dev.timezone || 'Asia/Karachi'
        },
        pushProvider: provider,
        subscribedAt: nowIso,
        lastSeenAt: nowIso,
        ip,
        country
      };
      subs.push(newEntry);
      await store.setJSON('push/subs.json', subs);
      const label = newEntry.device.name + (newEntry.device.model && newEntry.device.model !== 'Unknown Model' ? ' (' + newEntry.device.model + ')' : '');
      sendOwner('Ifra turned on birthday reminders on ' + label + ' 🔔', 'Reminders enabled').catch(() => { });
    }
    return json({ ok: true });
  }
  return json({ error: 'Not found' }, 404);
};

export const config = { path: '/api/push/*' };
