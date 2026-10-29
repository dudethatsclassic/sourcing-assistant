/**
 * Cloudflare Worker — SourceBuddy cloud sync (replaces JSONBin)
 * Stores the app's shared state (store tags, weekly list, purchases, inventory…)
 * as one JSON document in Workers KV.
 *
 * Deploy: dash.cloudflare.com → Workers & Pages → Create → Worker
 *   name it "sourcebuddy-sync", paste this file, Deploy.
 * Then in the Worker → Settings → Bindings:
 *   - KV namespace binding:  variable name STORE  →  your "sourcebuddy" namespace
 * And Settings → Variables and Secrets:
 *   - Secret:  SYNC_TOKEN  →  a long random string (also entered in the app's ⚙️ Settings)
 *
 * API (all requests need header X-Sync-Token):
 *   GET  /state                          → { record }   (record is null until first save)
 *   PUT  /state  { record, baseEditTs }  → { ok, editTs }
 *        409 { error: 'conflict', record } if the stored copy changed since baseEditTs —
 *        the app merges and retries, so a stale device can't overwrite newer edits.
 *   GET  /orders                         → { orders }   (compact orders: date, item ID, qty — no customer data)
 *   PUT  /orders { orders }              → { ok }        (latest upload replaces the previous one)
 */

const ALLOWED_ORIGINS = ['https://dudethatsclassic.github.io', 'http://localhost:4400'];
const MAX_BYTES = 2 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Token',
      'Access-Control-Max-Age':       '86400',
      'Vary':                         'Origin',
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'forbidden origin' }, 403);
    if (!env.SYNC_TOKEN || request.headers.get('X-Sync-Token') !== env.SYNC_TOKEN) {
      return json({ error: 'bad token' }, 401);
    }
    if (!env.STORE) return json({ error: 'KV binding STORE missing' }, 500);
    const path = new URL(request.url).pathname;

    if (path === '/orders') {
      if (request.method === 'GET') return json({ orders: await env.STORE.get('orders', 'json') });
      if (request.method === 'PUT') {
        const text = await request.text();
        if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413);
        let body;
        try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
        if (!body || !Array.isArray(body.orders?.rows)) return json({ error: 'missing orders' }, 400);
        await env.STORE.put('orders', JSON.stringify(body.orders));
        return json({ ok: true });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    if (path !== '/state') return json({ error: 'not found' }, 404);

    if (request.method === 'GET') {
      return json({ record: await env.STORE.get('state', 'json') });
    }

    if (request.method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
      if (!body || typeof body.record !== 'object' || body.record === null) {
        return json({ error: 'missing record' }, 400);
      }
      const current = await env.STORE.get('state', 'json');
      if (current && (body.baseEditTs || 0) !== (current.editTs || 0)) {
        return json({ error: 'conflict', record: current }, 409);
      }
      await env.STORE.put('state', JSON.stringify(body.record));
      return json({ ok: true, editTs: body.record.editTs || 0 });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
