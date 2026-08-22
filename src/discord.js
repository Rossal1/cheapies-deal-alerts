function dealToEmbed(deal) {
  const fields = [];
  if (deal.votesPos != null) fields.push({ name: 'Votes', value: `▲ ${deal.votesPos}`, inline: true });
  if (deal.commentCount != null) fields.push({ name: 'Comments', value: String(deal.commentCount), inline: true });
  if (deal.categories && deal.categories.length) {
    fields.push({ name: 'Category', value: deal.categories.slice(0, 3).join(', '), inline: true });
  }

  return {
    title: deal.title.length > 256 ? `${deal.title.slice(0, 253)}...` : deal.title,
    url: deal.link,
    color: 0xf2c94c,
    fields,
    thumbnail: deal.image ? { url: deal.image } : undefined,
    footer: { text: deal.creator ? `Posted by ${deal.creator} on cheapies.nz` : 'cheapies.nz' },
    timestamp: deal.pubDate ? new Date(deal.pubDate).toISOString() : undefined,
  };
}

async function postDealToDiscord(webhookUrl, deal) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [dealToEmbed(deal)] }),
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const retryAfterMs = Math.ceil((body.retry_after || 1) * 1000);
    await new Promise((r) => setTimeout(r, retryAfterMs));
    return postDealToDiscord(webhookUrl, deal);
  }

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}`);
  }
}

module.exports = { postDealToDiscord };
