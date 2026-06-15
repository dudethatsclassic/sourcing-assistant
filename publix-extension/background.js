// Intercepts storeproductssavings requests on publix.com to extract the filterQuery,
// then asks the publix page content script to make the actual fetch (it has access
// to the page's cookies, including HttpOnly Akamai cookies, via credentials:'include').

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== 'POST') return;

    const raw = details.requestBody?.raw?.[0]?.bytes;
    if (!raw) return;

    let body;
    try { body = JSON.parse(new TextDecoder().decode(new Uint8Array(raw))); }
    catch (e) { return; }

    const filterQuery = body.variables?.filterQuery;
    if (!filterQuery) return; // skip promo-banner calls

    // Delegate the actual fetch to the content script on the publix.com tab,
    // so the request uses the page's cookie jar automatically.
    chrome.tabs.sendMessage(details.tabId, { type: 'FETCH_PUBLIX_SALES', filterQuery },
      () => { if (chrome.runtime.lastError) { /* content script not ready yet */ } }
    );
  },
  { urls: ['https://services.publix.com/search/api/search/storeproductssavings/*'] },
  ['requestBody']
);

// Receive results back from the content script and cache them.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'PUBLIX_SALE_ITEMS') return;
  chrome.storage.local.set({ publixSaleItems: msg.items, publixSaleTs: Date.now() });
  console.log('[Publix Bridge] Cached', msg.items.length, 'sale items');
});
