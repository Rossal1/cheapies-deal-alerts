const UA = 'cheapies-deal-alerts/0.1 (personal stock watcher)';

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
    for (const v of p.variants || []) {
      items.push({
        variantId: String(v.id),
        productTitle: p.title,
        variantTitle: v.title && v.title !== 'Default Title' ? v.title : null,
        price: v.price,
        available: !!v.available,
        url: `https://${domain}/products/${p.handle}`,
        image: p.images?.[0]?.src || null,
      });
    }
  }
  return items;
}

module.exports = { searchCollection, fetchCollectionProducts };
