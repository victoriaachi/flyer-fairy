const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { stores, categories } = require("./data/data");
const { findNearestStore, mapsSearchUrl } = require("./location");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 8000;

app.get("/api/test", (req, res) => {
  res.json({
    message: "Hello from backend!",
    success: true,
  });
});

const DEFAULT_POSTAL_CODE = "L3R3G7";
// Canadian postal code, e.g. "L3R 3G7" or "l3r3g7"
const POSTAL_CODE_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

function normalizePostalCode(raw) {
  if (!raw) return DEFAULT_POSTAL_CODE;
  const trimmed = String(raw).trim();
  if (!POSTAL_CODE_RE.test(trimmed)) return null;
  return trimmed.replace(/[ -]/g, "").toUpperCase();
}

async function getCurrentFlyers(name, postalCode) {
  let response;
  let storeData;
  let url = `https://dam.flippenterprise.net/api/flipp/data?locale=en&postal_code=${postalCode}&sid=7927696267820832`;
  try {
    response = await axios.get(url);
    console.log("url", url);
    // console.log(response.data);
    // console.log("response", response.data);
    storeData = response.data.flyers.filter((item) => item.merchant === name);
    // console.log("storeData", storeData);
  } catch (error) {
    console.log("error!", error.message);
  }
  //   console.log("hi");
  return storeData;
}

// Every (keyword, category) pair as a regex, longest keyword first, so the most
// specific keyword wins: "popcorn" -> Snacks before "corn" -> Produce.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const keywordMatchers = Object.entries(categories)
  .flatMap(([category, keywords]) =>
    keywords.map((keyword) => ({
      category,
      keyword,
      // Whole words only, with optional plural: "ham" matches "HAM" and
      // "HAMS" but not "SHAMPOO"; "potato" matches "POTATOES".
      regex: new RegExp(
        `(^|[^a-z])${escapeRegex(keyword.toLowerCase())}(s|es)?(?![a-z])`,
        "i"
      ),
    }))
  )
  .sort((a, b) => b.keyword.length - a.keyword.length);

function categorizeItem(name) {
  const match = keywordMatchers.find((m) => m.regex.test(name));
  return match ? match.category : null;
}

// nonGroceryFlyerIds: flyers Flipp doesn't tag as Groceries (toy books, home
// & garden, holiday merch). Their unmatched items go to Home & Seasonal
// instead of cluttering Other.
async function categorizeItems(items, nonGroceryFlyerIds = new Set()) {
  const categorizedItems = {};
  for (const category of Object.keys(categories)) {
    categorizedItems[category] = [];
  }

  for (const item of items) {
    const price = Number(item.price);
    if (price === 0 || price > 50) continue;

    let category = categorizeItem(item.name || "");
    if (!category) {
      category = nonGroceryFlyerIds.has(item.flyer_id)
        ? "Home & Seasonal"
        : "Other";
    }
    categorizedItems[category].push(item);
  }

  // Drop empty categories; Other is always last (it's last in data.js).
  return Object.fromEntries(
    Object.entries(categorizedItems).filter(([, list]) => list.length > 0)
  );
}

app.get("/api/flyers/:store", async (req, res) => {
  //   console.log("req", req.params);
  const store = req.params.store;
  const postalCode = normalizePostalCode(req.query.postal);
  if (!postalCode) {
    return res.status(400).json({
      error: "Invalid postal code. Use a Canadian postal code like L3R 3G7.",
    });
  }
  //   console.log("stores", stores);

  let data = await getCurrentFlyers(store, postalCode);
  if (!data) {
    return res.status(502).json({ error: "Could not reach the flyer service" });
  }

  let message = [];
  try {
    // Fetch every flyer's items at once instead of one after another.
    const responses = await Promise.all(
      data.map((flyer) =>
        axios.get(
          `https://dam.flippenterprise.net/api/flipp/flyers/${flyer.id}/flyer_items?locale=en`
        )
      )
    );
    for (const response of responses) message.push(...response.data);

    const nonGroceryFlyerIds = new Set(
      data
        .filter((flyer) => !(flyer.categories || []).includes("Groceries"))
        .map((flyer) => flyer.id)
    );
    const categorizedResponse = await categorizeItems(
      message,
      nonGroceryFlyerIds
    );
    const primary = pickWeeklyFlyer(data);
    const flyer = primary && {
      merchant: primary.merchant,
      merchantLogo: primary.merchant_logo,
      validFrom: primary.valid_from,
      validTo: primary.valid_to,
      flyerCount: data.length,
    };
    res.json({
      message: categorizedResponse,
      flyer,
      postalCode,
      itemCount: message.length,
      success: true,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      error: "Failed to fetch flyers",
    });
  }
});

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

module.exports = { categorizeItem, categorizeItems };

if (require.main === module) app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
