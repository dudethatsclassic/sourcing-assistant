// When publix.com fires a storeproductssavings request we:
// 1. Read the filterQuery from the request body
// 2. Grab all publix.com cookies (including HttpOnly) from the cookie store
// 3. Make our OWN fetch to Publix from the user's machine (user's real IP — no proxy)
// 4. Cache the sale items in chrome.storage.local
// The content script then injects them into the sourcing assistant's localStorage.

const PUBLIX_API  = 'https://services.publix.com/search/api/search/storeproductssavings/';
const STORE_ID    = '1658';
const PUBLIX_GQL  = `query GetStoreProductsSavingsSearchResultAsync($keyword: String, $skip: Int!, $take: Int!, $facetOverrideStr: String, $facets: String, $sortOrder: String, $ispu: Boolean, $categoryID: String, $minMatch: Int!, $boostVarIndex: Int!, $wildcardSearch: Boolean!, $isPreviewSite: Boolean!, $segmentVarIndex: Int!, $getOrderHistory: Boolean!, $filterQuery: String, $reorderItemCodes: [Int!], $intents: [String!], $searchRetryIndex: Int!, $intentVarIndex: Int!, $boostBuryQuery: String, $source: String, $elevatedProducts: [KeyValuePairOfStringAndStringInput!], $couponId: String, $forceElevation: Boolean, $searchVariation: [KeyValuePairOfStringAndStringInput!], $userCoupon: String) { storeProductsSavingsSearchResult( keyword: $keyword skip: $skip take: $take facetOverrideStr: $facetOverrideStr facets: $facets sortOrder: $sortOrder ispu: $ispu categoryID: $categoryID minMatch: $minMatch boostVarIndex: $boostVarIndex wildcardSearch: $wildcardSearch isPreviewSite: $isPreviewSite segmentVarIndex: $segmentVarIndex getOrderHistory: $getOrderHistory filterQuery: $filterQuery reorderItemCodes: $reorderItemCodes intents: $intents boostBuryQuery: $boostBuryQuery searchRetryIndex: $searchRetryIndex intentVarIndex: $intentVarIndex source: $source elevatedProducts: $elevatedProducts couponId: $couponId forceElevation: $forceElevation searchVariation: $searchVariation userCoupon: $userCoupon ) { storeProducts { title titleBrand sizeDescription onSale priceLine promoMsg promoType promoValidThruMsg promoTotalSavings } totalCount } }`;

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== 'POST') return;

    const raw = details.requestBody?.raw?.[0]?.bytes;
    if (!raw) return;

    let body;
    try { body = JSON.parse(new TextDecoder().decode(new Uint8Array(raw))); }
    catch (e) { return; }

    const filterQuery = body.variables?.filterQuery;
    if (!filterQuery) return; // skip promo-banner call (no filterQuery)

    // Fire async — doesn't block the original request
    fetchAndCache(filterQuery);
  },
  { urls: ['https://services.publix.com/search/api/search/storeproductssavings/*'] },
  ['requestBody']
);

async function fetchAndCache(filterQuery) {
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.publix.com' });
    if (!cookies.length) return;
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const res = await fetch(PUBLIX_API, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin':          'https://www.publix.com',
        'Referer':         'https://www.publix.com/',
        'Publixstore':     STORE_ID,
        'X-Src':           'WEB_WEEKLYAD_MODAL',
        'Cookie':          cookieStr,
      },
      body: JSON.stringify({
        operationName: 'GetStoreProductsSavingsSearchResultAsync',
        variables: {
          skip: 0, take: 1000, source: 'WEB_WEEKLYAD_MODAL',
          sortOrder: 'salesRank asc', minMatch: 0, segmentVarIndex: 0,
          getOrderHistory: false, intents: [], isPreviewSite: false,
          reorderItemCodes: null, wildcardSearch: false,
          filterQuery, keyword: '', boostBuryQuery: '', elevatedProducts: [],
          forceElevation: false, boostVarIndex: 0, searchRetryIndex: 0,
          intentVarIndex: 1, userCoupon: null, searchVariation: [],
        },
        query: PUBLIX_GQL,
      }),
    });

    if (!res.ok) { console.error('[Publix Bridge] Publix returned', res.status); return; }

    const data = await res.json();
    const saleItems = (data.data?.storeProductsSavingsSearchResult?.storeProducts || [])
      .filter(p => p.onSale && p.title);

    await chrome.storage.local.set({ publixSaleItems: saleItems, publixSaleTs: Date.now() });
    console.log('[Publix Bridge] Cached', saleItems.length, 'sale items from', new Date().toLocaleTimeString());
  } catch (e) {
    console.error('[Publix Bridge] Error fetching sale data:', e);
  }
}
