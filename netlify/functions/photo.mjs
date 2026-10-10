// Public: serves photos uploaded from the admin panel.
import { getStore } from '@netlify/blobs';

export default async (req) => {
  const name = decodeURIComponent(new URL(req.url).pathname.split('/').pop() || '');
  if (!/^[a-z0-9._-]{1,90}$/i.test(name)) return new Response('Not found', { status: 404 });
  const r = await getStore('ifra-site').getWithMetadata('photo/' + name, { type: 'arrayBuffer' });
  if (!r) return new Response('Not found', { status: 404 });
  return new Response(r.data, {
    headers: {
      'content-type': (r.metadata && r.metadata.type) || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff'
    }
  });
};

export const config = { path: '/api/photo/*' };
