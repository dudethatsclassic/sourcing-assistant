/**
 * Cloudflare Worker — Publix API CORS Proxy
 * Forwards requests to services.publix.com, adding required headers so the
 * GitHub Pages sourcing assistant can call Publix from the browser.
 *
 * Deploy at: https://dash.cloudflare.com → Workers & Pages → Create Worker
 * Paste this entire file, click Save & Deploy.
 * Name it: publix-proxy
 */

const ALLOWED_ORIGIN = 'https://dudethatsclassic.github.io';
const PUBLIX_API     = 'https://services.publix.com/search/api/search/storeproductssavings/';

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Publix-Store',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const origin = request.headers.get('Origin') || '';
    if (origin && origin !== ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });

    const storeId = request.headers.get('X-Publix-Store') || '1658';
    const body    = await request.text();

    try {
      const publixRes = await fetch(PUBLIX_API, {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'Accept':         '*/*',
          'Accept-Language':'en-US,en;q=0.9',
          'Origin':         'https://www.publix.com',
          'Referer':        'https://www.publix.com/',
          'Publixstore':    storeId,
          'X-Src':          'WEB_WEEKLYAD_MODAL',
          'User-Agent':     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
        body,
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
