function dealToEmbed(deal) {
  const fields = [];
  if (deal.votesPos != null) fields.push({ name: 'Votes', value: `▲ ${deal.votesPos}`, inline: true });
  if (deal.commentCount != null) fields.push({ name: 'Comments', value: String(deal.commentCount), inline: true });
  if (deal.categories && deal.categories.length) {
    fields.push({ name: 'Category', value: deal.categories.slice(0, 3).join(', '), inline: true });
  }

  const footerText = deal.creator
    ? `Posted by ${deal.creator}${deal.sourceLabel ? ` on ${deal.sourceLabel}` : ''}`
    : deal.sourceLabel || '';

  return {
    title: deal.title.length > 256 ? `${deal.title.slice(0, 253)}...` : deal.title,
    url: deal.link,
    color: 0xf2c94c,
    fields,
    thumbnail: deal.image ? { url: deal.image } : undefined,
    footer: footerText ? { text: footerText } : undefined,
    timestamp: deal.pubDate ? new Date(deal.pubDate).toISOString() : undefined,
  };
}

async function postWebhook(webhookUrl, body) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const retryBody = await res.json().catch(() => ({}));
    const retryAfterMs = Math.ceil((retryBody.retry_after || 1) * 1000);
    await new Promise((r) => setTimeout(r, retryAfterMs));
    return postWebhook(webhookUrl, body);
  }

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}`);
  }
}

async function postDealToDiscord(webhookUrl, deal) {
  return postWebhook(webhookUrl, { embeds: [dealToEmbed(deal)] });
}

async function postAnnouncementToDiscord(webhookUrl, content) {
  return postWebhook(webhookUrl, { content });
}

module.exports = { postDealToDiscord, postAnnouncementToDiscord };
