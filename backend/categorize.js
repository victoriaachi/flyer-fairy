const { categories } = require("./data/data");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// longest keyword wins, so potato chips goes to snacks and not produce
const keywordMatchers = Object.entries(categories)
  .flatMap(([category, keywords]) =>
    keywords.map((keyword) => ({
      category,
      keyword,
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

function isGroceryPrice(item) {
  const price = Number(item.price);
  return price > 0 && price <= 50;
}

function categoryFor(item, nonGroceryFlyerIds = new Set()) {
  return (
    categorizeItem(item.name || "") ||
    (nonGroceryFlyerIds.has(item.flyer_id) ? "Home & Seasonal" : "Other")
  );
}

function categorizeItems(items, nonGroceryFlyerIds = new Set()) {
  const grouped = {};
  for (const category of Object.keys(categories)) grouped[category] = [];

  for (const item of items) {
    if (!isGroceryPrice(item)) continue;
    grouped[categoryFor(item, nonGroceryFlyerIds)].push(item);
  }

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
