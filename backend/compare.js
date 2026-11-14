// Cross-store search and the cheapest-basket planner.

const { categorizeItem, escapeRegex } = require("./categorize");

// "Eggs" should find "EGG BITES" and "egg" should find "12 EGGS", so each word
// is matched on its singular form with any plural ending.
function wordPattern(word) {
  let base = word;
  let endings = "(?:s|es)?";
  if (/[^aeiou]ies$/.test(word)) {
    base = word.slice(0, -3); // berries -> berr(y|ies)
    endings = "(?:y|ies)";
  } else if (/[^aeiou]y$/.test(word)) {
    base = word.slice(0, -1); // berry -> berr(y|ies)
    endings = "(?:y|ies)";
  } else if (/(?:ch|sh|x|o)es$/.test(word)) {
    base = word.slice(0, -2); // tomatoes -> tomato(es)
  } else if (/[^s]s$/.test(word) && word.length > 3) {
    base = word.slice(0, -1); // eggs -> egg(s)
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

// Deals matching a search like "chicken thighs", for every store, cheapest
// first.
//
// Every word has to appear. If the search itself belongs to an aisle ("milk"
// is Dairy), matches from that aisle win, so "milk" finds milk and not milk
// chocolate or Milk-Bone dog treats. That choice is made across all stores at
// once: if any store has real milk on sale, a store without any shows nothing
// rather than its milk chocolate. Other aisles are only used when no store
// has anything in the right one.
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

// Same thing for a single store's deals.
function matchDeals(query, deals) {
  return matchAcrossStores(query, { store: deals }).store;
}

// Search every store. Returns each store's matches plus one list of the
// cheapest matches overall.
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

// Price of buying the list at a set of stores: for each item, the cheapest
// match at any store in the set.
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
  // A store that ends up with no items isn't really part of the trip.
  const usedStores = stores.filter((s) => picks.some((p) => p.store === s));
  return {
    stores: usedStores.length ? usedStores : stores,
    total: round2(total),
    covered: picks.length,
    picks,
    missing,
  };
}

// More items found beats a lower total (a trip that skips half the list is
// "cheaper" but useless). Then cheaper wins, then fewer stores.
function compareTrips(a, b) {
  return (
    b.covered - a.covered ||
    a.total - b.total ||
    a.stores.length - b.stores.length
  );
}

// Works out the cheapest way to buy a grocery list from this week's flyers.
//
// Returns:
//   items:        per list item, every store's cheapest match and how many
//                 other matches it has
//   singleStores: every store on its own, best first
//   bestSingle:   the best one-store trip
//   bestPair:     the best two-store trip, if splitting actually helps
//   cheapest:     buying each item wherever it's cheapest (every store)
//   notOnSale:    list items nothing is on sale for this week
//
// exclude: flyer item ids the shopper said aren't what they meant ("not
// flavoured milk"), so the next cheapest match is used instead.
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
  // Only suggest two stops if it finds more items or saves real money.
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

module.exports = { matchAcrossStores, matchDeals, searchAllStores, planBasket, wordPattern };
