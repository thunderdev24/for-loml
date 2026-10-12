// Public: POST /api/auth/login  and  GET /api/auth/protected
// Login checks the email + password on the server. The private parts of the site
// (photos, Our Story, proposal) are only sent to someone holding a valid token.
import { getStore } from '@netlify/blobs';
import { getUsers, hasUsers, checkPw, makeUserToken, verifyUserToken, pickProtected, ROLES } from './lib/authlib.mjs';

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hits = [];

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/auth\/?/, '').replace(/\/$/, '');
  const store = getStore('ifra-site');
  const users = await getUsers(store);

  if (route === 'login' && req.method === 'POST') {
    if (!hasUsers(users)) return json({ error: 'Logins are not set up yet' }, 503);
    const now = Date.now();
    while (hits.length && now - hits[0] > 3600e3) hits.shift();
    if (hits.length >= 60) return json({ error: 'Too many attempts, please try again later' }, 429);
    let email = '', password = '';
    try { const b = await req.json(); email = String(b.email || '').trim().toLowerCase(); password = String(b.password || ''); } catch (e) { }
    let found = null, foundRole = null;
    for (const r of ROLES) { if (users[r] && users[r].email === email) { found = users[r]; foundRole = r; } }
    const ok = checkPw(found, password) && found;
    if (!ok) { hits.push(now); await sleep(1000); return json({ error: 'Wrong email or password' }, 401); }
    return json({ token: makeUserToken(foundRole, found.ver), role: foundRole });
  }

  if (route === 'protected' && req.method === 'GET') {
    if (hasUsers(users)) {
      if (!verifyUserToken(req, users)) return json({ error: 'Please log in again' }, 401);
    }
    let content = null;
    try { content = await store.get('content.json', { type: 'json' }); } catch (e) { }
    return json({ data: pickProtected(content) });
  }

  return json({ error: 'Not found' }, 404);
};

export const config = { path: '/api/auth/*' };
