const { pool } = require("./db");
const { parseQuery, matchAcrossStores } = require("./compare");

// cheapest match for a search at each store, week by week
async function priceHistory(query, postalCode, stores) {
  const words = parseQuery(query);
  if (!words.length) return [];

  // rough filter in sql, the real matching happens in js with the same rules as search
  const stems = words.map((w) => (w.length > 3 ? w.replace(/(ies|es|s|y)$/, "") : w));
  const conditions = stems.map((_, i) => `p.name ilike $${i + 3}`).join(" and ");

  // flyer weeks start on thursday, a sale counts for every week it covers
  const { rows } = await pool.query(
    `select p.flipp_item_id as id, p.store, p.name, p.category, p.price,
            p.image_url, to_char(w.week, 'YYYY-MM-DD') as week
     from prices p
     join flyers f on f.id = p.flyer_id and f.is_grocery
     join flyer_regions r on r.flyer_id = p.flyer_id and r.postal_code = $1
     cross join lateral (
       select date_trunc('week', (p.valid_from at time zone 'America/Toronto') - interval '3 days')
                + interval '3 days' as first_week,
              date_trunc('week', (p.valid_to at time zone 'America/Toronto') - interval '5 days')
                + interval '3 days' as last_week
     ) span
     cross join lateral generate_series(
       span.first_week, greatest(span.first_week, span.last_week), interval '1 week'
     ) as w(week)
     where p.store = any($2) and ${conditions}
       and w.week <= now() at time zone 'America/Toronto'
     order by week`,
    [postalCode, stores, ...stems.map((s) => `%${s}%`)]
  );

  const byWeek = new Map();
  for (const row of rows) {
    const week = row.week;
    if (!byWeek.has(week)) {
      byWeek.set(week, Object.fromEntries(stores.map((s) => [s, []])));
    }
    byWeek.get(week)[row.store].push({
      id: Number(row.id),
      name: row.name,
      price: row.price,
      category: row.category,
      cutout_image_url: row.image_url,
    });
  }

  const weeks = [...byWeek.entries()].map(([week, dealsByStore]) => {
    const matches = matchAcrossStores(query, dealsByStore);
    const best = Object.fromEntries(
      stores.map((store) => {
        const top = matches[store][0];
        return [store, top ? { price: top.price, name: top.name, image: top.image } : null];
      })
    );
    const cheapest = Object.entries(best)
      .filter(([, v]) => v)
      .sort((a, b) => a[1].price - b[1].price)[0];
    return {
      week,
      stores: best,
      cheapest: cheapest ? { store: cheapest[0], price: cheapest[1].price } : null,
    };
  });
  return weeks.filter((w) => w.cheapest);
}

module.exports = { priceHistory };
