const express = require('express');
const path = require('path');
const fs = require('fs');
const { pollRoute } = require('./routes');
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

async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    for (const route of config.routes) {
      const result = await pollRoute(route, state);

      const displayItems = (result.allItems || []).map((d) => ({ ...d, route: route.name }));
      latestDeals = latestDeals.filter((d) => d.route !== route.name).concat(displayItems);

      for (const deal of result.newItems) {
        const event = { ...deal, route: route.name, detectedAt: new Date().toISOString() };
        events.unshift(event);
        events = events.slice(0, 100);
        notifyDeal(deal);
      }
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
    routes: config.routes.map((r) => ({ name: r.name, type: r.type })),
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
