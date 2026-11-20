const express = require("express");
const cors = require("cors");
const { categorizeItem, categorizeItems } = require("./categorize");
const { getStoreDeals, getDealsByStore } = require("./flipp");
const { searchAllStores, planBasket } = require("./compare");
const {
  findNearestStore,
  findNearestStores,
  geocodePostalCode,
  mapsSearchUrl,
} = require("./location");

// The stores the app shows buttons for.
const STORE_NAMES = ["No Frills", "T&T Supermarket", "FreshCo", "Loblaws", "Costco"];
const MAX_LIST_ITEMS = 30;

const app = express();

// Which sites may call this API. Locally anything goes; on Render, set
// CORS_ORIGIN to the Vercel URL (comma-separate several).
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : null;
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
app.use(express.json());

const PORT = process.env.PORT || 8000;

// Opening the backend's address in a browser (or Render's health check)
// shows this instead of "Cannot GET /".
app.get(["/", "/api/health"], (req, res) => {
  res.json({ ok: true, service: "flyer-fairy backend" });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "Hello from backend!",
    success: true,
  });
});

const DEFAULT_POSTAL_CODE = "L3R3G7";
// Canadian postal code, e.g. "L3R 3G7" or "l3r3g7". Canada never uses D, F, I,
// O, Q or U, and W/Z never start a code.
const POSTAL_CODE_RE =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

function normalizePostalCode(raw) {
  if (!raw) return DEFAULT_POSTAL_CODE;
  const trimmed = String(raw).trim();
  if (!POSTAL_CODE_RE.test(trimmed)) return null;
  return trimmed.replace(/[ -]/g, "").toUpperCase();
}

const INVALID_POSTAL = {
  error: "Invalid postal code. Use a Canadian postal code like L3R 3G7.",
};

app.get("/api/flyers/:store", async (req, res) => {
  const store = req.params.store;
  const postalCode = normalizePostalCode(req.query.postal);
  if (!postalCode) return res.status(400).json(INVALID_POSTAL);

  try {
    const { flyer, items, nonGroceryFlyerIds } = await getStoreDeals(
      store,
      postalCode
    );
    res.json({
      message: categorizeItems(items, nonGroceryFlyerIds),
      flyer,
      postalCode,
      itemCount: items.length,
      success: true,
    });
  } catch (error) {
    console.log("flyer fetch failed:", error.message);
    res.status(502).json({ error: "Could not reach the flyer service" });
  }
});

// Search every store's flyer at once, e.g. /api/search?q=salmon&postal=L3R3G7
app.get("/api/search", async (req, res) => {
  const postalCode = normalizePostalCode(req.query.postal);
  if (!postalCode) return res.status(400).json(INVALID_POSTAL);
  const query = String(req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "Type something to search for." });

  try {
    const { dealsByStore, failed } = await getDealsByStore(STORE_NAMES, postalCode);
    if (!Object.keys(dealsByStore).length) {
      return res.status(502).json({ error: "Could not reach the flyer service" });
    }
    res.json({ query, postalCode, failed, ...searchAllStores(query, dealsByStore) });
  } catch (error) {
    console.log("search failed:", error.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// The cheapest way to buy a grocery list.
// POST { postal: "L3R3G7", items: ["eggs", "milk", "chicken thighs"],
//        exclude: [flyer item ids to skip] }
app.post("/api/basket", async (req, res) => {
  const postalCode = normalizePostalCode(req.body?.postal);
  if (!postalCode) return res.status(400).json(INVALID_POSTAL);
  const list = Array.isArray(req.body?.items) ? req.body.items : [];
  const terms = list.map((t) => String(t).trim()).filter(Boolean);
  if (!terms.length) {
    return res.status(400).json({ error: "Add at least one item to your list." });
  }
  if (terms.length > MAX_LIST_ITEMS) {
    return res
      .status(400)
      .json({ error: `Lists can have up to ${MAX_LIST_ITEMS} items.` });
  }

  try {
    const { dealsByStore, failed } = await getDealsByStore(STORE_NAMES, postalCode);
    if (!Object.keys(dealsByStore).length) {
      return res.status(502).json({ error: "Could not reach the flyer service" });
    }
    const exclude = Array.isArray(req.body?.exclude) ? req.body.exclude : [];
    res.json({
      postalCode,
      failed,
      ...planBasket(terms, dealsByStore, { exclude }),
    });
  } catch (error) {
    console.log("basket failed:", error.message);
    res.status(500).json({ error: "Couldn't work out your list" });
  }
});

// Quick check that a postal code is real, so the page can say so while the
// user is still typing. Returns the city to show as confirmation.
app.get("/api/postal/:code", async (req, res) => {
  const postalCode = normalizePostalCode(req.params.code);
  if (!postalCode) {
    return res.status(400).json({ valid: false, error: "That doesn't look like a Canadian postal code." });
  }
  try {
    const point = await geocodePostalCode(postalCode);
    res.json({ valid: true, postalCode, city: point.city, province: point.province });
  } catch (error) {
    if (error.code === "UNKNOWN_POSTAL_CODE") {
      return res.status(404).json({ valid: false, error: "We couldn't find that postal code." });
    }
    console.log("postal check failed:", error.message);
    // The geocoder itself is down; don't block the user over it.
    res.json({ valid: true, postalCode, city: null, unverified: true });
  }
});

// Nearest branch of every store at once. The page calls this as soon as a
// valid postal code is entered, so locations are ready before any click.
app.get("/api/locations", async (req, res) => {
  const postalCode = normalizePostalCode(req.query.postal);
  if (!postalCode) {
    return res.status(400).json({ error: "Invalid postal code" });
  }
  try {
    res.json({ postalCode, stores: await findNearestStores(STORE_NAMES, postalCode) });
  } catch (error) {
    console.log("locations lookup failed:", error.message);
    // Fall back to a Google Maps search per store so the page still has links.
    const stores = Object.fromEntries(
      STORE_NAMES.map((store) => [
        store,
        { found: false, mapsUrl: mapsSearchUrl(`${store} near ${postalCode}`) },
      ])
    );
    res.json({ postalCode, stores, error: "Couldn't locate stores right now" });
  }
});

// Separate from /api/flyers because the map lookup can be slow; the page shows
// the flyer right away and fills in the store location when this returns.
app.get("/api/location/:store", async (req, res) => {
  const store = req.params.store;
  const postalCode = normalizePostalCode(req.query.postal);
  if (!postalCode) {
    return res.status(400).json({ error: "Invalid postal code" });
  }
  try {
    res.json(await findNearestStore(store, postalCode));
  } catch (error) {
    console.log("location lookup failed:", error.message);
    res.json({
      found: false,
      mapsUrl: mapsSearchUrl(`${store} near ${postalCode}`),
    });
  }
});

module.exports = { app, categorizeItem, categorizeItems };

if (require.main === module) app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
