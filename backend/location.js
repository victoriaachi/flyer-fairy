const axios = require("axios");

const USER_AGENT = "flyer-fairy/0.1 (personal grocery flyer app)";
// about 20 km each way
const SEARCH_BOX_DEG = 0.18;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BRAND_MATCHERS = {
  "No Frills": (t) => /no ?frills/i.test(t.brand || t.name || ""),
  FreshCo: (t) => /freshco/i.test(t.brand || t.name || ""),
  Loblaws: (t) => /^loblaws$/i.test(t.brand || t.name || ""),
  Costco: (t) =>
    /costco/i.test(t.brand || t.name || "") &&
    !/business|gas|fuel|tire|optical|car wash|pharmacy/i.test(t.name || ""),
  "T&T Supermarket": (t) => /t ?& ?t/i.test(t.brand || t.name || ""),
  "Food Basics": (t) => /food basics/i.test(t.brand || t.name || ""),
};

const geocodeCache = new Map();
const nearestCache = new Map();

async function geocodePostalCode(postalCode) {
  if (geocodeCache.has(postalCode)) return geocodeCache.get(postalCode);
  const res = await axios.get(`https://geocoder.ca/${postalCode}`, {
    params: { json: 1 },
    headers: { "User-Agent": USER_AGENT },
    timeout: 8000,
  });
  const lat = Number(res.data.latt);
  const lon = Number(res.data.longt);
  const province = res.data.standard?.prov;
  // geocoder.ca makes up a spot for fake codes but leaves the province empty
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || res.data.error || !province) {
    const error = new Error(`Unknown postal code ${postalCode}`);
    error.code = "UNKNOWN_POSTAL_CODE";
    throw error;
  }
  const point = { lat, lon, city: res.data.standard?.city, province };
  geocodeCache.set(postalCode, point);
  return point;
}

// nominatim asks for at most 1 request a second, so they all wait in line
let nextSlot = 0;
async function nominatimTurn() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

async function searchNearby(storeName, origin) {
  await nominatimTurn();
  const d = SEARCH_BOX_DEG;
  const res = await axios.get("https://nominatim.openstreetmap.org/search", {
    params: {
      q: storeName,
      format: "jsonv2",
      viewbox: `${origin.lon - d},${origin.lat + d},${origin.lon + d},${origin.lat - d}`,
      bounded: 1,
      limit: 40,
      addressdetails: 1,
    },
    headers: { "User-Agent": USER_AGENT },
    timeout: 8000,
  });
  return Array.isArray(res.data) ? res.data : [];
}

function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatAddress(a = {}) {
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city || a.town || a.village || a.suburb;
  const province = (a["ISO3166-2-lvl4"] || "").replace("CA-", "") || a.state;
  return [street, city, province].filter(Boolean).join(", ") || null;
}

function mapsSearchUrl(text) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

async function lookUpNearest(storeName, postalCode) {
  const fallback = {
    found: false,
    mapsUrl: mapsSearchUrl(`${storeName} near ${postalCode}`),
  };
  const matches = BRAND_MATCHERS[storeName];
  if (!matches) return fallback;

  const origin = await geocodePostalCode(postalCode);
  const places = await searchNearby(storeName, origin);

  let best = null;
  for (const place of places) {
    if (!["shop", "building"].includes(place.category)) continue;
    if (!matches({ name: place.name })) continue;
    const point = { lat: Number(place.lat), lon: Number(place.lon) };
    const km = distanceKm(origin, point);
    if (!best || km < best.km) best = { place, ...point, km };
  }
  if (!best) return fallback;

  const address = formatAddress(best.place.address);
  return {
    found: true,
    name: best.place.name || storeName,
    address,
    distanceKm: Math.round(best.km * 10) / 10,
    lat: best.lat,
    lon: best.lon,
    mapsUrl: mapsSearchUrl(
      address ? `${storeName} ${address}` : `${best.lat},${best.lon}`
    ),
    fallbackMapsUrl: fallback.mapsUrl,
  };
}

// cached per store and postal code for a week, failures arent cached so they retry
function findNearestStore(storeName, postalCode) {
  const key = `${storeName}|${postalCode}`;
  const cached = nearestCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;
  const promise = lookUpNearest(storeName, postalCode);
  nearestCache.set(key, { at: Date.now(), promise });
  promise.catch(() => nearestCache.delete(key));
  return promise;
}

async function findNearestStores(storeNames, postalCode) {
  const results = {};
  for (const storeName of storeNames) {
    results[storeName] = await findNearestStore(storeName, postalCode);
  }
  return results;
}

module.exports = {
  findNearestStore,
  findNearestStores,
  geocodePostalCode,
  mapsSearchUrl,
};
