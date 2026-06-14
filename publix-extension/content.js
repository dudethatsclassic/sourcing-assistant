// Runs on the sourcing assistant page at document_start.
// Reads pre-fetched Publix sale items from extension storage and writes
// them into the page's localStorage so fetchPublixSaleData uses them
// instead of calling the Cloudflare Worker.

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

chrome.storage.local.get(['publixSaleItems', 'publixSaleTs'], (data) => {
  if (!data.publixSaleItems?.length) return;
  const age = Date.now() - (data.publixSaleTs || 0);
  if (age > TWENTY_FOUR_HOURS) return;

  localStorage.setItem('sourcing_publix_data', JSON.stringify({
    items: data.publixSaleItems,
    ts:    data.publixSaleTs,
  }));
});
