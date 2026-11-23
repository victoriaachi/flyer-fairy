const axios = require("axios");
const { categoryFor, isGroceryPrice } = require("./categorize");

const FLIPP_API = "https://dam.flippenterprise.net/api/flipp";
const FLIPP_SID = "7927696267820832";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

const flyerListCache = new Map();
const flyerItemsCache = new Map();

function cached(cache, key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

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

// some stores have a few flyers at once (holiday, home stuff),
// this picks the weekly grocery one to show the dates for
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

  return { store, flyer, flyers, items, deals, nonGroceryFlyerIds };
}

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
