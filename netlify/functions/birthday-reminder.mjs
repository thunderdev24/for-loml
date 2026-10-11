// Runs every day (see "schedule"). Sends a notification when today is one of your reminder days.
import { getStore } from '@netlify/blobs';
import { sendToAll, daysLeft, buildMessage, DEFAULTS } from './lib/push.mjs';

export default async () => {
  const store = getStore('ifra-site');
  let content = null;
  try { content = await store.get('content.json', { type: 'json' }); } catch (e) { }
  const st = Object.assign({}, DEFAULTS, (content && content.settings) || {});
  const days = daysLeft(Number(st.birthdayMonth), Number(st.birthdayDay), st.timezone);
  const wanted = String(st.reminderDays).split(',').map(x => parseInt(x, 10)).filter(n => !isNaN(n));
  if (!wanted.includes(days)) return new Response('No reminder today (' + days + ' days left)');

  // never send twice on the same day
  const stamp = new Date().toISOString().slice(0, 10);
  let last = null;
  try { last = await store.get('push/last.json', { type: 'json' }); } catch (e) { }
  if (last && last.stamp === stamp) return new Response('Already sent today');

  const msg = buildMessage(st, days);
  const res = await sendToAll(store, { title: msg.title, body: msg.body, url: '/', tag: 'ifra-birthday' });
  await store.setJSON('push/last.json', { stamp, days, res });
  return new Response('Sent: ' + JSON.stringify(res));
};

// 04:00 UTC every day = 09:00 in Pakistan. Change the hour here if you want another time (it is in UTC).
export const config = { schedule: '0 4 * * *' };
