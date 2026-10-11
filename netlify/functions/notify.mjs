// Public endpoint used when she answers / sends a message.
// Forwards it to your Discord webhook and/or ntfy topic, which stay private on the server.
import { sendOwner } from './lib/owner.mjs';

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

  const ok = await sendOwner(text, 'Message from Ifra');
  return json({ ok }, ok ? 200 : 502);
};

export const config = { path: '/api/notify' };
