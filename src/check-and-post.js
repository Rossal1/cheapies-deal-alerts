const path = require('path');
const fs = require('fs');
const { fetchDeals } = require('./poller');
const { postDealToDiscord } = require('./discord');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const STATE_PATH = path.join(__dirname, '..', 'data', 'state.json');
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  console.error('DISCORD_WEBHOOK_URL env var is not set.');
  process.exit(1);
}

function matchesFilter(deal) {
  if (!config.categoryFilter || config.categoryFilter.length === 0) return true;
  return deal.categories.some((c) => config.categoryFilter.includes(c));
}

async function main() {
  let seenIds = new Set();
  let isFirstRunEver = true;
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    seenIds = new Set(saved.seenIds || []);
    isFirstRunEver = false;
  } catch (e) {
    // no prior state - this run will just baseline without posting
  }

  const deals = await fetchDeals(config.feedUrl);
  const newDeals = deals.filter((d) => !seenIds.has(d.id));

  for (const deal of deals) seenIds.add(deal.id);

  if (isFirstRunEver) {
    console.log(`First run - baselining ${deals.length} existing deals, posting nothing.`);
  } else {
    const toPost = newDeals.filter(matchesFilter);
    console.log(`${newDeals.length} new deal(s), ${toPost.length} match the category filter.`);
    for (const deal of toPost) {
      console.log(`Posting: ${deal.title}`);
      await postDealToDiscord(webhookUrl, deal);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({ seenIds: Array.from(seenIds) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
