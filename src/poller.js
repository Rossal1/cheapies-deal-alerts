const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

async function fetchDeals(feedUrl) {
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'cheapies-deal-alerts/0.1 (personal use, polls every couple of minutes)' },
  });
  if (!res.ok) throw new Error(`Feed request failed: ${res.status} ${res.statusText}`);

  const xml = await res.text();
  const data = parser.parse(xml);
  const rawItems = data?.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return items
    .map((item) => {
      const guidRaw = typeof item.guid === 'object' ? item.guid['#text'] : item.guid;
      const id = String(guidRaw || item.link || '').split(' at ')[0].trim();
      const meta = item['ozb:meta'] || {};
      const categories = []
        .concat(item.category || [])
        .map((c) => (typeof c === 'object' ? c['#text'] : c))
        .filter(Boolean);

      return {
        id,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        creator: item['dc:creator'],
        sourceLabel: 'cheapies.nz',
        categories,
        commentCount: meta['@_comment-count'] != null ? Number(meta['@_comment-count']) : null,
        votesPos: meta['@_votes-pos'] != null ? Number(meta['@_votes-pos']) : null,
        votesNeg: meta['@_votes-neg'] != null ? Number(meta['@_votes-neg']) : null,
        merchantUrl: meta['@_url'] || null,
        image: meta['@_image'] || null,
      };
    })
    .filter((d) => d.id && d.title);
}

module.exports = { fetchDeals };
