const path = require('path');
const fs = require('fs');
const { fetchDeals } = require('./poller');
const { postDealToDiscord } = require('./discord');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const STATE_PATH = path.join(__dirname, '..', 'data', 'state.json');

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    // Migrate from the old single-route format: { seenIds: [...] }
    if (Array.isArray(raw.seenIds)) {
      return { 'all-deals': { seenIds: raw.seenIds } };
    }
    return raw;
  } catch (e) {
    return {};
  }
}

function matchesFilter(deal, categoryFilter) {
  if (!categoryFilter || categoryFilter.length === 0) return true;
  return deal.categories.some((c) => categoryFilter.includes(c));
}

async function processRoute(route, state) {
  const webhookUrl = process.env[route.webhookEnv];
  if (!webhookUrl) {
    console.error(`[${route.name}] ${route.webhookEnv} is not set - skipping this route.`);
    return false;
  }

  const isFirstRunEver = !state[route.name];
  const seenIds = new Set(state[route.name]?.seenIds || []);

  const deals = await fetchDeals(route.feedUrl);
  const newDeals = deals.filter((d) => !seenIds.has(d.id));
  for (const deal of deals) seenIds.add(deal.id);

  if (isFirstRunEver) {
    console.log(`[${route.name}] First run - baselining ${deals.length} existing deals, posting nothing.`);
  } else {
    const toPost = newDeals.filter((d) => matchesFilter(d, route.categoryFilter));
    console.log(`[${route.name}] ${newDeals.length} new deal(s), ${toPost.length} match the category filter.`);
    for (const deal of toPost) {
      console.log(`[${route.name}] Posting: ${deal.title}`);
      await postDealToDiscord(webhookUrl, deal);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  state[route.name] = { seenIds: Array.from(seenIds) };
  return true;
}

async function main() {
  const state = loadState();

  for (const route of config.routes) {
    await processRoute(route, state);
  }

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
