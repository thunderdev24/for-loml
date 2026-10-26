// Sends a message to YOU (Discord webhook, ntfy, and/or web-push), using the private settings.
import { getStore } from '@netlify/blobs';
import { sendToAll } from './push.mjs';

export async function sendOwner(text, title, opts = {}) {
  const store = getStore('ifra-site');
  let priv = null;
  try { priv = await store.get('private.json', { type: 'json' }); } catch (e) { }
  priv = priv || {};
  const hook = priv.discordWebhook || process.env.DISCORD_WEBHOOK_URL;
  const topic = priv.ntfyTopic || process.env.NTFY_TOPIC;
  let ok = false;

  // Discord webhook notification
  if (hook && /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(hook)) {
    try {
      let body;
      if (opts.plan) {
        body = {
          username: 'Ifra 💕',
          content: '🎮 **New Date / Valorant Plan from Ifra!** @everyone',
          embeds: [{
            title: (opts.plan.title || 'Valorant / Date Plan') + (opts.plan.subType ? ` (${opts.plan.subType})` : ''),
            description: opts.plan.note ? `*“${opts.plan.note}”*` : '*(No extra note)*',
            color: 16731501, // #ff4d6d
            fields: [
              { name: '📅 Date', value: opts.plan.dateFormatted || opts.plan.date || 'TBD', inline: true },
              { name: '⏰ Time', value: opts.plan.timeFormatted || opts.plan.time || 'TBD', inline: true }
            ],
            footer: { text: 'For-LOML Date Planner' },
            timestamp: new Date().toISOString()
          }]
        };
      } else if (opts.diary) {
        body = {
          username: 'Ifra 💕',
          content: '📖 **Ifra shared a new diary page with you!** 💖 @everyone',
          embeds: [{
            title: `${opts.diary.mood || '📖'} ${opts.diary.title || 'Personal Diary Entry'}`,
            description: opts.diary.text ? (opts.diary.text.length > 1500 ? opts.diary.text.slice(0, 1500) + '…' : opts.diary.text) : '*(Empty entry)*',
            color: 12208888, // #ba68c8 purple
            fields: [
              { name: '📅 Date', value: opts.diary.dateFormatted || opts.diary.date || 'Today', inline: true },
              { name: '💭 Mood', value: opts.diary.mood || '💖', inline: true }
            ],
            footer: { text: 'Ifra\'s Personal Diary · View in Admin' },
            timestamp: new Date().toISOString()
          }]
        };
      } else {
        body = { username: 'Ifra', content: String(text).slice(0, 1900) };
      }
      const r = await fetch(hook, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      ok = ok || r.ok;
    } catch (e) { }
  }

  // ntfy instant phone push notification
  if (topic) {
    try {
      const headers = {
        Title: title || 'Message from Ifra',
        Tags: (opts && opts.tags) || 'heart',
        Priority: (opts && opts.priority) || '4'
      };
      const r = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
        method: 'POST', body: String(text), headers
      });
      ok = ok || r.ok;
    } catch (e) { }
  }

  // Web push to all subscribed owner devices
  try {
    sendToAll(store, {
      title: title || '💌 New Message from Ifra',
      body: String(text).replace(/\n+/g, ' · ').slice(0, 180),
      url: '/admin.html',
      tag: opts.diary ? 'ifra-diary' : (opts.plan ? 'ifra-plan' : 'ifra-msg')
    }).then(res => { if (res && res.sent > 0) ok = true; }).catch(() => { });
  } catch (e) { }

  return ok;
}
