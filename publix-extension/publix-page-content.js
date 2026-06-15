// Runs on www.publix.com. Receives the filterQuery from background.js and makes
// the storeproductssavings fetch using the page's cookie jar (credentials:'include'),
// which includes HttpOnly Akamai cookies that the background worker can't access.

const PUBLIX_API = 'https://services.publix.com/search/api/search/storeproductssavings/';
const STORE_ID   = '1658';
const PUBLIX_GQL = `query GetStoreProductsSavingsSearchResultAsync($keyword: String, $skip: Int!, $take: Int!, $facetOverrideStr: String, $facets: String, $sortOrder: String, $ispu: Boolean, $categoryID: String, $minMatch: Int!, $boostVarIndex: Int!, $wildcardSearch: Boolean!, $isPreviewSite: Boolean!, $segmentVarIndex: Int!, $getOrderHistory: Boolean!, $filterQuery: String, $reorderItemCodes: [Int!], $intents: [String!], $searchRetryIndex: Int!, $intentVarIndex: Int!, $boostBuryQuery: String, $source: String, $elevatedProducts: [KeyValuePairOfStringAndStringInput!], $couponId: String, $forceElevation: Boolean, $searchVariation: [KeyValuePairOfStringAndStringInput!], $userCoupon: String) { storeProductsSavingsSearchResult( keyword: $keyword skip: $skip take: $take facetOverrideStr: $facetOverrideStr facets: $facets sortOrder: $sortOrder ispu: $ispu categoryID: $categoryID minMatch: $minMatch boostVarIndex: $boostVarIndex wildcardSearch: $wildcardSearch isPreviewSite: $isPreviewSite segmentVarIndex: $segmentVarIndex getOrderHistory: $getOrderHistory filterQuery: $filterQuery reorderItemCodes: $reorderItemCodes intents: $intents boostBuryQuery: $boostBuryQuery searchRetryIndex: $searchRetryIndex intentVarIndex: $intentVarIndex source: $source elevatedProducts: $elevatedProducts couponId: $couponId forceElevation: $forceElevation searchVariation: $searchVariation userCoupon: $userCoupon ) { storeProducts { title titleBrand sizeDescription onSale priceLine promoMsg promoType promoValidThruMsg promoTotalSavings } totalCount } }`;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'FETCH_PUBLIX_SALES') return;
  fetchSaleItems(msg.filterQuery);
});

async function fetchSaleItems(filterQuery) {
  try {
    const res = await fetch(PUBLIX_API, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Publixstore':     STORE_ID,
        'X-Src':           'WEB_WEEKLYAD_MODAL',
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

    console.log('[Publix Bridge] Fetched', saleItems.length, 'sale items via page context');
    chrome.runtime.sendMessage({ type: 'PUBLIX_SALE_ITEMS', items: saleItems });
  } catch (e) {
    console.error('[Publix Bridge] Fetch error:', e);
  }
}
