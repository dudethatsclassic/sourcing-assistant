# SourceBuddy — Sourcing Assistant

Walmart WFS retail arbitrage sourcing assistant. Single `index.html` on GitHub Pages. No build step, no framework.

**Live URL:** https://dudethatsclassic.github.io/sourcing-assistant/  
**GitHub repo:** https://github.com/dudethatsclassic/sourcing-assistant  
**Local path:** `/Users/nsmith/Desktop/Claude Code/SourceBuddy/`

---

## Architecture

Everything lives in `index.html` — HTML, CSS, and JS in one file. Deployed via GitHub Pages from `main` branch.

Supporting files:
- `kroger-worker.js` — Cloudflare Worker source for the Kroger/HT CORS proxy
- `publix-worker.js` — Cloudflare Worker source for the Publix CORS proxy (fallback only)
- `publix-extension/` — Chrome Extension (Manifest V3) that auto-captures Publix sale data
- `images/` — Local product images named `{itemId}.jpg` or `{itemId}.png`
- `data/` — Auto-fetch files uploaded here for GitHub-based data loading

---

## Data Flow

### Inputs (three CSVs + one Google Sheet)
| Source | What it provides | How it gets in |
|--------|-----------------|----------------|
| Google Sheet | Item names, buy prices (col F = Cost), sell prices (col J = Sell Price), image URLs | Sheet URL pasted into app |
| WFS Inventory Health CSV | `currentStock`, `inbound` | Drag-drop or auto-load from `data/inventoryHealth.csv` on GitHub |
| Seller Center orders CSV/XLSX | Velocity (units/week) | Drag-drop or auto-load from `data/orders.xlsx` on GitHub |
| Sales Data Insights CSV (optional) | Long-term velocity (52-week) | Drag-drop or auto-load from `data/orders_history.csv` on GitHub |

### Auto-load from GitHub
The app checks `HEAD` on each of these on load; if they exist, the drop zones turn orange and the files load automatically without manual upload:
- `data/inventoryHealth.csv`
- `data/orders.xlsx`
- `data/orders_history.csv`

### Computed fields per item
- `weekly` — velocity (units/week). Uses higher of long-term vs 90-day to catch trending items
- `parLevel` = `ceil(weekly × weeksTarget)` (default 4 weeks)
- `suggestBuy` = `max(0, parLevel - currentStock - inbound)`
- `urgency` = `critical` (OOS), `low` (< 50% of par), or `ok`
- `avgCost` — average of all Cost column rows for that item ID
- `avgSell` — average of all Sell Price column rows for that item ID

### New item detection
An item is flagged "New" if its first sale is within 45 days of the most recent order AND its full sales history spans < 30 days. Velocity for new items uses `max(14, daysSinceFirstSale)` as the denominator to avoid inflating weekly rate from a small initial batch.

---

## Sale Data Integrations

### Flipp/Wishabi (no auth required)
- Covers: Lowe's Foods, Food Lion, Publix
- Postal code: `27410` (Greensboro, NC)
- API: `https://backflipp.wishabi.com/flipp/flyers?locale=en-US&postal_code=27410`
- Bidirectional name matching, threshold 0.60
- No credentials needed

### Kroger API → Harris Teeter (via Cloudflare Worker)
- Worker URL: `https://kroger-proxy.natescottsmith.workers.dev`
- HT location ID: `09700033` (Greensboro NC 27410)
- Searches top 40 HT-tagged items by velocity, batches of 5
- **Credentials stored in localStorage** (never in code):
  - `sourcing_kroger_id` — Kroger API client ID
  - `sourcing_kroger_sec` — Kroger API client secret
- Enter via ⚙️ Settings modal in the app

