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

Both route types share the same webhook/embed posting and the same GitHub Actions run loop.

**Important caveat**: this only covers retailers whose sites don't actively block automated requests. The Warehouse and Kmart NZ both run enterprise bot-detection (Cloudflare / Akamai) that blocks headless browsers outright - there's no route type here for them, and building one would mean deliberately evading a security control, which this project intentionally doesn't do. JB Hi-Fi works because Shopify's storefront JSON is public by design.

## GitHub Actions setup

1. Create a Discord webhook per route (Server Settings → Integrations → Webhooks → New Webhook → Copy URL).
2. Add each as a repo secret matching its route's `webhookEnv`: `gh secret set DISCORD_WEBHOOK_URL_DELTA_REIGN` (or Settings → Secrets and variables → Actions).
3. Add the secret's name to the `env:` block in `.github/workflows/check-deals.yml` if it's a new one.
4. That's it - the workflow checks every route, posts anything new to that route's channel, and commits the updated `data/state.json` back so it doesn't repost. A route whose secret isn't set yet is skipped with a warning rather than failing the whole run.

Trigger a manual run any time from the Actions tab, or `gh workflow run check-deals.yml`.
