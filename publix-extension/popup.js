const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

chrome.storage.local.get(['publixSaleItems', 'publixSaleTs'], (data) => {
  const el  = document.getElementById('status');
  const age = document.getElementById('age');

  if (!data.publixSaleItems?.length) {
    el.className    = 'status none';
    el.textContent  = 'No sale data yet.';
    age.textContent = 'Visit publix.com/savings/weekly-ad to capture it.';
    return;
  }

  const ms      = Date.now() - (data.publixSaleTs || 0);
  const minutes = Math.floor(ms / 60000);
  const hours   = Math.floor(minutes / 60);
  const label   = hours > 0 ? `${hours}h ${minutes % 60}m ago` : `${minutes}m ago`;
  const count   = data.publixSaleItems.length;

  if (ms < TWENTY_FOUR_HOURS) {
    el.className   = 'status ok';
    el.textContent = `✓ ${count} sale items cached`;
  } else {
    el.className   = 'status warn';
    el.textContent = `⚠ Data may be stale (${count} items)`;
  }
  age.textContent = `Captured ${label} — revisit publix.com to refresh.`;
});
