// Runs on the sourcing assistant page at document_start.
// Reads the captured Publix cookie from extension storage and writes it
// into the page's localStorage so fetchPublixSaleData finds it automatically.

const TWO_HOURS = 2 * 60 * 60 * 1000;

chrome.storage.local.get(['publixCookie', 'publixCookieTs'], (data) => {
  if (!data.publixCookie) return;
  const age = Date.now() - (data.publixCookieTs || 0);
  if (age > TWO_HOURS) return; // stale — let the app show the error toast
  localStorage.setItem('sourcing_publix_token', data.publixCookie);
});
