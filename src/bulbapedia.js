const UA = 'cheapies-deal-alerts/0.1 (personal Pokemon TCG set tracker)';
const PAGE = 'List_of_Pok%C3%A9mon_Trading_Card_Game_expansions';

async function fetchKnownSets() {
  const url = `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${PAGE}&format=json&prop=wikitext`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Bulbapedia fetch failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const wikitext = data?.parse?.wikitext?.['*'];
  if (!wikitext) throw new Error('Bulbapedia response missing wikitext');

  const rows = wikitext.split(/\n\|-/);
  const sets = [];
  for (const row of rows) {
    const tcgMatch = row.match(/\{\{TCG\|([^}|]+)(?:\|([^}|]+))?\}\}/);
    if (!tcgMatch) continue;
    const name = (tcgMatch[2] || tcgMatch[1]).trim();
    const dateMatch = row.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
    sets.push({ name, date: dateMatch ? dateMatch[1] : null });
  }
  return sets;
}

module.exports = { fetchKnownSets };
