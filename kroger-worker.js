/**
 * Cloudflare Worker — Kroger API CORS Proxy
 * Forwards requests to api.kroger.com, adding CORS headers so the
 * GitHub Pages sourcing assistant can call Kroger from the browser.
 *
 * Deploy at: https://dash.cloudflare.com → Workers & Pages → Create Worker
 * Paste this entire file, click Save & Deploy.
 */

const ALLOWED_ORIGIN = 'https://dudethatsclassic.github.io';
const KROGER_BASE    = 'https://api.kroger.com';

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    const corsHeaders = {
      'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Block requests not coming from our app
    if (origin && origin !== ALLOWED_ORIGIN) {
      return new Response('Forbidden', { status: 403 });
    }

    // Build the Kroger URL from the incoming path + query string
    const url       = new URL(request.url);
    const krogerUrl = KROGER_BASE + url.pathname + url.search;

    // Strip browser-added headers that would confuse Kroger
    const headers = new Headers(request.headers);
    headers.delete('Origin');
    headers.delete('Host');
    headers.delete('CF-Connecting-IP');
    headers.delete('CF-Ray');

    const proxyReq = new Request(krogerUrl, {
      method:  request.method,
      headers: headers,
      body:    ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });

    try {
      const krogerRes = await fetch(proxyReq);
      const body      = await krogerRes.arrayBuffer();

      const respHeaders = {
        'Content-Type': krogerRes.headers.get('Content-Type') || 'application/json',
        ...corsHeaders,
      };

      return new Response(body, {
        status:  krogerRes.status,
        headers: respHeaders,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status:  502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};
