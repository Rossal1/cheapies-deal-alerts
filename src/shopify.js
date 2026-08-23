const UA = 'cheapies-deal-alerts/0.1 (personal stock watcher)';

function productToVariants(domain, p) {
  return (p.variants || []).map((v) => ({
    variantId: String(v.id),
    productTitle: p.title,
    variantTitle: v.title && v.title !== 'Default Title' ? v.title : null,
    price: v.price,
    available: !!v.available,
    url: `https://${domain}/products/${p.handle}`,
    image: p.images?.[0]?.src || null,
  }));
}

async function searchCollection(domain, query) {
  const url = `https://${domain}/search/suggest.json?q=${encodeURIComponent(query)}&resources%5Btype%5D=collection&resources%5Blimit%5D=5`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Collection search failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const collections = data?.resources?.results?.collections || [];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  return (
    collections.find((c) => {
      const hay = `${c.handle} ${c.title}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }) || null
  );
}

async function fetchCollectionProducts(domain, handle) {
  const url = `https://${domain}/collections/${handle}/products.json?limit=250`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Collection fetch failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const items = [];
  for (const p of data.products || []) {
    items.push(...productToVariants(domain, p));
  }
  return items;
}

// Deliberately narrow: catches core TCG products (boosters, ETBs, battle decks,
// premium collections, blisters, tins) while excluding general Pokemon
// merchandise (plush, figures, watches, activity sets) that shares the same
// "Pokemon" vendor tag on some stores.
function isPokemonTcgProduct(p) {
  const vendor = (p.vendor || '').toLowerCase();
  const type = (p.product_type || '').toLowerCase();
  const title = (p.title || '').toLowerCase();
  const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : String(p.tags || '').toLowerCase();
  const haystack = `${vendor} ${type} ${title} ${tags}`;

  const pokemonSignal = /pok[eé]mon/;
  const tcgSignal =
    /trading card|\btcg\b|booster|elite trainer|battle deck|premium collection|blister|mini tin|deck box|tournament folio|booster bundle/;

  return pokemonSignal.test(haystack) && tcgSignal.test(haystack);
}

async function fetchJsonWithRetry(url, { retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 && attempt < retries) {
      const retryAfterSec = Number(res.headers.get('retry-after')) || 3 * (attempt + 1);
      await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText} (${url})`);
    return res.json();
  }
}

async function fetchCatalogProducts(domain, { maxPages = 150, isMatch = isPokemonTcgProduct, pageDelayMs = 400 } = {}) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await new Promise((r) => setTimeout(r, pageDelayMs));

    let data;
    try {
      data = await fetchJsonWithRetry(`https://${domain}/products.json?limit=250&page=${page}`);
    } catch (err) {
      // Shopify's legacy /products.json hard-caps pagination (typically ~page 100);
      // treat that as "reached the end of what's reachable" rather than a failure.
      if (String(err.message).includes('400 Bad Request')) break;
      throw err;
    }
    const products = data.products || [];
    if (products.length === 0) break;

    for (const p of products) {
      if (isMatch(p)) items.push(...productToVariants(domain, p));
    }

    if (products.length < 250) break;
  }
  return items;
}

module.exports = { searchCollection, fetchCollectionProducts, fetchCatalogProducts, isPokemonTcgProduct };
