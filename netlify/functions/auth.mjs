// Public: POST /api/auth/login  and  GET /api/auth/protected
// Login checks the username + password on the server. The private parts of the site
// (photos, Our Story, proposal) are only sent to someone holding a valid token.
import { getStore } from '@netlify/blobs';
import { getItemLocks, isItemId, checkItemPw, makeItemToken, verifyItemToken } from './lib/itemlocks.mjs';
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
    let name = '', password = '';
    try { const b = await req.json(); name = String(b.username != null ? b.username : (b.email || '')).trim().toLowerCase(); password = String(b.password || ''); } catch (e) { }
    let found = null, foundRole = null;
    for (const r of ROLES) { if (users[r] && (users[r].username || users[r].email) === name) { found = users[r]; foundRole = r; } }
    const ok = checkPw(found, password) && found;
    if (!ok) { hits.push(now); await sleep(1000); return json({ error: 'Wrong username or password' }, 401); }
    return json({ token: makeUserToken(foundRole, found.ver), role: foundRole });
  }

  // unlock one locked thing of the website (password the first time, then the saved token)
  if (route === 'item' && req.method === 'POST') {
    let b = {};
    try { b = await req.json(); } catch (e) { }
    const id = String(b.id || '');
    if (!isItemId(id)) return json({ error: 'Unknown item' }, 400);
    const locks = await getItemLocks(store), lock = locks[id];
    const dataFor = async () => {          // a locked "Open When" letter keeps its text on the server until now
      if (!/^env\d+$/.test(id)) return {};
      let c = null;
      try { c = await store.get('content.json', { type: 'json' }); } catch (e) { }
      const e = c && Array.isArray(c.envelopes) ? c.envelopes[Number(id.slice(3))] : null;
      return { body: (e && e.body) || '' };
    };
    if (!lock || !lock.hash) return json({ token: null, data: await dataFor() });
    if (b.token && verifyItemToken(b.token, id, lock)) return json({ token: b.token, data: await dataFor() });
    const now = Date.now();
    while (hits.length && now - hits[0] > 3600e3) hits.shift();
    if (hits.length >= 60) return json({ error: 'Too many attempts, please try again later' }, 429);
    if (!b.password || !checkItemPw(lock, b.password)) { hits.push(now); await sleep(1000); return json({ error: 'Wrong password' }, 401); }
    return json({ token: makeItemToken(id, lock.ver), data: await dataFor() });
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
