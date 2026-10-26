// Admin API. Everything except "login" needs a valid session token.
// Set ADMIN_PASSWORD in Netlify > Site configuration > Environment variables.
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { sendToAll, sendToOne, getSubs, buildMessage, daysLeft, DEFAULTS } from './lib/push.mjs';
import { getUsers, newCredentials, checkPw, ROLES } from './lib/authlib.mjs';
import { getItemLocks, saveItemLocks, makeItemLock, publicItemLocks, isItemId } from './lib/itemlocks.mjs';
import { LOCKABLE, getLocks, saveLocks, makeLock, checkLock, makeUnlockToken, unlockedTabs, missingUnlocks, lockedMessage, changedSections } from './lib/locks.mjs';

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

function makeToken(role = 'owner') {
  const p = role + ':' + String(Date.now() + 24 * 3600e3);
  return p + '.' + sign(p);
}
function authedUser(req) {
  if (!process.env.ADMIN_PASSWORD) return null;
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [p, s] = t.split('.');
  if (!p || !s || !safeEq(s, sign(p))) return null;
  if (!p.includes(':')) {
    return Number(p) > Date.now() ? { role: 'owner' } : null;
  }
  const [role, exp] = p.split(':');
  if (Number(exp) < Date.now()) return null;
  return { role: role || 'owner' };
}
function authed(req) {
  return !!authedUser(req);
}
const PRIVATE_KEYS = ['ntfyTopic', 'discordWebhook'];
const userName = u => (u && (u.username || u.email)) || '';
const validUsername = n => /^[a-z0-9._-]{3,30}$/.test(n) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n);   // an old email login stays valid
const lockHits = [];

const DEFAULT_IFRA_TABS = ['texts', 'photos', 'playlist', 'when', 'story', 'surprises', 'games', 'jar', 'riddles', 'sweet', 'plans', 'diary'];

