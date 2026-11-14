// Sorts flyer items into aisles using the keyword lists in data/data.js.

const { categories } = require("./data/data");

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

// Items we don't show: blank prices and big-ticket non-grocery stuff.
function isGroceryPrice(item) {
  const price = Number(item.price);
  return price > 0 && price <= 50;
}

// The category an item belongs in. Unmatched items from flyers Flipp doesn't
// tag as Groceries (toy books, home & garden, holiday merch) go to
// Home & Seasonal instead of cluttering Other.
function categoryFor(item, nonGroceryFlyerIds = new Set()) {
  return (
    categorizeItem(item.name || "") ||
    (nonGroceryFlyerIds.has(item.flyer_id) ? "Home & Seasonal" : "Other")
  );
}

// Groups items by category, in aisle order, dropping empty categories.
function categorizeItems(items, nonGroceryFlyerIds = new Set()) {
  const grouped = {};
  for (const category of Object.keys(categories)) grouped[category] = [];

  for (const item of items) {
    if (!isGroceryPrice(item)) continue;
    grouped[categoryFor(item, nonGroceryFlyerIds)].push(item);
  }

  // Other is always last (it's last in data.js).
  return Object.fromEntries(
    Object.entries(grouped).filter(([, list]) => list.length > 0)
  );
}

module.exports = {
  categorizeItem,
  categorizeItems,
  categoryFor,
  escapeRegex,
  isGroceryPrice,
};
