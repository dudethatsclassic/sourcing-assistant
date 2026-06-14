// Fires whenever a storeproductssavings request completes on Publix.
// We grab all publix.com cookies (including HttpOnly) via the cookies API
// and save them to chrome.storage.local for the content script to inject.

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    try {
      const cookies = await chrome.cookies.getAll({ domain: '.publix.com' });
      if (!cookies.length) return;

      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      await chrome.storage.local.set({
        publixCookie: cookieStr,
        publixCookieTs: Date.now(),
      });
    } catch (e) {
      console.error('[Publix Bridge] Failed to capture cookie:', e);
    }
  },
  { urls: ['https://services.publix.com/search/api/search/storeproductssavings/*'] }
);
