/**
 * Cloudflare Worker — Publix API CORS Proxy
 * Auto-extracts the weekly filterQuery from Publix's JS bundle (cached 7 days).
 * Falls back to filterQuery from the request body if bundle extraction fails.
 *
 * Deploy at: https://dash.cloudflare.com → Workers & Pages → Create Worker
 * Paste this entire file, click Save & Deploy.
 * Name it: publix-proxy
 */

const ALLOWED_ORIGIN  = 'https://dudethatsclassic.github.io';
const PUBLIX_API      = 'https://services.publix.com/search/api/search/storeproductssavings/';
const PUBLIX_WEEKLY   = 'https://www.publix.com/savings/weekly-ad';
const FILTER_CACHE_URL = 'https://publix-proxy-internal/filter-query-cache';

const BOT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Publix-Store, X-Publix-Token',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const origin = request.headers.get('Origin') || '';
    if (origin && origin !== ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });

    const storeId  = request.headers.get('X-Publix-Store') || '1658';
    const token    = request.headers.get('X-Publix-Token') || '';
    const bodyText = await request.text();

    // Auto-resolve filterQuery from JS bundle (cached 7 days), merge into body
    let finalBody = bodyText;
    try {
      const bodyObj = JSON.parse(bodyText);
      if (!bodyObj.variables.filterQuery) {
        const autoFilter = await getFilterQuery(token);
        if (autoFilter) bodyObj.variables.filterQuery = autoFilter;
        finalBody = JSON.stringify(bodyObj);
      }
    } catch (_) {}

    try {
      const publixRes = await fetch(PUBLIX_API, {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'Accept':          '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin':          'https://www.publix.com',
          'Referer':         'https://www.publix.com/',
          'Publixstore':     storeId,
          'X-Src':           'WEB_WEEKLYAD_MODAL',
          'User-Agent':      BOT_UA,
          ...(token ? { 'Cookie': token } : {}),
        },
        body: finalBody,
      });

      const text = await publixRes.text();
      return new Response(text, {
        status: publixRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

async function getFilterQuery(userCookie) {
  const cache    = caches.default;
  const cacheKey = new Request(FILTER_CACHE_URL);

  // Return cached value if still fresh (7 days)
  const cached = await cache.match(cacheKey);
  if (cached) {
    const { filterQuery, ts } = await cached.json();
    if (filterQuery && Date.now() - ts < 7 * 24 * 3600 * 1000) return filterQuery;
  }

  // Fetch weekly ad page to get JS bundle URLs
  const pageRes = await fetch(PUBLIX_WEEKLY, {
    headers: {
      'User-Agent': BOT_UA,
      'Accept':     'text/html',
      ...(userCookie ? { 'Cookie': userCookie } : {}),
    },
  });
  const html = await pageRes.text();

  // Extract script src URLs — prioritise page-specific chunks, skip framework bundles
  const allScripts = [...html.matchAll(/src="([^"]+\.js)"/g)]
    .map(m => m[1].startsWith('http') ? m[1] : 'https://www.publix.com' + m[1]);

  const skip = /framework|webpack|polyfill|runtime/i;
  const priority = /savings|weekly|ad|promo/i;

  const scripts = [
    ...allScripts.filter(u => priority.test(u)),
    ...allScripts.filter(u => !priority.test(u) && !skip.test(u)),
  ];

  // Search bundles for the filterQuery string literal
  for (const url of scripts) {
    try {
      const res  = await fetch(url, { headers: { 'User-Agent': BOT_UA } });
      const code = await res.text();
      const match = code.match(/promoGroupId::\d+-\d+(?:\|\|promoGroupId::\d+-\d+)+/);
      if (match) {
        const filterQuery = match[0];
        await cache.put(cacheKey, new Response(
          JSON.stringify({ filterQuery, ts: Date.now() }),
          { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=604800' } }
        ));
        return filterQuery;
      }
    } catch (_) { continue; }
  }

  return '';
}