// Ifra's admin panel credentials are stored SEPARATELY from users.json.
// users.json controls the website content gate (SITE_LOCK); admin-panel.json only controls admin panel access.
async function getAdminPanel(store) {
  try { return (await store.get('admin-panel.json', { type: 'json' })) || {}; } catch (e) { return {}; }
}

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');

  if (route === 'login' && req.method === 'POST') {
    let pw = '', username = '';
    try {
      const b = await req.json();
      pw = String(b.password || '');
      username = String(b.username || '').trim().toLowerCase();
    } catch (e) { }

    // 1. Check if ADMIN_PASSWORD matches (Master Owner: Tayyab)
    if (process.env.ADMIN_PASSWORD && (!username || username === 'admin' || username === 'tayyab')) {
      if (crypto.timingSafeEqual(sha(pw), sha(process.env.ADMIN_PASSWORD))) {
        return json({ token: makeToken('owner'), role: 'owner', name: 'Tayyab', allowedTabs: [] });
      }
    }

    // 2. Check Ifra's admin-panel credentials (stored in admin-panel.json — separate from users.json)
    //    This does NOT affect the website's SITE_LOCK or content protection at all.
    const s = store();
    const ap = await getAdminPanel(s);
    if (ap && ap.her && checkPw(ap.her, pw)) {
      const herName = (userName(ap.her) || '').toLowerCase();
      if (!username || username === herName || username === 'ifra') {
        const allowedTabs = Array.isArray(ap.her.allowedTabs) ? ap.her.allowedTabs : DEFAULT_IFRA_TABS;
        return json({
          token: makeToken('her'),
          role: 'her',
          name: ap.her.username || 'Ifra',
          allowedTabs
        });
      }
    }

    await sleep(1200);
    return json({ error: 'Wrong password or username' }, 401);
  }

  const auth = authedUser(req);
  if (!auth) return json({ error: 'Not signed in' }, 401);
  const s = store();
  const locks = await getLocks(s);
  const open = unlockedTabs(req, locks);
  const locked = tabs => { const m = missingUnlocks(tabs, locks, open); return m.length ? json({ error: lockedMessage(m), locked: m }, 403) : null; };

  const herAllowed = async (tab) => {
    if (auth.role !== 'her') return true;
    const ap = await getAdminPanel(s);
    const list = (ap.her && Array.isArray(ap.her.allowedTabs)) ? ap.her.allowedTabs : DEFAULT_IFRA_TABS;
    return list.includes(tab);
  };

  if (auth.role === 'her' && (route === 'sitelocks' || route === 'locks' || route === 'private' || route === 'reset' || route === 'push-test')) {
    return json({ error: 'Permission denied: This section is restricted to Tayyab' }, 403);
  }

  // ---- locks on individual things of the public website (saved straight away, not part of Publish) ----
  if (route === 'sitelocks' && req.method === 'GET') {
    return json({ items: publicItemLocks(await getItemLocks(s)) });
  }
  if (route === 'sitelocks' && req.method === 'POST') {
    { const e = locked(['sitelocks']); if (e) return e; }
    let b;
    try { b = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const il = await getItemLocks(s);
    const action = String(b.action || ''), id = String(b.id || '');
    const pw = String(b.password || ''), hint = String(b.hint || '');
    if (action === 'removeAll') {
      await saveItemLocks(s, {});
      return json({ ok: true, items: {} });
    }
    if (!isItemId(id)) return json({ error: 'Unknown item' }, 400);
    if (action === 'remove') { delete il[id]; }
    else if (action === 'set') {
      const old = il[id];
      if (!pw) {
        if (!old) return json({ error: 'Type a password first' }, 400);
        il[id] = Object.assign({}, old, { hint: hint.slice(0, 120) });        // only the hint changed
      } else {
        if (pw.length < 3) return json({ error: 'The password needs at least 3 characters' }, 400);
        il[id] = makeItemLock(pw, old, hint);
      }
    } else return json({ error: 'Unknown action' }, 400);
    await saveItemLocks(s, il);
    return json({ ok: true, items: publicItemLocks(il) });
  }

  // ---- section passwords (a wrong lock password answers 403, never 401, so you are not signed out) ----
  if (route === 'locks' && req.method === 'GET') {
    const out = {};
    LOCKABLE.forEach(t => { out[t] = !!locks[t]; });
    return json({ locks: out });
  }
  if (route === 'locks' && req.method === 'POST') {
    let b;
    try { b = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const action = String(b.action || ''), tab = String(b.tab || '');
    const pw = String(b.password || ''), cur = String(b.current || '');
    if (action !== 'setAll' && !LOCKABLE.includes(tab)) return json({ error: 'Unknown section' }, 400);
    const now = Date.now();
    while (lockHits.length && now - lockHits[0] > 3600e3) lockHits.shift();
    if (lockHits.length >= 40) return json({ error: 'Too many wrong passwords, try again later' }, 429);
    const wrong = async msg => { lockHits.push(Date.now()); await sleep(800); return json({ error: msg }, 403); };

    if (action === 'unlock') {
      if (!locks[tab]) return json({ token: null });
      if (!checkLock(locks[tab], pw)) return wrong('Wrong password');
      return json({ token: makeUnlockToken(tab, locks[tab].ver) });
    }
    if (action === 'forgot') {   // the main admin password removes a forgotten lock
      if (!crypto.timingSafeEqual(sha(String(b.adminPassword || '')), sha(process.env.ADMIN_PASSWORD || ''))) return wrong('That is not the main admin password');
      delete locks[tab];
      await saveLocks(s, locks);
      return json({ ok: true });
    }
    // everything below changes locks: the "Section passwords" tab must be open (unless it is itself what is being changed)
    if (tab !== 'locks' && action !== 'setAll') { const e = locked(['locks']); if (e) return e; }
    if (action === 'setAll') { const e = locked(['locks']); if (e) return e; }

    if (action === 'set') {
      if (pw.length < 4) return json({ error: 'The password needs at least 4 characters' }, 400);
      if (locks[tab] && !checkLock(locks[tab], cur)) return wrong('The current password is wrong');
      locks[tab] = makeLock(pw, locks[tab]);
      await saveLocks(s, locks);
      return json({ ok: true, token: makeUnlockToken(tab, locks[tab].ver) });
    }
    if (action === 'remove') {
      if (!locks[tab]) return json({ ok: true });
      if (!checkLock(locks[tab], cur)) return wrong('The current password is wrong');
      delete locks[tab];
      await saveLocks(s, locks);
      return json({ ok: true });
    }
    if (action === 'setAll') {
      if (pw.length < 4) return json({ error: 'The password needs at least 4 characters' }, 400);
      const tokens = {}; let n = 0;
      LOCKABLE.forEach(t => { if (!locks[t]) { locks[t] = makeLock(pw); tokens[t] = makeUnlockToken(t, locks[t].ver); n++; } });
      await saveLocks(s, locks);
      return json({ ok: true, count: n, tokens });
    }
    return json({ error: 'Unknown action' }, 400);
  }

  if (route === 'private' && req.method === 'GET') {
    let priv = null;
    try { priv = await s.get('private.json', { type: 'json' }); } catch (e) { }
    return json(priv || {});
  }

  // full saved content (the public script hides the private parts once logins are on)
  if (route === 'content' && req.method === 'GET') {
    let content = null;
    try { content = await s.get('content.json', { type: 'json' }); } catch (e) { }
    return json({ content });
  }

  // ---- Website content logins (me/her guard the gallery, story, proposal) ----
  // NOTE: These are completely separate from Ifra's admin panel login (admin-panel.json).
  if (route === 'users' && req.method === 'GET') {
    if (auth.role === 'her') return json({ error: 'Permission denied: Logins are managed by Tayyab' }, 403);
    const u = await getUsers(s);
    const ap = await getAdminPanel(s);
    const out = {};
    // me: website login
    out.me = (u.me && u.me.hash) ? { username: userName(u.me) } : null;
    // her website login (for gallery/story/proposal) — separate from admin panel
    out.her = (u.her && u.her.hash) ? { username: userName(u.her) } : null;
    // Ifra's admin panel login (from admin-panel.json)
    out.adminHer = (ap.her && ap.her.hash) ? {
      username: userName(ap.her),
      allowedTabs: Array.isArray(ap.her.allowedTabs) ? ap.her.allowedTabs : DEFAULT_IFRA_TABS
    } : null;
    return json(out);
  }

  if (route === 'users' && req.method === 'POST') {
    if (auth.role === 'her') return json({ error: 'Permission denied: Logins are managed by Tayyab' }, 403);
    { const e = locked(['logins']); if (e) return e; }
    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }

    // ---- Handle Ifra's ADMIN PANEL login (stored in admin-panel.json, separate from website) ----
    if (body && body.adminHer !== undefined) {
      const ap = await getAdminPanel(s);
      const inp = body.adminHer;
      if (!inp || inp.remove) {
        delete ap.her;
      } else {
        // Only updating allowedTabs (no username/password needed)
        if (Array.isArray(inp.allowedTabs) && !inp.username && !inp.password) {
          ap.her = ap.her || {};
          ap.her.allowedTabs = inp.allowedTabs.map(String);
        } else {
          const username = String(inp.username != null ? inp.username : (inp.email || '')).trim().toLowerCase();
          const pw = String(inp.password || '');
          if (!validUsername(username)) return json({ error: 'Admin panel username must be 3 to 30 characters' }, 400);
          const old = ap.her;
          if (!old && !pw) return json({ error: 'Admin panel login needs a password' }, 400);
          if (pw && pw.length < 8) return json({ error: 'Admin panel password must be at least 8 characters' }, 400);
          const next = { username, salt: old && old.salt, hash: old && old.hash, ver: (old && old.ver) || 1 };
          if (old && old.allowedTabs) next.allowedTabs = old.allowedTabs;
          if (Array.isArray(inp.allowedTabs)) next.allowedTabs = inp.allowedTabs.map(String);
          if (pw) Object.assign(next, newCredentials(pw), { ver: next.ver + 1 });
          else if (old && userName(old) !== username) next.ver += 1;
          ap.her = next;
        }
      }
      await s.setJSON('admin-panel.json', ap);
      // Return updated state
      const u = await getUsers(s);
      return json({
        ok: true,
        users: {
          me: (u.me && u.me.hash) ? { username: userName(u.me) } : null,
          her: (u.her && u.her.hash) ? { username: userName(u.her) } : null,
          adminHer: (ap.her && ap.her.hash) ? { username: userName(ap.her), allowedTabs: ap.her.allowedTabs || DEFAULT_IFRA_TABS } : null
        }
      });
    }

    // ---- Handle website logins (me / her) — stored in users.json, controls SITE_LOCK ----
    const users = await getUsers(s);
    for (const r of ROLES) {
      const inp = body && body[r];
      if (!inp) continue;
      if (inp.remove) { delete users[r]; continue; }
      const username = String(inp.username != null ? inp.username : (inp.email || '')).trim().toLowerCase();
      const pw = String(inp.password || '');
      const label = r === 'me' ? 'Your' : 'Her';
      if (!validUsername(username)) return json({ error: label + ' username must be 3 to 30 characters: letters, numbers, dot, dash or underscore (no spaces)' }, 400);
      const old = users[r];
      if (!old && !pw) return json({ error: label + ' login needs a password' }, 400);
      if (pw && pw.length < 8) return json({ error: label + ' password must be at least 8 characters' }, 400);
      const next = { username, salt: old && old.salt, hash: old && old.hash, ver: (old && old.ver) || 1 };
      if (pw) Object.assign(next, newCredentials(pw), { ver: next.ver + 1 });
      else if (old && userName(old) !== username) next.ver += 1;
      users[r] = next;
    }
    const mails = ROLES.filter(r => users[r]).map(r => userName(users[r]));
    if (new Set(mails).size !== mails.length) return json({ error: 'You and her need different usernames' }, 400);
    await s.setJSON('users.json', users);
    const ap = await getAdminPanel(s);
    return json({
      ok: true,
      users: {
        me: users.me ? { username: userName(users.me) } : null,
        her: users.her ? { username: userName(users.her) } : null,
        adminHer: (ap.her && ap.her.hash) ? { username: userName(ap.her), allowedTabs: ap.her.allowedTabs || DEFAULT_IFRA_TABS } : null
      }
    });
  }

  if (route === 'save' && req.method === 'POST') {
    if (auth.role === 'her' && !(await herAllowed('publish'))) {
      return json({ error: 'Publishing live is restricted to Tayyab' }, 403);
    }
    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const content = body && body.content;
    if (!content || typeof content !== 'object' || Array.isArray(content)) return json({ error: 'Missing content' }, 400);
    if (JSON.stringify(content).length > 900000) return json({ error: 'Content too large' }, 413);
    content.settings = content.settings || {};
    PRIVATE_KEYS.forEach(k => { delete content.settings[k]; });
    delete content.settings.notifyOn;
    {   // a locked section can only be changed with its password; publishing itself can be locked too
      let oldC = null, oldP = null;
      try { oldC = await s.get('content.json', { type: 'json' }); } catch (e) { }
      try { oldP = await s.get('private.json', { type: 'json' }); } catch (e) { }
      const e = locked(['publish'].concat(changedSections(oldC, content, oldP, body.private && typeof body.private === 'object' ? body.private : null)));
      if (e) return e;
    }
    await s.setJSON('content.json', content);
    if (auth.role !== 'her' && body.private && typeof body.private === 'object') {
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
    if (!(await herAllowed('devices'))) return json({ error: 'Permission denied: Devices tab is not enabled for you' }, 403);
    const subs = await getSubs(s);
    let content = null;
    try { content = await s.get('content.json', { type: 'json' }); } catch (e) { }
    const st = Object.assign({}, DEFAULTS, (content && content.settings) || {});
    const devices = subs.map((sub, idx) => {
      const dev = sub.device || {};
      let provider = sub.pushProvider;
      if (!provider) {
        if (/fcm\.googleapis|android\.googleapis/i.test(sub.endpoint)) provider = 'Google FCM';
        else if (/push\.apple\.com/i.test(sub.endpoint)) provider = 'Apple APNs';
        else if (/notify\.windows\.com/i.test(sub.endpoint)) provider = 'Microsoft WNS';
        else if (/mozilla/i.test(sub.endpoint)) provider = 'Mozilla Autopush';
        else provider = 'Web Push';
      }
      return {
        id: sub.id || ('dev_' + idx),
        endpoint: sub.endpoint,
        name: dev.name || sub.name || ('Device #' + (idx + 1)),
        model: dev.model || sub.model || 'Unknown Model',
        os: dev.os || sub.os || 'Unknown OS',
        browser: dev.browser || sub.browser || 'Unknown Browser',
        type: dev.type || sub.type || 'mobile',
        screen: dev.screen || '',
        isStandalone: !!dev.isStandalone,
        pushProvider: provider,
        subscribedAt: sub.subscribedAt || null,
        lastSeenAt: sub.lastSeenAt || null,
        country: sub.country || null
      };
    });
    return json({
      subscribers: subs.length,
      daysLeft: daysLeft(Number(st.birthdayMonth), Number(st.birthdayDay), st.timezone),
      devices
    });
  }

  if (route === 'push-device-rename' && req.method === 'POST') {
    if (!(await herAllowed('devices'))) return json({ error: 'Permission denied: Devices tab is not enabled for you' }, 403);
    let body = {};
    try { body = await req.json(); } catch (e) { }
    const { id, endpoint, name } = body;
    if (!name || !String(name).trim()) return json({ error: 'Device name cannot be empty' }, 400);
    const subs = await getSubs(s);
    const target = subs.find(x => (id && x.id === id) || (endpoint && x.endpoint === endpoint));
    if (!target) return json({ error: 'Device not found' }, 404);
    target.device = target.device || {};
    target.device.name = String(name).trim();
    target.name = String(name).trim();
    await s.setJSON('push/subs.json', subs);
    return json({ ok: true });
  }

  if (route === 'push-device-delete' && req.method === 'POST') {
    if (!(await herAllowed('devices'))) return json({ error: 'Permission denied: Devices tab is not enabled for you' }, 403);
    let body = {};
    try { body = await req.json(); } catch (e) { }
    const { id, endpoint } = body;
    let subs = await getSubs(s);
    const prevLen = subs.length;
    subs = subs.filter(x => !((id && x.id === id) || (endpoint && x.endpoint === endpoint)));
    if (subs.length === prevLen) return json({ error: 'Device not found' }, 404);
    await s.setJSON('push/subs.json', subs);
    return json({ ok: true, remaining: subs.length });
  }

  if (route === 'push-device-test' && req.method === 'POST') {
    if (!(await herAllowed('devices'))) return json({ error: 'Permission denied: Devices tab is not enabled for you' }, 403);
    let body = {};
    try { body = await req.json(); } catch (e) { }
    const { id, endpoint, settings } = body;
    const subs = await getSubs(s);
    const target = subs.find(x => (id && x.id === id) || (endpoint && x.endpoint === endpoint));
    if (!target) return json({ error: 'Device not found' }, 404);
    const st = Object.assign({}, DEFAULTS, settings || {});
    const days = daysLeft(Number(st.birthdayMonth), Number(st.birthdayDay), st.timezone);
    const msg = buildMessage(st, days);
    try {
      await sendToOne(s, target, { title: msg.title, body: msg.body, url: '/', tag: 'ifra-test-single' });
      return json({ ok: true, preview: msg, targetName: (target.device && target.device.name) || 'device' });
    } catch (err) {
      return json({ error: 'Push delivery failed: ' + (err.message || err) }, 502);
    }
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

  if (route === 'plans' && req.method === 'GET') {
    if (!(await herAllowed('plans'))) return json({ error: 'Permission denied: Dates & Plans tab is not enabled for you' }, 403);
    let plans = [];
    try { plans = (await s.get('plans/list.json', { type: 'json' })) || []; } catch (e) { }
    return json({ ok: true, plans });
  }

  if (route === 'plans-status' && req.method === 'POST') {
    if (!(await herAllowed('plans'))) return json({ error: 'Permission denied: Dates & Plans tab is not enabled for you' }, 403);
    let body = {};
    try { body = await req.json(); } catch (e) { }
    const { id, status } = body;
    let plans = [];
    try { plans = (await s.get('plans/list.json', { type: 'json' })) || []; } catch (e) { }
    const target = plans.find(p => p.id === id);
    if (!target) return json({ error: 'Plan not found' }, 404);
    target.status = String(status || 'confirmed');
    await s.setJSON('plans/list.json', plans);
    return json({ ok: true });
  }

  if (route === 'plans-delete' && req.method === 'POST') {
    if (!(await herAllowed('plans'))) return json({ error: 'Permission denied: Dates & Plans tab is not enabled for you' }, 403);
    let body = {};
    try { body = await req.json(); } catch (e) { }
    const { id, all } = body;
    if (all) {
      await s.setJSON('plans/list.json', []);
      return json({ ok: true, remaining: 0 });
    }
    let plans = [];
    try { plans = (await s.get('plans/list.json', { type: 'json' })) || []; } catch (e) { }
    plans = plans.filter(p => p.id !== id);
    await s.setJSON('plans/list.json', plans);
    return json({ ok: true, remaining: plans.length });
  }

  if (route === 'diary' && req.method === 'GET') {
    if (!(await herAllowed('diary'))) return json({ error: 'Permission denied: Shared Diary tab is not enabled for you' }, 403);
    let entries = [];
    try { entries = (await s.get('diary/entries.json', { type: 'json' })) || []; } catch (e) { }
    return json({ ok: true, entries });
  }

  if (route === 'diary-delete' && req.method === 'POST') {
    if (!(await herAllowed('diary'))) return json({ error: 'Permission denied: Shared Diary tab is not enabled for you' }, 403);
    let body = {};
    try { body = await req.json(); } catch (e) { }
    const { id, all } = body;
    if (all) {
      await s.setJSON('diary/entries.json', []);
      return json({ ok: true, remaining: 0 });
    }
    let entries = [];
    try { entries = (await s.get('diary/entries.json', { type: 'json' })) || []; } catch (e) { }
    entries = entries.filter(e => e.id !== id);
    await s.setJSON('diary/entries.json', entries);
    return json({ ok: true, remaining: entries.length });
  }

  if (route === 'reset' && req.method === 'POST') {
    { const e = locked(['publish']); if (e) return e; }
    await s.delete('content.json');
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
};

export const config = { path: '/api/admin/*' };
