// Sends a message to YOU (Discord webhook and/or ntfy), using the private settings.
import { getStore } from '@netlify/blobs';

export async function sendOwner(text, title) {
  let priv = null;
  try { priv = await getStore('ifra-site').get('private.json', { type: 'json' }); } catch (e) { }
  priv = priv || {};
  const hook = priv.discordWebhook || process.env.DISCORD_WEBHOOK_URL;
  const topic = priv.ntfyTopic || process.env.NTFY_TOPIC;
  let ok = false;
  if (hook && /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(hook)) {
    try {
      const r = await fetch(hook, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'Ifra', content: String(text).slice(0, 1900) })
      });
      ok = ok || r.ok;
    } catch (e) { }
  }
  if (topic) {
    try {
      const r = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
        method: 'POST', body: String(text), headers: { Title: title || 'Message from Ifra', Tags: 'heart' }
      });
      ok = ok || r.ok;
    } catch (e) { }
  }
  return ok;
}
