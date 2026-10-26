// Web-push helpers: VAPID keys (created automatically once), subscriptions, sending.
import webpush from 'web-push';

export async function getVapid(store) {
  let v = null;
  try { v = await store.get('push/vapid.json', { type: 'json' }); } catch (e) { }
  if (!v || !v.publicKey || !v.privateKey) {
    v = webpush.generateVAPIDKeys();
    await store.setJSON('push/vapid.json', v);
  }
  // subject must be a real https URL or mailto: address (Apple rejects fake ones like example.com); VAPID_SUBJECT can override it
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || process.env.URL || 'mailto:admin@example.com', v.publicKey, v.privateKey);
  return v;
}

export async function getSubs(store) {
  try { return (await store.get('push/subs.json', { type: 'json' })) || []; } catch (e) { return []; }
}

export async function sendToAll(store, payload) {
  await getVapid(store);
  const subs = await getSubs(store);
  const keep = [];
  let sent = 0, failed = 0;
  const errors = [];
  for (const s of subs) {
    try {
      // urgency 'high' makes Android wake the phone now instead of batching the message for later
      await webpush.sendNotification(s, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: 'high' });
      sent++; keep.push(s);
    } catch (e) {
      const code = e && e.statusCode;
      let host = ''; try { host = new URL(s.endpoint).hostname; } catch (x) { }
      errors.push({ status: code || 0, host, message: String((e && (e.body || e.message)) || e).slice(0, 200) });
      console.log('push failed', code, host, e && e.body);
      if (code === 404 || code === 410) { /* subscription expired: drop it */ }
      else { failed++; keep.push(s); }
    }
  }
  if (keep.length !== subs.length) await store.setJSON('push/subs.json', keep);
  return { sent, failed, removed: subs.length - keep.length, total: subs.length, errors };
}

export async function sendToOne(store, sub, payload) {
  await getVapid(store);
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: 'high' });
    return { ok: true };
  } catch (e) {
    const code = e && e.statusCode;
    if (code === 404 || code === 410) {
      const subs = await getSubs(store);
      const keep = subs.filter(s => s.endpoint !== sub.endpoint);
      if (keep.length !== subs.length) await store.setJSON('push/subs.json', keep);
      throw new Error('Subscription has expired on this device (410/404). Device record removed.');
    }
    throw e;
  }
}

export const DEFAULTS = {
  timezone: 'Asia/Karachi', birthdayDay: 4, birthdayMonth: 1,
  reminderDays: '30,21,14,10,7,5,3,2,1,0',
  reminderTitle: '🎂 {daysText} until your birthday, Ifra',
  reminderBody: 'Something special is waiting for you on our little website 💌',
  reminderTodayTitle: '🎉 Happy Birthday, Ifra! 🎂',
  reminderTodayBody: 'Open our website, there is a surprise made only for you ❤️'
};

// whole days from "today" (in the chosen time zone) to the next birthday
export function daysLeft(month, day, tz, now = new Date()) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  } catch (e) {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  }
  const g = t => Number(parts.find(p => p.type === t).value);
  const today = Date.UTC(g('year'), g('month') - 1, g('day'));
  let next = Date.UTC(g('year'), month - 1, day);
  if (next < today) next = Date.UTC(g('year') + 1, month - 1, day);
  return Math.round((next - today) / 86400000);
}

export function buildMessage(settings, days) {
  const s = Object.assign({}, DEFAULTS, settings || {});
  const daysText = days === 1 ? '1 day' : days + ' days';
  const fill = t => String(t).replace(/\{daysText\}/g, daysText).replace(/\{days\}/g, String(days));
  if (days === 0) return { title: fill(s.reminderTodayTitle), body: fill(s.reminderTodayBody) };
  return { title: fill(s.reminderTitle), body: fill(s.reminderBody) };
}
