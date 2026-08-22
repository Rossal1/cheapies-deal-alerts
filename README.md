# cheapies-deal-alerts

Watches [cheapies.nz](https://www.cheapies.nz)'s official RSS feed (`/feed`) for new deals.

Two ways to run it:

- **Local dashboard** (`npm start`): runs a small web dashboard at `http://localhost:4174` and fires a native desktop notification when a new deal appears. Only runs while your machine is on.
- **GitHub Actions** (`.github/workflows/check-deals.yml`): a scheduled run kicks off every 5 minutes (GitHub's minimum interval for the *trigger*), but each run then loops internally, re-checking the feed every 20 seconds for ~4.5 minutes before handing off to the next scheduled run - so the effective latency is ~20-30s, not 5 minutes. Runs even when your machine is off, and posts new deals to a Discord channel via webhook.

## GitHub Actions setup

1. Create a Discord webhook (Server Settings → Integrations → Webhooks → New Webhook → Copy URL).
2. Add it as a repo secret: `gh secret set DISCORD_WEBHOOK_URL` (or Settings → Secrets and variables → Actions).
3. That's it - the scheduled workflow checks the feed, posts anything new as a Discord embed, and commits the updated `data/state.json` back so it doesn't repost on the next run.

Trigger a manual run any time from the Actions tab, or `gh workflow run check-deals.yml`.

## Config

`config.json`:
- `feedUrl` - the RSS feed to poll.
- `pollIntervalSeconds` - used by the local dashboard only (the Actions schedule is set in the workflow file).
- `categoryFilter` - array of category names to restrict alerts to (e.g. `["Gaming"]`). Empty = all deals.
