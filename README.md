# cheapies-deal-alerts

Watches cheapies.nz deal feeds and JB Hi-Fi's live stock for Pokemon TCG sets, routing alerts to Discord channels.

Two ways to run it:

- **Local dashboard** (`npm start`): runs a small web dashboard at `http://localhost:4174` and fires a native desktop notification when something new appears. Only runs while your machine is on.
- **GitHub Actions** (`.github/workflows/check-deals.yml`): a scheduled run kicks off every 5 minutes (GitHub's minimum interval for the *trigger*), but each run then loops internally, re-checking every 20 seconds for ~4.5 minutes before handing off to the next scheduled run - so the effective latency is ~20-30s, not 5 minutes. Runs even when your machine is off, and posts to Discord via webhook.

## Routes

Each entry in `config.json`'s `routes` array is one source → one Discord channel. Two route types:

**`rss`** - watches a cheapies.nz RSS feed for new posts (community-submitted deals, not live stock):

```json
{
  "name": "jb-hi-fi",
  "type": "rss",
  "feedUrl": "https://www.cheapies.nz/deals/jbhifi.co.nz/feed",
  "webhookEnv": "DISCORD_WEBHOOK_URL_JBHIFI",
  "categoryFilter": []
}
```

- `feedUrl` - cheapies.nz publishes per-retailer feeds at `cheapies.nz/deals/<retailer-domain>/feed`, as well as the front-page feed at `cheapies.nz/feed`.
- `categoryFilter` - array of category names to further narrow a route (e.g. `["Gaming"]`). Empty = everything from that feed.

**`shopify-collection`** - watches a JB Hi-Fi product collection for real stock availability (variant `available: true/false`), using their public Shopify storefront JSON - no scraping, no bot-wall:

```json
{
  "name": "delta-reign",
  "type": "shopify-collection",
  "domain": "jbhifi.co.nz",
  "searchQuery": "delta reign",
  "webhookEnv": "DISCORD_WEBHOOK_URL_DELTA_REIGN"
}
```

- `searchQuery` - used to auto-discover the collection once JB Hi-Fi lists it (there's no way to know the exact collection URL for a set before the retailer publishes it). Every run searches for this until a matching collection is found; once found, the handle is saved to `data/state.json` and reused directly. The moment it's discovered, an announcement posts to the channel and every currently-listed item is posted as "available now" - after that, only new stock (a product going from unavailable to available, or a brand-new SKU appearing in the collection) triggers a post.
- `collectionHandle` - optional; set this directly (e.g. `"all"` or a known handle) to skip discovery and watch a specific collection immediately.

**`shopify-catalog-scan`** - pages through a Shopify store's *entire* product catalog, filtering to Pokemon TCG products (via `isPokemonTcgProduct` in `shopify.js` - matches "Pokemon" plus a TCG-specific signal like "booster"/"elite trainer"/"trading card", so it excludes general Pokemon merch like plush toys or watches that share the same vendor tag on some stores) and watching every matching variant for `available` flips:

```json
{
  "name": "jb-hi-fi-pokemon-stock",
  "type": "shopify-catalog-scan",
  "domain": "jbhifi.co.nz",
  "sourceLabel": "JB Hi-Fi",
  "scanIntervalMinutes": 30,
  "webhookEnv": "DISCORD_WEBHOOK_URL_SHOPIFY_ALERTS"
}
```

- This is the "catch everything, not just named sets" route type - unlike `shopify-collection`, it doesn't need to know a set name in advance.
- It's pagination-heavy (JB Hi-Fi's catalog is 100+ pages), so it self-throttles to `scanIntervalMinutes` (default 30) regardless of how often the workflow runs - most invocations just check the clock and skip instantly.
- **Known limitation**: Shopify's legacy `/products.json` endpoint hard-caps pagination around page 100 (~25,000 products) and returns an error beyond that, which this code treats as "reached the edge of what's reachable" rather than a failure. For a catalog that size, this isn't provably complete coverage - a product could in principle sort beyond page 100 and be missed. In testing it did find every known current Pokemon TCG product at JB Hi-Fi, which is a reasonable but not ironclad signal.

All three route types share the same webhook/embed posting and the same GitHub Actions run loop.

**Important caveat**: this only covers retailers whose sites don't actively block automated requests. The Warehouse, Kmart NZ, Mighty Ape, and EB Games NZ all run enterprise bot-detection (Cloudflare / Akamai / DataDome) that blocks automated requests outright - there's no route type here for them, and building one would mean deliberately evading a security control, which this project intentionally doesn't do. JB Hi-Fi and Toyworld work because Shopify's storefront JSON is public by design - nothing to get past.

## GitHub Actions setup

1. Create a Discord webhook per route (Server Settings → Integrations → Webhooks → New Webhook → Copy URL).
2. Add each as a repo secret matching its route's `webhookEnv`: `gh secret set DISCORD_WEBHOOK_URL_DELTA_REIGN` (or Settings → Secrets and variables → Actions).
3. Add the secret's name to the `env:` block in `.github/workflows/check-deals.yml` if it's a new one.
4. That's it - the workflow checks every route, posts anything new to that route's channel, and commits the updated `data/state.json` back so it doesn't repost. A route whose secret isn't set yet is skipped with a warning rather than failing the whole run.

Trigger a manual run any time from the Actions tab, or `gh workflow run check-deals.yml`.
