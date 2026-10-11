// Public: streams songs / voice messages uploaded from the admin panel, with Range support
// (phones need Range to play and seek audio). Responses are capped so they stay under Netlify's size limit.
import { getStore } from '@netlify/blobs';

const CAP = 3 * 1024 * 1024;

export default async (req) => {
  const id = decodeURIComponent(new URL(req.url).pathname.split('/').pop() || '');
  if (!/^[a-f0-9]{16,32}$/.test(id)) return new Response('Not found', { status: 404 });
  const store = getStore('ifra-site');
  const meta = await store.get('media/' + id + '/meta', { type: 'json' });
  if (!meta) return new Response('Not found', { status: 404 });

  const size = meta.size, CH = meta.chunkSize;
  let start = 0, end = size - 1, partial = false;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m) {
    partial = true;
    if (m[1] === '') { start = Math.max(0, size - Number(m[2] || 0)); }
    else { start = Number(m[1]); if (m[2] !== '') end = Math.min(end, Number(m[2])); }
  }
  if (start >= size || start > end) {
    return new Response('Range not satisfiable', { status: 416, headers: { 'content-range': 'bytes */' + size } });
  }
  if (end - start + 1 > CAP) { end = start + CAP - 1; partial = true; }

  const first = Math.floor(start / CH), last = Math.floor(end / CH);
  const bufs = [];
  for (let n = first; n <= last; n++) {
    const ab = await store.get('media/' + id + '/' + n, { type: 'arrayBuffer' });
    if (!ab) return new Response('Missing data', { status: 500 });
    const buf = Buffer.from(ab);
    const from = n === first ? start - n * CH : 0;
    const to = n === last ? end - n * CH + 1 : buf.length;
    bufs.push(buf.subarray(from, to));
  }
  const body = Buffer.concat(bufs);
  const headers = {
    'content-type': meta.type || 'audio/mpeg',
    'accept-ranges': 'bytes',
    'content-length': String(body.length),
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff'
  };
  if (partial) headers['content-range'] = 'bytes ' + start + '-' + end + '/' + size;
  return new Response(body, { status: partial ? 206 : 200, headers });
};

export const config = { path: '/api/media/*' };
