// Public endpoint used when she answers / sends a message or schedules a date/game plan.
// Forwards it to your Discord webhook, ntfy topic, and web push, which stay private on the server.
import { getStore } from '@netlify/blobs';
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

  let body = {};
  try { body = await req.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }

  let text = String(body.text || '').slice(0, 2000).trim();
  const title = body.title ? String(body.title).slice(0, 150) : null;
  const plan = body.plan && typeof body.plan === 'object' ? body.plan : null;

  if (plan) {
    const store = getStore('ifra-site');
    const cleanPlan = {
      id: 'plan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      planType: String(plan.planType || 'custom').slice(0, 50),
      title: String(plan.title || 'Valorant / Date Plan').slice(0, 100),
      subType: plan.subType ? String(plan.subType).slice(0, 50) : '',
      date: String(plan.date || '').slice(0, 30),
      dateFormatted: String(plan.dateFormatted || plan.date || '').slice(0, 60),
      time: String(plan.time || '').slice(0, 30),
      timeFormatted: String(plan.timeFormatted || plan.time || '').slice(0, 40),
      note: String(plan.note || '').slice(0, 500),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    try {
      let list = (await store.get('plans/list.json', { type: 'json' })) || [];
      list.unshift(cleanPlan);
      if (list.length > 60) list = list.slice(0, 60);
      await store.setJSON('plans/list.json', list);
    } catch (e) { }

    if (!text) {
      text = `🎮 New Plan from Ifra: ${cleanPlan.title}${cleanPlan.subType ? ' (' + cleanPlan.subType + ')' : ''}!\n` +
             `📅 Date: ${cleanPlan.dateFormatted}\n` +
             `⏰ Time: ${cleanPlan.timeFormatted}\n` +
             (cleanPlan.note ? `💬 Note: “${cleanPlan.note}”` : '');
    }

    const ok = await sendOwner(text, title || '🎮 Valorant / Date Plan from Ifra! 💖', {
      tags: 'video_game,calendar,heart',
      priority: '4',
      plan: cleanPlan
    });
    return json({ ok: true, plan: cleanPlan, notified: ok });
  }

  const diary = body.diary && typeof body.diary === 'object' ? body.diary : null;
  if (diary) {
    const store = getStore('ifra-site');
    const cleanEntry = {
      id: String(diary.id || ('entry_' + Date.now().toString(36))),
      title: String(diary.title || 'Untitled Entry').slice(0, 100),
      mood: String(diary.mood || '💖').slice(0, 30),
      date: String(diary.date || new Date().toISOString().slice(0, 10)).slice(0, 30),
      dateFormatted: String(diary.dateFormatted || diary.date || '').slice(0, 60),
      text: String(diary.text || '').slice(0, 5000),
      sharedAt: new Date().toISOString()
    };

    try {
      let list = (await store.get('diary/entries.json', { type: 'json' })) || [];
      const idx = list.findIndex(e => e.id === cleanEntry.id);
      if (idx >= 0) list[idx] = cleanEntry;
      else list.unshift(cleanEntry);
      if (list.length > 100) list = list.slice(0, 100);
      await store.setJSON('diary/entries.json', list);
    } catch (e) { }

    if (!text) {
      text = `📖 New Diary Page from Ifra: ${cleanEntry.mood} “${cleanEntry.title}”\n` +
             `📅 Date: ${cleanEntry.dateFormatted || cleanEntry.date}\n\n` +
             `“${cleanEntry.text.slice(0, 280)}${cleanEntry.text.length > 280 ? '…' : ''}”\n\n` +
             `Read the full page in your admin panel 💖`;
    }

    const ok = await sendOwner(text, title || `📖 Diary Page from Ifra: ${cleanEntry.title} 💖`, {
      tags: 'book,heart,pencil2',
      priority: '4',
      diary: cleanEntry
    });
    return json({ ok: true, entry: cleanEntry, notified: ok });
  }

  if (body.type === 'diary-unshare' && body.id) {
    const store = getStore('ifra-site');
    try {
      let list = (await store.get('diary/entries.json', { type: 'json' })) || [];
      list = list.filter(e => e.id !== body.id);
      await store.setJSON('diary/entries.json', list);
    } catch (e) { }
    return json({ ok: true });
  }

  if (!text) return json({ ok: false }, 400);

  const ok = await sendOwner(text, title || 'Message from Ifra');
  return json({ ok }, ok ? 200 : 502);
};

export const config = { path: '/api/notify' };
