const path = require('path');
const fs = require('fs');
const { pollRoute } = require('./routes');
const { postDealToDiscord, postAnnouncementToDiscord } = require('./discord');

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

async function main() {
  const state = loadState();

  for (const route of config.routes) {
    const webhookUrl = process.env[route.webhookEnv];
    if (!webhookUrl) {
      console.error(`[${route.name}] ${route.webhookEnv} is not set - skipping this route.`);
      continue;
    }

    try {
      const result = await pollRoute(route, state);

      if (result.justDiscovered) {
        console.log(`[${route.name}] Collection discovered: ${result.collectionHandle}`);
        await postAnnouncementToDiscord(
          webhookUrl,
          `**${route.name}** is now listed on ${route.domain}! Watching for stock: https://${route.domain}/collections/${result.collectionHandle}`
        );
        await new Promise((r) => setTimeout(r, 1500));
      }

      console.log(`[${route.name}] ${result.newItems.length} new item(s).`);
      for (const item of result.newItems) {
        console.log(`[${route.name}] Posting: ${item.title}`);
        await postDealToDiscord(webhookUrl, item);
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(`[${route.name}] failed:`, err.message);
    }
  }

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
