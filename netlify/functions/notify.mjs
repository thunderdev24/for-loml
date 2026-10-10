// Public endpoint used when she answers / sends a message.
// Forwards it to your Discord webhook and/or ntfy topic, which stay private on the server.
import { getStore } from '@netlify/blobs';

const hits = [];
const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  const now = Date.now();
  while (hits.length && now - hits[0] > 3600e3) hits.shift();
  if (hits.length >= 40) return json({ ok: false, error: 'slow down' }, 429);
  hits.push(now);

  let text = '';
  try { text = String((await req.json()).text || '').slice(0, 1500); } catch (e) { }
  if (!text.trim()) return json({ ok: false }, 400);

  let priv = null;
  try { priv = await getStore('ifra-site').get('private.json', { type: 'json' }); } catch (e) { }
  priv = priv || {};
  const hook = priv.discordWebhook || process.env.DISCORD_WEBHOOK_URL;
  const topic = priv.ntfyTopic || process.env.NTFY_TOPIC;

  let ok = false;
  if (hook && /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(hook)) {
    try {
      const r = await fetch(hook, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'Ifra', content: text.slice(0, 1900) })
      });
      ok = ok || r.ok;
    } catch (e) { }
  }
  if (topic) {
    try {
      const r = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
        method: 'POST', body: text, headers: { Title: 'Message from Ifra', Tags: 'heart' }
      });
      ok = ok || r.ok;
    } catch (e) { }
  }
  return json({ ok }, ok ? 200 : 502);
};

export const config = { path: '/api/notify' };
