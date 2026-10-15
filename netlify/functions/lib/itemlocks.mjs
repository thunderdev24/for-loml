// Locks on individual things of the public website (a button, a surprise tile, a game, one "Open When" letter...).
// Each locked thing has its own password. Only the list of locked ids (and a hint) is public; passwords are stored hashed.
import crypto from 'node:crypto';
import { newCredentials, checkPw } from './authlib.mjs';

export const ITEM_IDS = ['gallery', 'story', 'proposal', 'forever', 'care',
  'wish', 'scratch', 'bouquet', 'quiz', 'sweet', 'promises', 'meter', 'writeback',
  'catch', 'match', 'ttt', 'gtr', 'flight', 'breaker'];
export const isItemId = id => ITEM_IDS.includes(id) || /^env\d{1,3}$/.test(id);

export async function getItemLocks(store) {
  try { return (await store.get('itemlocks.json', { type: 'json' })) || {}; } catch (e) { return {}; }
}
export const saveItemLocks = (store, locks) => store.setJSON('itemlocks.json', locks);
export const makeItemLock = (password, old, hint) =>
  Object.assign(newCredentials(password), { ver: ((old && old.ver) || 0) + 1, hint: String(hint || '').slice(0, 120) });
export const checkItemPw = (lock, password) => checkPw(lock, String(password || ''));

/* what the public page may know: which ids are locked, and the hint */
export function publicItemLocks(locks) {
  const out = {};
  Object.keys(locks || {}).forEach(id => { if (locks[id] && locks[id].hash) out[id] = { hint: locks[id].hint || '' }; });
  return out;
}

/* locked "Open When" letters are sent without their text; the text comes back after the right password */
export function stripLockedEnvelopes(content, locks) {
  if (!content || !Array.isArray(content.envelopes)) return content;
  const c = Object.assign({}, content);
  c.envelopes = content.envelopes.map((e, i) => (locks['env' + i] && locks['env' + i].hash) ? Object.assign({}, e, { body: '' }) : e);
  return c;
}

/* unlock token: "i:id:ver:expiry.signature" (stays valid 30 days, dies when the password changes) */
const secret = () => (process.env.ADMIN_SECRET || '') + '|' + (process.env.ADMIN_PASSWORD || '');
const sign = p => crypto.createHmac('sha256', secret()).update('item|' + p).digest('base64url');
const safeEq = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
export function makeItemToken(id, ver) {
  const p = 'i:' + id + ':' + (ver || 1) + ':' + (Date.now() + 30 * 86400e3);
  return p + '.' + sign(p);
}
export function verifyItemToken(token, id, lock) {
  const t = String(token || ''), i = t.lastIndexOf('.');
  if (i < 1 || !lock || !lock.hash) return false;
  const p = t.slice(0, i);
  if (!safeEq(t.slice(i + 1), sign(p))) return false;
  const [tag, tid, ver, exp] = p.split(':');
  return tag === 'i' && tid === id && Number(exp) > Date.now() && Number(ver) === (lock.ver || 1);
}
