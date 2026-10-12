// Shared login helpers: users (hashed passwords), signed tokens, and which parts of the content are private.
import crypto from 'node:crypto';

export const ROLES = ['me', 'her'];
export const PROTECTED_TOP = ['memories', 'story', 'proposalScenes', 'yesScenes', 'noTexts'];
export const PROTECTED_TEXT = ['proposalTitle', 'proposalSub', 'proposalYes', 'proposalFinal'];
const DAYS = 30;

const secret = () => (process.env.ADMIN_SECRET || '') + '|' + (process.env.ADMIN_PASSWORD || '');
const sign = p => crypto.createHmac('sha256', secret()).update('user|' + p).digest('base64url');
const safeEq = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

export async function getUsers(store) {
  try { return (await store.get('users.json', { type: 'json' })) || {}; } catch (e) { return {}; }
}
export const hasUsers = users => ROLES.some(r => users && users[r] && users[r].hash);

export function hashPw(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}
export function newCredentials(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPw(password, salt) };
}
export function checkPw(user, password) {
  // always do the same work, so timing does not reveal whether the email exists
  const salt = (user && user.salt) || '00';
  const h = hashPw(password, salt);
  return !!(user && user.hash && safeEq(h, user.hash));
}

// token = "u:role:ver:expiry" + "." + signature. Changing a login bumps "ver", which logs the old sessions out.
export function makeUserToken(role, ver) {
  const p = 'u:' + role + ':' + (ver || 1) + ':' + (Date.now() + DAYS * 86400e3);
  return p + '.' + sign(p);
}
export function verifyUserToken(req, users) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const i = t.lastIndexOf('.');
  if (i < 1) return null;
  const p = t.slice(0, i), s = t.slice(i + 1);
  if (!safeEq(s, sign(p))) return null;
  const [tag, role, ver, exp] = p.split(':');
  if (tag !== 'u' || !ROLES.includes(role) || Number(exp) < Date.now()) return null;
  const u = users && users[role];
  if (!u || !u.hash || Number(ver) !== (u.ver || 1)) return null;
  return { role };
}

export function stripProtected(content) {
  if (!content || typeof content !== 'object') return content;
  const c = Object.assign({}, content);
  PROTECTED_TOP.forEach(k => { delete c[k]; });
  if (c.text) { c.text = Object.assign({}, c.text); PROTECTED_TEXT.forEach(k => { delete c.text[k]; }); }
  return c;
}
export function pickProtected(content) {
  if (!content) return null;
  const out = {};
  PROTECTED_TOP.forEach(k => { if (content[k] !== undefined) out[k] = content[k]; });
  const text = {};
  PROTECTED_TEXT.forEach(k => { if (content.text && content.text[k] !== undefined) text[k] = content.text[k]; });
  if (Object.keys(text).length) out.text = text;
  return out;
}
