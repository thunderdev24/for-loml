// Section passwords for the admin panel.
// A password can be put on any admin tab. The server refuses to save changes to a locked section
// (or to a locked tab's actions) unless the request carries a fresh unlock token for that tab.
import crypto from 'node:crypto';
import { newCredentials, checkPw } from './authlib.mjs';

/* which part of the saved content belongs to which admin tab */
const PLAY = ['cineSongFile', 'cineSongStart', 'loveSongFile', 'loveSongStart', 'proposalSongStart'];
const PROP_TEXT = ['proposalTitle', 'proposalSub', 'proposalYes', 'proposalFinal'];
const pick = (o, keys) => { const r = {}; keys.forEach(k => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
const omit = (o, keys) => { const r = Object.assign({}, o || {}); keys.forEach(k => { delete r[k]; }); return r; };

export const SECTIONS = {
  texts:     c => omit(c.text, PROP_TEXT),
  photos:    c => pick(c, ['memories']),
  playlist:  c => ({ songs: c.songs, settings: pick(c.settings, PLAY) }),
  when:      c => pick(c, ['envelopes']),
  story:     c => pick(c, ['story']),
  poetry:    c => pick(c, ['poetryLines']),
  surprises: c => pick(c, ['heartMilestones', 'scratch', 'bouquet', 'promises', 'celebration', 'cinemaLines']),
  games:     c => pick(c, ['games', 'gameMsgs']),
  riddles:   c => pick(c, ['riddles', 'riddleMsgs', 'funnyRight', 'funnyWrong']),
  sweet:     c => pick(c, ['sweet', 'sweetMsgs']),
  proposal:  c => Object.assign(pick(c, ['proposalScenes', 'yesScenes', 'noTexts']), { text: pick(c.text, PROP_TEXT) }),
  settings:  c => omit(c.settings, PLAY)
};
// tabs without content of their own: logins (the two accounts), locks (this screen), publish (saving / reset)
export const LOCKABLE = Object.keys(SECTIONS).concat(['logins', 'sitelocks', 'locks', 'publish']);
export const TITLES = {
  texts: 'Page texts', photos: 'Photos & captions', playlist: 'Playlist', when: 'Open When', story: 'Our Story',
  poetry: 'Birthday poetry', surprises: 'Surprises', games: 'Games', riddles: 'Riddles', sweet: 'Sweet quiz',
  proposal: 'Proposal', logins: 'Logins', sitelocks: 'Website locks', locks: 'Section passwords', settings: 'Dates & delivery', publish: 'Publish'
};

const stable = v => {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
};

/* which sections differ between the saved content and the content about to be saved */
export function changedSections(oldC, newC, oldPriv, newPriv) {
  const out = [];
  Object.keys(SECTIONS).forEach(t => {
    const a = oldC ? SECTIONS[t](oldC) : null, b = SECTIONS[t](newC);
    if (stable(a) !== stable(b)) out.push(t);
  });
  if (newPriv && stable(pick(oldPriv || {}, ['ntfyTopic', 'discordWebhook'])) !== stable(pick(newPriv, ['ntfyTopic', 'discordWebhook'])) && !out.includes('settings')) out.push('settings');
  return out;
}

/* stored locks */
export async function getLocks(store) {
  try { return (await store.get('locks.json', { type: 'json' })) || {}; } catch (e) { return {}; }
}
export const saveLocks = (store, locks) => store.setJSON('locks.json', locks);
export const makeLock = (password, old) => Object.assign(newCredentials(password), { ver: ((old && old.ver) || 0) + 1 });
export const checkLock = (lock, password) => checkPw(lock, String(password || ''));

/* unlock tokens: "k:tab:ver:expiry.signature", sent by the admin page in the X-Unlocks header */
const secret = () => (process.env.ADMIN_SECRET || '') + '|' + (process.env.ADMIN_PASSWORD || '');
const sign = p => crypto.createHmac('sha256', secret()).update('lock|' + p).digest('base64url');
const safeEq = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
export function makeUnlockToken(tab, ver) {
  const p = 'k:' + tab + ':' + (ver || 1) + ':' + (Date.now() + 12 * 3600e3);
  return p + '.' + sign(p);
}
export function unlockedTabs(req, locks) {
  const open = new Set();
  String(req.headers.get('x-unlocks') || '').split(',').forEach(t => {
    t = t.trim();
    const i = t.lastIndexOf('.');
    if (i < 1) return;
    const p = t.slice(0, i), s = t.slice(i + 1);
    if (!safeEq(s, sign(p))) return;
    const [tag, tab, ver, exp] = p.split(':');
    const l = locks[tab];
    if (tag === 'k' && l && Number(exp) > Date.now() && Number(ver) === (l.ver || 1)) open.add(tab);
  });
  return open;
}
/* tabs from `tabs` that are locked and not unlocked by this request */
export const missingUnlocks = (tabs, locks, open) => tabs.filter(t => locks[t] && !open.has(t));
export const lockedMessage = miss => 'Locked: ' + miss.map(t => TITLES[t] || t).join(', ') + '. Unlock ' + (miss.length > 1 ? 'them' : 'it') + ' first.';
