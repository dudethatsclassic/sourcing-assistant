const TWO_HOURS = 2 * 60 * 60 * 1000;

chrome.storage.local.get(['publixCookie', 'publixCookieTs'], (data) => {
  const el  = document.getElementById('status');
  const age = document.getElementById('age');

  if (!data.publixCookie) {
    el.className = 'status none';
    el.textContent = 'No cookie captured yet.';
    age.textContent = 'Visit publix.com/savings/weekly-ad to capture one.';
    return;
  }

  const ms      = Date.now() - (data.publixCookieTs || 0);
  const minutes = Math.floor(ms / 60000);
  const hours   = Math.floor(minutes / 60);
  const label   = hours > 0 ? `${hours}h ${minutes % 60}m ago` : `${minutes}m ago`;

  if (ms < TWO_HOURS) {
    el.className = 'status ok';
    el.textContent = '✓ Cookie is fresh';
  } else {
    el.className = 'status warn';
    el.textContent = '⚠ Cookie may be stale';
  }
  age.textContent = `Captured ${label} — visit publix.com to refresh.`;
});
