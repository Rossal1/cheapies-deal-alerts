const { fetchDeals } = require('./poller');
const { searchCollection, fetchCollectionProducts } = require('./shopify');

function matchesFilter(deal, categoryFilter) {
  if (!categoryFilter || categoryFilter.length === 0) return true;
  return deal.categories.some((c) => categoryFilter.includes(c));
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
      newlyAvailable.push({
        id: item.variantId,
        title: `${item.productTitle}${item.variantTitle ? ` - ${item.variantTitle}` : ''} - $${item.price}`,
        link: item.url,
        image: item.image,
        sourceLabel: 'JB Hi-Fi',
        categories: [],
        votesPos: null,
        commentCount: null,
        creator: null,
        pubDate: null,
      });
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

async function pollRoute(route, state) {
  if (route.type === 'shopify-collection') {
    return pollShopifyCollectionRoute(route, state);
  }
  return pollRssRoute(route, state);
}

module.exports = { pollRoute };
