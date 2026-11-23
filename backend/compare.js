const { categorizeItem, escapeRegex } = require("./categorize");

function wordPattern(word) {
  let base = word;
  let endings = "(?:s|es)?";
  if (/[^aeiou]ies$/.test(word)) {
    base = word.slice(0, -3);
    endings = "(?:y|ies)";
  } else if (/[^aeiou]y$/.test(word)) {
    base = word.slice(0, -1);
    endings = "(?:y|ies)";
  } else if (/(?:ch|sh|x|o)es$/.test(word)) {
    base = word.slice(0, -2);
  } else if (/[^s]s$/.test(word) && word.length > 3) {
    base = word.slice(0, -1);
  }
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(base)}${endings}(?![a-z0-9])`, "i");
}

function parseQuery(query) {
  return String(query || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function toSummary(item, store) {
  return {
    id: item.id,
    store,
    name: item.name,
    price: Number(item.price),
    image: item.cutout_image_url,
    category: item.category,
  };
}

// if any store has the item in the right aisle, only use that aisle
// so milk doesnt bring up milk chocolate or milk-bone
function matchAcrossStores(query, dealsByStore) {
  const words = parseQuery(query);
  const stores = Object.keys(dealsByStore);
  if (!words.length) return Object.fromEntries(stores.map((s) => [s, []]));

  const patterns = words.map(wordPattern);
  const matches = Object.fromEntries(
    stores.map((store) => [
      store,
      dealsByStore[store].filter((d) =>
        patterns.every((p) => p.test(d.name || ""))
      ),
    ])
  );

  const aisle = categorizeItem(words.join(" "));
  const anyInAisle =
    aisle && stores.some((s) => matches[s].some((d) => d.category === aisle));
  return Object.fromEntries(
    stores.map((store) => [
      store,
      matches[store]
        .filter((d) => !anyInAisle || d.category === aisle)
        .sort((a, b) => Number(a.price) - Number(b.price))
        .map((d) => toSummary(d, store)),
    ])
  );
}

function matchDeals(query, deals) {
  return matchAcrossStores(query, { store: deals }).store;
}

function searchAllStores(query, dealsByStore, { limit = 60 } = {}) {
  const byStore = {};
  const all = [];
  for (const [store, matches] of Object.entries(
    matchAcrossStores(query, dealsByStore)
  )) {
    byStore[store] = matches;
    all.push(...matches);
  }
  all.sort((a, b) => a.price - b.price || a.store.localeCompare(b.store));
  return { byStore, results: all.slice(0, limit), total: all.length };
}

function combinations(list, size) {
  if (size === 0) return [[]];
  if (list.length < size) return [];
  const [first, ...rest] = list;
  return [
    ...combinations(rest, size - 1).map((combo) => [first, ...combo]),
    ...combinations(rest, size),
  ];
}

const round2 = (n) => Math.round(n * 100) / 100;

function priceTrip(stores, options) {
  let total = 0;
  const picks = [];
  const missing = [];
  for (const option of options) {
    let best = null;
    for (const store of stores) {
      const cheapest = option.byStore[store]?.[0];
      if (cheapest && (!best || cheapest.price < best.price)) best = cheapest;
    }
    if (best) {
      total += best.price;
      picks.push({ term: option.term, ...best });
    } else {
      missing.push(option.term);
    }
  }
  const usedStores = stores.filter((s) => picks.some((p) => p.store === s));
  return {
    stores: usedStores.length ? usedStores : stores,
    total: round2(total),
    covered: picks.length,
    picks,
    missing,
  };
}

function compareTrips(a, b) {
  return (
    b.covered - a.covered ||
    a.total - b.total ||
    a.stores.length - b.stores.length
  );
}

// tries every single store and every pair of stores,
// more items found wins first, then the cheaper total
function planBasket(list, dealsByStore, { exclude = [] } = {}) {
  const excluded = new Set(exclude.map(Number));
  const stores = Object.keys(dealsByStore);
  const terms = [
    ...new Set(list.map((t) => String(t).trim()).filter(Boolean)),
  ];

  const options = terms.map((term) => {
    const byStore = matchAcrossStores(term, dealsByStore);
    for (const store of stores) {
      byStore[store] = byStore[store].filter((d) => !excluded.has(d.id));
    }
    return { term, byStore };
  });

  const singleStores = stores
    .map((store) => priceTrip([store], options))
    .sort(compareTrips);
  const bestSingle = singleStores[0] || null;

  const bestPairTrip = combinations(stores, 2)
    .map((pair) => priceTrip(pair, options))
    .sort(compareTrips)[0];
  const pairHelps =
    bestPairTrip &&
    bestSingle &&
    bestPairTrip.stores.length === 2 &&
    (bestPairTrip.covered > bestSingle.covered ||
      bestSingle.total - bestPairTrip.total >= 1);
  const bestPair = pairHelps
    ? { ...bestPairTrip, savings: round2(bestSingle.total - bestPairTrip.total) }
    : null;

  const cheapest = priceTrip(stores, options);

  const items = options.map((option) => ({
    term: option.term,
    byStore: Object.fromEntries(
      stores.map((store) => {
        const matches = option.byStore[store];
        return [
          store,
          matches.length
            ? { ...matches[0], otherMatches: matches.length - 1 }
            : null,
        ];
      })
    ),
  }));

  return {
    items,
    singleStores,
    bestSingle,
    bestPair,
    cheapest,
    notOnSale: cheapest.missing,
  };
}

module.exports = { parseQuery, matchAcrossStores, matchDeals, searchAllStores, planBasket, wordPattern };
