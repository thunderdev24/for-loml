// Admin API. Everything except "login" needs a valid session token.
// Set ADMIN_PASSWORD in Netlify > Site configuration > Environment variables.
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { sendToAll, getSubs, buildMessage, daysLeft, DEFAULTS } from './lib/push.mjs';

const store = () => getStore('ifra-site');
const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const secret = () => (process.env.ADMIN_SECRET || '') + '|' + (process.env.ADMIN_PASSWORD || '');
const sign = p => crypto.createHmac('sha256', secret()).update(p).digest('base64url');
const safeEq = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
const sha = s => crypto.createHash('sha256').update(String(s)).digest();

function makeToken() { const p = String(Date.now() + 12 * 3600e3); return p + '.' + sign(p); }
function authed(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [p, s] = t.split('.');
  return !!(p && s && safeEq(s, sign(p)) && Number(p) > Date.now());
}
const PRIVATE_KEYS = ['ntfyTopic', 'discordWebhook'];

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');

  if (route === 'login' && req.method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD is not set in Netlify yet.' }, 503);
    let pw = '';
    try { pw = String((await req.json()).password || ''); } catch (e) { }
    if (crypto.timingSafeEqual(sha(pw), sha(process.env.ADMIN_PASSWORD))) return json({ token: makeToken() });
    await sleep(1200);
    return json({ error: 'Wrong password' }, 401);
  }

  if (!authed(req)) return json({ error: 'Not signed in' }, 401);
  const s = store();

  if (route === 'private' && req.method === 'GET') {
    let priv = null;
    try { priv = await s.get('private.json', { type: 'json' }); } catch (e) { }
    return json(priv || {});
  }

  if (route === 'save' && req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const content = body && body.content;
    if (!content || typeof content !== 'object' || Array.isArray(content)) return json({ error: 'Missing content' }, 400);
    if (JSON.stringify(content).length > 900000) return json({ error: 'Content too large' }, 413);
    content.settings = content.settings || {};
    PRIVATE_KEYS.forEach(k => { delete content.settings[k]; });
    delete content.settings.notifyOn;
    await s.setJSON('content.json', content);
    if (body.private && typeof body.private === 'object') {
      const priv = {};
      const topic = String(body.private.ntfyTopic || '').trim();
      const hook = String(body.private.discordWebhook || '').trim();
      if (hook && !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(hook))
        return json({ error: 'That does not look like a Discord webhook URL' }, 400);
      if (topic) priv.ntfyTopic = topic;
      if (hook) priv.discordWebhook = hook;
      await s.setJSON('private.json', priv);
    }
    return json({ ok: true, savedAt: new Date().toISOString() });
  }

  if (route === 'upload' && req.method === 'POST') {
    const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
    if (!ext) return json({ error: 'Only JPG, PNG or WebP images' }, 415);
    const data = await req.arrayBuffer();
    if (!data.byteLength || data.byteLength > 4.5 * 1024 * 1024) return json({ error: 'Image too large (max 4.5 MB)' }, 413);
    const name = 'memory-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex') + '.' + ext;
    await s.set('photo/' + name, data, { metadata: { type } });
    return json({ ok: true, src: '/api/photo/' + name });
  }

  if (route === 'media-chunk' && req.method === 'POST') {
    const q = new URL(req.url).searchParams;
    const id = q.get('id') || '';
    const n = Number(q.get('n')), total = Number(q.get('total')), size = Number(q.get('size'));
    const ext = (q.get('ext') || '').toLowerCase();
    const TYPES = { m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav',
                    ogg: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', weba: 'audio/webm' };
    const CH = 3 * 1024 * 1024;
    if (!/^[a-f0-9]{16,32}$/.test(id) || !TYPES[ext]) return json({ error: 'Unsupported audio type (use m4a, mp3, wav, ogg, aac or webm)' }, 415);
    if (!(n >= 0 && total >= 1 && total <= 60 && n < total && size > 0 && size <= total * CH)) return json({ error: 'Bad chunk info' }, 400);
    const data = await req.arrayBuffer();
    if (!data.byteLength || data.byteLength > CH) return json({ error: 'Chunk too large' }, 413);
    await s.set('media/' + id + '/' + n, data);
    if (n === total - 1) {
      await s.setJSON('media/' + id + '/meta', { type: TYPES[ext], size, chunkSize: CH, total, at: Date.now() });
    }
    return json({ ok: true, src: '/api/media/' + id });
  }

  if (route === 'push-info' && req.method === 'GET') {
    const subs = await getSubs(s);
    let content = null;
    try { content = await s.get('content.json', { type: 'json' }); } catch (e) { }
    const st = Object.assign({}, DEFAULTS, (content && content.settings) || {});
    return json({ subscribers: subs.length, daysLeft: daysLeft(Number(st.birthdayMonth), Number(st.birthdayDay), st.timezone) });
  }

  if (route === 'push-test' && req.method === 'POST') {
    let body = {};
    try { body = await req.json(); } catch (e) { }
    const st = Object.assign({}, DEFAULTS, body.settings || {});
    const days = Number.isFinite(Number(body.days)) ? Number(body.days) : daysLeft(Number(st.birthdayMonth), Number(st.birthdayDay), st.timezone);
    const msg = buildMessage(st, days);
    const res = await sendToAll(s, { title: msg.title, body: msg.body, url: '/', tag: 'ifra-test' });
    return json({ ok: true, preview: msg, result: res });
  }

  if (route === 'reset' && req.method === 'POST') {
    await s.delete('content.json');
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
};

export const config = { path: '/api/admin/*' };
