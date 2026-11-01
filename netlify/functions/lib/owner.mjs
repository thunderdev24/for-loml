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
  const result = { discord: false, ntfy: false, push: false, ok: false, errors: [] };
  const jobs = [];

  // Discord webhook notification
  if (hook && /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(hook)) {
    jobs.push((async () => {
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
        result.discord = r.ok;
        if (!r.ok) result.errors.push('discord ' + r.status);
      } catch (e) { result.errors.push('discord: ' + String(e && e.message || e).slice(0, 120)); }
    })());
  }

  // ntfy instant phone push notification.
  // Titles contain emoji, and HTTP headers can only carry plain Latin-1, so a "Title:" header throws and the
  // alert was silently lost. ntfy's JSON publish API accepts any UTF-8 text, so we use that.
  if (topic) {
    jobs.push((async () => {
      const tags = String((opts && opts.tags) || 'heart').split(',').map(t => t.trim()).filter(Boolean);
      const priority = Number((opts && opts.priority) || 4) || 4;
      const message = String(text).slice(0, 3900);
      const site = String(process.env.URL || '').replace(/\/$/, '');
      try {
        const payload = { topic, title: title || 'Message from Ifra', message, tags, priority };
        if (site) payload.click = site + '/admin.html';
        const r = await fetch('https://ntfy.sh', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (r.ok) { result.ntfy = true; return; }
        result.errors.push('ntfy json ' + r.status);
      } catch (e) { result.errors.push('ntfy json: ' + String(e && e.message || e).slice(0, 120)); }
      try {   // last resort: plain-text headers only
        const plain = s => String(s || '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
        const r = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
          method: 'POST', body: message,
          headers: { Title: plain(title) || 'Message from Ifra', Tags: tags.join(',') || 'heart', Priority: String(priority) }
        });
        result.ntfy = r.ok;
        if (!r.ok) result.errors.push('ntfy plain ' + r.status);
      } catch (e) { result.errors.push('ntfy plain: ' + String(e && e.message || e).slice(0, 120)); }
    })());
  }

  // Web push to all subscribed owner devices.
  // This MUST be awaited: on a serverless function the work is frozen the moment the response is returned,
  // so a "fire and forget" push was often never delivered.
  jobs.push((async () => {
    try {
      const res = await Promise.race([
        sendToAll(store, {
          title: title || '💌 New Message from Ifra',
          body: String(text).replace(/\n+/g, ' · ').slice(0, 180),
          url: '/admin.html',
          tag: opts.diary ? 'ifra-diary' : (opts.plan ? 'ifra-plan' : 'ifra-msg')
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('push timed out')), 8000))
      ]);
      result.push = !!(res && res.sent > 0);
      if (res && !res.total) result.errors.push('push: no device is subscribed (open admin on your phone and turn notifications on)');
      else if (res && !res.sent) result.errors.push('push: ' + ((res.errors && res.errors[0] && res.errors[0].message) || 'every device failed'));
    } catch (e) { result.errors.push('push: ' + String(e && e.message || e).slice(0, 120)); }
  })());

  await Promise.all(jobs);
  result.ok = result.discord || result.ntfy || result.push;
  console.log('sendOwner', JSON.stringify({ kind: opts.plan ? 'plan' : opts.diary ? 'diary' : 'message', discord: result.discord, ntfy: result.ntfy, push: result.push, errors: result.errors }));
  return opts.detail ? result : result.ok;
}
