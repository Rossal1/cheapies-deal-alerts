# cheapies-deal-alerts

Watches [cheapies.nz](https://www.cheapies.nz) RSS feeds for new deals and routes them to Discord channels.

Two ways to run it:

- **Local dashboard** (`npm start`): runs a small web dashboard at `http://localhost:4174` and fires a native desktop notification when a new deal appears. Only runs while your machine is on.
- **GitHub Actions** (`.github/workflows/check-deals.yml`): a scheduled run kicks off every 5 minutes (GitHub's minimum interval for the *trigger*), but each run then loops internally, re-checking every 20 seconds for ~4.5 minutes before handing off to the next scheduled run - so the effective latency is ~20-30s, not 5 minutes. Runs even when your machine is off, and posts new deals to Discord via webhook.

## Routes

Each entry in `config.json`'s `routes` array is one feed → one Discord channel:

```json
{
  "name": "jb-hi-fi",
  "feedUrl": "https://www.cheapies.nz/deals/jbhifi.co.nz/feed",
  "webhookEnv": "DISCORD_WEBHOOK_URL_JBHIFI",
  "categoryFilter": []
}
```

- `feedUrl` - cheapies.nz publishes per-retailer feeds at `cheapies.nz/deals/<retailer-domain>/feed` (found via the site's tag pages), as well as the front-page feed at `cheapies.nz/feed`.
- `webhookEnv` - the name of the GitHub secret (and local env var) holding that route's Discord webhook URL. Each route needs its own secret.
- `categoryFilter` - array of category names to further narrow a route (e.g. `["Gaming"]`). Empty = everything from that feed.

To add a new retailer channel: find its per-retailer feed URL on cheapies.nz, add a route entry, create a Discord webhook for the new channel, and add it as a secret under the name given in `webhookEnv`.

## GitHub Actions setup

1. Create a Discord webhook per route (Server Settings → Integrations → Webhooks → New Webhook → Copy URL).
2. Add each as a repo secret matching its route's `webhookEnv`: `gh secret set DISCORD_WEBHOOK_URL_JBHIFI` (or Settings → Secrets and variables → Actions).
3. Add the secret's name to the `env:` block in `.github/workflows/check-deals.yml` if it's a new one.
4. That's it - the workflow checks every route's feed, posts anything new as a Discord embed to that route's channel, and commits the updated `data/state.json` back so it doesn't repost. A route whose secret isn't set yet is skipped with a warning rather than failing the whole run.

Trigger a manual run any time from the Actions tab, or `gh workflow run check-deals.yml`.