### Publix (via Chrome Extension — preferred path)
- Extension name: "Publix Cookie Bridge" (Manifest V3)
- Extension folder: `publix-extension/`
- **How it works:**
  1. User visits `publix.com/savings/weekly-ad`
  2. `background.js` intercepts the `storeproductssavings` POST request, extracts `filterQuery` from the request body
  3. Sends `FETCH_PUBLIX_SALES` message to `publix-page-content.js` content script
  4. Content script makes the same fetch with `credentials: 'include'` (uses the page's full cookie jar including HttpOnly Akamai cookies)
  5. Results sent back to background, cached in `chrome.storage.local` as `{ publixSaleItems, publixSaleTs }`
  6. `content.js` on the sourcing assistant page reads the cache and writes to `localStorage` as `sourcing_publix_data`
- App reads `sourcing_publix_data` first (24h TTL); falls back to Cloudflare Worker if no extension data
- **filterQuery changes every Wednesday** when Publix's weekly ad resets — visiting the weekly ad page with the extension installed auto-captures the new filterQuery
- Store ID: `1658`
- **Fallback (manual):** Paste Cookie string + filterQuery in ⚙️ Settings; stored as:
  - `sourcing_publix_token` — full browser Cookie string
  - `sourcing_publix_filter` — filterQuery (format: `promoGroupId::XXXXXX-0||promoGroupId::XXXXXX-0||...`)
- Publix proxy Worker URL: `https://publix-proxy.natescottsmith.workers.dev`
- **Akamai note:** Publix uses Akamai bot detection that ties session cookies to browser IP. The extension works because the fetch runs in the page context (same IP as the browser). The Cloudflare Worker fallback may get 403s because Cloudflare IPs are datacenter IPs.

---

## Persistence

### JSONBin (cross-device sync)
- Bin ID: `6a1c7f3cddf5aa59f77c95a9`
- API key in code (read/write)
- Stores: `storeTags`, `archived`, `purchases`, `manualSales`, `shipment`
- `storeTags` format: `{ itemId: ["Store Name", ...] }`
- `manualSales` format: `{ itemId: { stores: string[], expiresMs: number } }` — 7-day expiry

### localStorage (browser-only, sensitive data)
- `sourcing_kroger_id` / `sourcing_kroger_sec` — Kroger API credentials
- `sourcing_publix_token` — Publix cookie string (manual fallback)
- `sourcing_publix_filter` — Publix filterQuery (manual fallback)
- `sourcing_publix_data` — `{ items, ts }` — extension-cached sale items (24h TTL)
- App preferences (sheet URL, weeks target, view mode, sort, store filter)

---

## Key Features

- **Cards + List view** — toggle between grid cards and compact list rows
- **Stat pills** — Total SKUs, Units to Buy, Out of Stock, Running Low — clickable to filter; active pill highlighted
- **Store filter chips** — filter by store tag; "On Sale" chip shows only items with detected sales
- **Shopping mode** — enter per-store buying view with checkboxes and qty adjust; copy to clipboard
- **Sale badges** — auto-detected (Flipp/Kroger/Publix) + manual override per store
- **Archive/hide** — hide SKUs from main view without deleting
- **Mark as bought** — track which OOS/low items you've already purchased this run
- **Shipment inbound** — upload shipment CSVs to add in-transit units not yet checked in to WFS
- **Progressive image loading** — checks `images/{itemId}.jpg` then `images/{itemId}.png` locally; shows 📦 placeholder if not found (no external proxy)
- **Search** — live search box filters by name or item ID
- **Sort options** — Lowest Stock, Most to Buy, Fastest Moving, Name A–Z
- **Export CSV** — exports current view

---

## Cloudflare Workers

Both workers are deployed to `natescottsmith.workers.dev`:

**kroger-worker.js** — Kroger OAuth proxy
- Fetches Kroger OAuth token, proxies product search requests
- Adds CORS headers for GitHub Pages origin

**publix-worker.js** — Publix fallback proxy
- Passes `X-Publix-Store` and `X-Publix-Token` (cookie string) to Publix API
- Only used when extension isn't installed or cache is stale

---

## Google Sheet Column Detection

The app auto-detects these column headers (case-insensitive):
| Data | Column headers it looks for |
|------|-----------------------------|
| Item ID | `Item ID` (exact, triggers header row detection) |
| Name | `item`, `product name`, `product`, `name`, `title` |
| Cost (buy price) | `cost`, `price`, `buy price`, `purchase price` |
| Sell Price | `sell price`, `walmart price`, `list price`, `msrp`, `retail`, `retail price`, `wmt price` |
| Image URL | `image url`, `image`, `img`, `photo` |
| Qty (skip >1) | `qty`, `quantity` |

Multiple rows for the same Item ID are averaged (avgCost, avgSell).

---

## Pending / Known Issues

- **Publix filterQuery** — must visit `publix.com/savings/weekly-ad` each Wednesday to auto-refresh via extension. No automatic weekly reminder.
- **Publix Akamai** — if home IP gets flagged (happens with rapid repeated failed requests), publix.com shows "Access Denied." Resolves naturally in ~24h without clearing cookies.
- **WFS fees not factored in** — avgCost and avgSell are shown on cards but no margin/profit calculation is done (WFS referral %, fulfillment fees, taxes not accounted for).

---

## Git Workflow

```bash
cd "/Users/nsmith/Desktop/Claude Code/SourceBuddy"
git add index.html
git commit -m "message"
git push
# GitHub Pages deploys automatically — allow ~1 min
```

If push is rejected (remote ahead):
```bash
git fetch origin && git rebase origin/main && git push
```
