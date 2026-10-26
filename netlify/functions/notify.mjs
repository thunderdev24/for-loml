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

  if (!text) return json({ ok: false }, 400);

  const ok = await sendOwner(text, title || 'Message from Ifra');
  return json({ ok }, ok ? 200 : 502);
};

export const config = { path: '/api/notify' };
