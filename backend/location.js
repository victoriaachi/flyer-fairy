// Finds the closest branch of a grocery chain to a postal code.
//
// Flipp's flyers are regional and don't say which store they're for, so we:
//   1. turn the postal code into lat/lon (geocoder.ca, free, no key)
//   2. ask OpenStreetMap (Overpass) for supermarkets near that point
//   3. pick the closest one whose brand matches the store
//   4. fill in a street address via Nominatim if OSM didn't have one
//
// Overpass is often overloaded, so results are cached per postal code and the
// lookup keeps running in the background if the caller stops waiting.

const axios = require("axios");

const USER_AGENT = "flyer-fairy/0.1 (personal grocery flyer app)";
const SEARCH_RADIUS_M = 20000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// How each chain shows up in OpenStreetMap's brand/name tags.
const BRAND_MATCHERS = {
  "No Frills": (t) => /no ?frills/i.test(t.brand || t.name || ""),
  FreshCo: (t) => /freshco/i.test(t.brand || t.name || ""),
  Loblaws: (t) => /^loblaws$/i.test(t.brand || t.name || ""),
  Costco: (t) =>
    /costco/i.test(t.brand || t.name || "") &&
    !/business|gas|fuel/i.test(t.name || ""),
  "T&T Supermarket": (t) => /t ?& ?t/i.test(t.brand || t.name || ""),
  "Food Basics": (t) => /food basics/i.test(t.brand || t.name || ""),
};

const geocodeCache = new Map(); // postal -> { lat, lon, city }
const storesCache = new Map(); // postal -> { at, promise }
const addressCache = new Map(); // "lat,lon" -> address string

async function geocodePostalCode(postalCode) {
  if (geocodeCache.has(postalCode)) return geocodeCache.get(postalCode);
  const res = await axios.get(`https://geocoder.ca/${postalCode}`, {
    params: { json: 1 },
    headers: { "User-Agent": USER_AGENT },
    timeout: 8000,
  });
  const lat = Number(res.data.latt);
  const lon = Number(res.data.longt);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || res.data.error) {
    throw new Error(`Could not geocode ${postalCode}`);
  }
  const point = { lat, lon, city: res.data.standard?.city };
  geocodeCache.set(postalCode, point);
  return point;
}

async function queryOverpass(lat, lon) {
  const query = `[out:json][timeout:25];nwr["shop"~"^(supermarket|wholesale)$"](around:${SEARCH_RADIUS_M},${lat},${lon});out center tags;`;
  let lastError;
  // Two passes over the mirrors: they 502 under load but often recover quickly.
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        const res = await axios.post(
          mirror,
          new URLSearchParams({ data: query }).toString(),
          {
            headers: {
              "User-Agent": USER_AGENT,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 30000,
          }
        );
        if (Array.isArray(res.data?.elements)) return res.data.elements;
        lastError = new Error("Unexpected Overpass response");
      } catch (error) {
        lastError = error;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw lastError;
}

// All supermarkets near a postal code, cached so each postal code only hits
// Overpass once a week no matter how many stores you click.
function getNearbyStores(postalCode) {
  const cached = storesCache.get(postalCode);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;

  const promise = (async () => {
    const origin = await geocodePostalCode(postalCode);
    const elements = await queryOverpass(origin.lat, origin.lon);
    return { origin, elements };
  })();
  storesCache.set(postalCode, { at: Date.now(), promise });
  // Don't cache failures; let the next request try again.
  promise.catch(() => storesCache.delete(postalCode));
  return promise;
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

function addressFromTags(t) {
  const street = [t["addr:housenumber"], t["addr:street"]]
    .filter(Boolean)
    .join(" ");
  if (!street) return null;
  return [street, t["addr:city"], t["addr:province"] || "ON"]
    .filter(Boolean)
    .join(", ");
}

async function reverseGeocode(lat, lon) {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (addressCache.has(key)) return addressCache.get(key);
  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { lat, lon, format: "json", zoom: 18, addressdetails: 1 },
      headers: { "User-Agent": USER_AGENT },
      timeout: 6000,
    });
    const a = res.data.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.suburb;
    const address = [street, city, a.state].filter(Boolean).join(", ") || null;
    addressCache.set(key, address);
    return address;
  } catch {
    return null;
  }
}

function mapsSearchUrl(text) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

// Always returns something usable: the exact store when we can find it,
// otherwise a Google Maps search for the chain near the postal code.
async function findNearestStore(storeName, postalCode) {
  const fallback = {
    found: false,
    mapsUrl: mapsSearchUrl(`${storeName} near ${postalCode}`),
  };

  const matches = BRAND_MATCHERS[storeName];
  if (!matches) return fallback;

  const { origin, elements } = await getNearbyStores(postalCode);

  let best = null;
  for (const el of elements) {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null || !matches(tags)) continue;
    const km = distanceKm(origin, { lat, lon });
    if (!best || km < best.km) best = { tags, lat, lon, km };
  }
  if (!best) return fallback;

  const address =
    addressFromTags(best.tags) || (await reverseGeocode(best.lat, best.lon));
  const label = best.tags.name || storeName;

  return {
    found: true,
    name: label,
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

module.exports = { findNearestStore, mapsSearchUrl };
