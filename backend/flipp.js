// Fetches flyers from Flipp, with a short in-memory cache so searching every
// store (or re-opening one) doesn't refetch the same flyers over and over.

const axios = require("axios");
const { categoryFor, isGroceryPrice } = require("./categorize");

const FLIPP_API = "https://dam.flippenterprise.net/api/flipp";
const FLIPP_SID = "7927696267820832";
// Flyers change once a week, so a few hours is plenty fresh.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

const flyerListCache = new Map(); // postal -> { at, promise }
const flyerItemsCache = new Map(); // flyer id -> { at, promise }

// Shares one in-flight request per key and forgets failures so the next call
// retries.
function cached(cache, key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

// Every merchant's flyers for a postal code (one Flipp call covers them all).
function getFlyerList(postalCode) {
  return cached(flyerListCache, postalCode, async () => {
    const res = await axios.get(`${FLIPP_API}/data`, {
      params: { locale: "en", postal_code: postalCode, sid: FLIPP_SID },
      timeout: 15000,
    });
    return res.data.flyers || [];
  });
}

function getFlyerItems(flyerId) {
  return cached(flyerItemsCache, flyerId, async () => {
    const res = await axios.get(`${FLIPP_API}/flyers/${flyerId}/flyer_items`, {
      params: { locale: "en" },
      timeout: 15000,
    });
    return res.data || [];
  });
}

// Stores like Costco and FreshCo run several flyers at once (a weekly grocery
// flyer plus month-long holiday / general merchandise ones). The "week" we show
// is the weekly grocery flyer: currently valid, groceries, shortest run.
function pickWeeklyFlyer(flyers) {
  if (!flyers.length) return null;
  const now = Date.now();
  const span = (f) => new Date(f.valid_to) - new Date(f.valid_from);
  const score = (f) => [
    new Date(f.valid_from) <= now && now <= new Date(f.valid_to) ? 0 : 1,
    (f.categories || []).includes("Groceries") ? 0 : 1,
    span(f),
  ];
  return [...flyers].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return sa[i] - sb[i];
    }
    return 0;
  })[0];
}

// Everything on sale at one store this week.
//   items:  every raw flyer item (for the browse view)
//   deals:  the ones with a usable price, each tagged with its category
//   flyer:  summary of the weekly flyer, or null if the store has none
async function getStoreDeals(store, postalCode) {
  const flyers = (await getFlyerList(postalCode)).filter(
    (f) => f.merchant === store
  );
  const itemLists = await Promise.all(flyers.map((f) => getFlyerItems(f.id)));
  const items = itemLists.flat();

  const nonGroceryFlyerIds = new Set(
    flyers
      .filter((f) => !(f.categories || []).includes("Groceries"))
      .map((f) => f.id)
  );
  const deals = items.filter(isGroceryPrice).map((item) => ({
    ...item,
    category: categoryFor(item, nonGroceryFlyerIds),
  }));

  const primary = pickWeeklyFlyer(flyers);
  const flyer = primary && {
    merchant: primary.merchant,
    merchantLogo: primary.merchant_logo,
    validFrom: primary.valid_from,
    validTo: primary.valid_to,
    flyerCount: flyers.length,
  };

  return { store, flyer, items, deals, nonGroceryFlyerIds };
}

// Deals for several stores at once. A store that fails to load is reported in
// `failed` instead of failing the whole request.
async function getDealsByStore(stores, postalCode) {
  const results = await Promise.allSettled(
    stores.map((store) => getStoreDeals(store, postalCode))
  );
  const dealsByStore = {};
  const failed = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") dealsByStore[stores[i]] = result.value.deals;
    else {
      failed.push(stores[i]);
      console.log(`couldn't load ${stores[i]}:`, result.reason?.message);
    }
  });
  return { dealsByStore, failed };
}

module.exports = { getStoreDeals, getDealsByStore, pickWeeklyFlyer };
