// Public: serves the content saved from the admin panel as a script.
// When logins are set up, the private parts (photos, story, proposal) are NOT included here.
import { getStore } from '@netlify/blobs';
import { getUsers, hasUsers, stripProtected } from './lib/authlib.mjs';

export default async () => {
  const store = getStore('ifra-site');
  let content = null, priv = null;
  try { content = await store.get('content.json', { type: 'json' }); } catch (e) { }
  try { priv = await store.get('private.json', { type: 'json' }); } catch (e) { }
  const locked = hasUsers(await getUsers(store));
  if (locked) content = stripProtected(content);
  const notify = !!((priv && (priv.ntfyTopic || priv.discordWebhook)) ||
    process.env.NTFY_TOPIC || process.env.DISCORD_WEBHOOK_URL);
  const body = 'window.SITE_LIVE = ' + JSON.stringify(content || null) + ';\n' +
               'window.SITE_NOTIFY = ' + notify + ';\n' +
               'window.SITE_LOCK = ' + locked + ';\n';
  return new Response(body, {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }
  });
};

export const config = { path: '/api/live.js' };
