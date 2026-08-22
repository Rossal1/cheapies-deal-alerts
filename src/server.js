const express = require('express');
const path = require('path');
const fs = require('fs');
const { fetchDeals } = require('./poller');
const { notifyDeal } = require('./notifier');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const STATE_PATH = path.join(__dirname, '..', 'data', 'state.json');

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if (Array.isArray(raw.seenIds)) {
      return { 'all-deals': { seenIds: raw.seenIds } };
    }
    return raw;
  } catch (e) {
    return {};
  }
}

const state = loadState();

let latestDeals = [];
let events = [];
let lastPollAt = null;
let lastError = null;
let polling = false;

function saveState() {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function matchesFilter(deal, categoryFilter) {
  if (!categoryFilter || categoryFilter.length === 0) return true;
  return deal.categories.some((c) => categoryFilter.includes(c));
}

async function pollRoute(route) {
  const isFirstRunEver = !state[route.name];
  const seenIds = new Set(state[route.name]?.seenIds || []);

  const deals = await fetchDeals(route.feedUrl);
  const newDeals = deals.filter((d) => !seenIds.has(d.id));
  for (const deal of deals) seenIds.add(deal.id);

  latestDeals = latestDeals
    .filter((d) => d.route !== route.name)
    .concat(deals.map((d) => ({ ...d, route: route.name })));

  if (!isFirstRunEver) {
    for (const deal of newDeals) {
      if (matchesFilter(deal, route.categoryFilter)) {
        const event = { ...deal, route: route.name, detectedAt: new Date().toISOString() };
        events.unshift(event);
        events = events.slice(0, 100);
        notifyDeal(deal);
      }
    }
  }

  state[route.name] = { seenIds: Array.from(seenIds) };
}

async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    for (const route of config.routes) {
      await pollRoute(route);
    }
    lastError = null;
    saveState();
  } catch (err) {
    lastError = err.message;
    console.error('Poll failed:', err);
  } finally {
    lastPollAt = new Date().toISOString();
    polling = false;
  }
}

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    deals: latestDeals,
    events,
    lastPollAt,
    lastError,
    pollIntervalSeconds: config.pollIntervalSeconds,
    routes: config.routes.map((r) => ({ name: r.name, categoryFilter: r.categoryFilter })),
  });
});

app.post('/api/poll-now', async (req, res) => {
  await pollOnce();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4174;
app.listen(PORT, () => {
  console.log(`Dashboard: http://localhost:${PORT}`);
  pollOnce();
  setInterval(pollOnce, config.pollIntervalSeconds * 1000);
});
