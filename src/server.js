const express = require('express');
const path = require('path');
const fs = require('fs');
const { fetchDeals } = require('./poller');
const { notifyDeal } = require('./notifier');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const STATE_PATH = path.join(__dirname, '..', 'data', 'state.json');

let seenIds = new Set();
let firstPollDone = false;
try {
  const saved = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  seenIds = new Set(saved.seenIds || []);
  firstPollDone = true;
} catch (e) {
  // no prior state, first run will just baseline
}

let latestDeals = [];
let events = [];
let lastPollAt = null;
let lastError = null;
let polling = false;

function saveState() {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ seenIds: Array.from(seenIds) }, null, 2));
}

function matchesFilter(deal) {
  if (!config.categoryFilter || config.categoryFilter.length === 0) return true;
  return deal.categories.some((c) => config.categoryFilter.includes(c));
}

async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const deals = await fetchDeals(config.feedUrl);
    latestDeals = deals;

    for (const deal of deals) {
      if (!seenIds.has(deal.id)) {
        seenIds.add(deal.id);
        if (firstPollDone && matchesFilter(deal)) {
          events.unshift({ ...deal, detectedAt: new Date().toISOString() });
          events = events.slice(0, 100);
          notifyDeal(deal);
        }
      }
    }
    firstPollDone = true;
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
    categoryFilter: config.categoryFilter,
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
