const { fetchDeals } = require('./poller');
const { searchCollection, fetchCollectionProducts, fetchCatalogProducts } = require('./shopify');

function matchesFilter(deal, categoryFilter) {
  if (!categoryFilter || categoryFilter.length === 0) return true;
  return deal.categories.some((c) => categoryFilter.includes(c));
}

function normalizeStockItem(item, sourceLabel) {
  return {
    id: item.variantId,
    title: `${item.productTitle}${item.variantTitle ? ` - ${item.variantTitle}` : ''} - $${item.price}`,
    link: item.url,
    image: item.image,
    sourceLabel,
    categories: [],
    votesPos: null,
    commentCount: null,
    creator: null,
    pubDate: null,
  };
}

async function pollRssRoute(route, state) {
  const isFirstRunEver = !state[route.name];
  const seenIds = new Set(state[route.name]?.seenIds || []);

  const deals = await fetchDeals(route.feedUrl);
  const newDeals = deals.filter((d) => !seenIds.has(d.id));
  for (const d of deals) seenIds.add(d.id);

  state[route.name] = { seenIds: Array.from(seenIds) };

  return {
    justDiscovered: false,
    allItems: deals,
    newItems: isFirstRunEver ? [] : newDeals.filter((d) => matchesFilter(d, route.categoryFilter)),
  };
}

async function pollShopifyCollectionRoute(route, state) {
  const prior = state[route.name] || {
    collectionHandle: route.collectionHandle || null,
    variants: {},
  };

  let justDiscovered = false;

  if (!prior.collectionHandle) {
    const found = await searchCollection(route.domain, route.searchQuery || route.name);
    if (!found) {
      state[route.name] = prior;
      return { justDiscovered: false, allItems: [], newItems: [] };
    }
    prior.collectionHandle = found.handle;
    justDiscovered = true;
  }

  const items = await fetchCollectionProducts(route.domain, prior.collectionHandle);
  const newlyAvailable = [];

  for (const item of items) {
    const was = prior.variants[item.variantId];
    if (item.available && (!was || !was.available)) {
      newlyAvailable.push(normalizeStockItem(item, route.sourceLabel || 'JB Hi-Fi'));
    }
    prior.variants[item.variantId] = { available: item.available };
  }

  state[route.name] = prior;

  return {
    justDiscovered,
    collectionHandle: prior.collectionHandle,
    allItems: items,
    newItems: newlyAvailable,
  };
}

// Scans the entire storefront catalog for Pokemon TCG products, self-throttled
// to scanIntervalMinutes regardless of how often the workflow itself runs -
// pagination-heavy (hundreds of requests for a large store), so it shouldn't
// run on every fast-loop cycle like the other route types.
async function pollShopifyCatalogScanRoute(route, state) {
  const prior = state[route.name] || { variants: {}, lastScanAt: null };
  const intervalMs = (route.scanIntervalMinutes || 30) * 60 * 1000;

  if (prior.lastScanAt && Date.now() - new Date(prior.lastScanAt).getTime() < intervalMs) {
    return { justDiscovered: false, allItems: [], newItems: [], skipped: true };
  }

  const items = await fetchCatalogProducts(route.domain, { maxPages: route.maxPages });
  const newlyAvailable = [];

  for (const item of items) {
    const was = prior.variants[item.variantId];
    if (item.available && (!was || !was.available)) {
      newlyAvailable.push(normalizeStockItem(item, route.sourceLabel || route.domain));
    }
    prior.variants[item.variantId] = { available: item.available };
  }

  prior.lastScanAt = new Date().toISOString();
  state[route.name] = prior;

  return { justDiscovered: false, allItems: items, newItems: newlyAvailable };
}

async function pollRoute(route, state) {
  if (route.type === 'shopify-collection') {
    return pollShopifyCollectionRoute(route, state);
  }
  if (route.type === 'shopify-catalog-scan') {
    return pollShopifyCatalogScanRoute(route, state);
  }
  return pollRssRoute(route, state);
}

module.exports = { pollRoute };
