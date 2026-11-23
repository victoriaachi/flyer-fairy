const test = require("node:test");
const assert = require("node:assert/strict");
const { matchDeals, planBasket, searchAllStores } = require("../compare");
const { categoryFor } = require("../categorize");

let nextId = 1;
function deal(name, price) {
  const item = { id: nextId++, name, price: String(price), flyer_id: 1 };
  return { ...item, category: categoryFor(item) };
}

test("matches singular and plural forms", () => {
  const deals = [deal("PC FREE RUN LARGE BROWN EGGS, 12'S", 6.5)];
  assert.equal(matchDeals("egg", deals).length, 1);
  assert.equal(matchDeals("eggs", deals).length, 1);
  assert.equal(matchDeals("Eggs", deals).length, 1);

  const berries = [deal("DRISCOLL'S STRAWBERRIES 1 LB", 3.99)];
  assert.equal(matchDeals("strawberry", berries).length, 1);
});

test("needs whole words, so ham doesn't match shampoo", () => {
  const deals = [deal("PANTENE SHAMPOO 375 mL", 4.99)];
  assert.equal(matchDeals("ham", deals).length, 0);
});

test("needs every word of the search", () => {
  const deals = [
    deal("BONELESS SKINLESS CHICKEN THIGHS", 8.88),
    deal("WHOLE CHICKEN", 6.0),
  ];
  const matches = matchDeals("chicken thighs", deals);
  assert.deepEqual(matches.map((d) => d.name), ["BONELESS SKINLESS CHICKEN THIGHS"]);
});

test("prefers the search's own aisle: milk finds milk, not chocolate", () => {
  const deals = [
    deal("LINDT TEDDY MILK CHOCOLATE 100 g", 1.99),
    deal("NEILSON 2% MILK 4 L", 5.75),
  ];
  const matches = matchDeals("milk", deals);
  assert.deepEqual(matches.map((d) => d.name), ["NEILSON 2% MILK 4 L"]);
});

test("falls back to other aisles when the right one has nothing", () => {
  const deals = [deal("LINDT TEDDY MILK CHOCOLATE 100 g", 1.99)];
  assert.equal(matchDeals("milk", deals).length, 1);
});

test("search sorts every store's matches cheapest first", () => {
  const { results, byStore } = searchAllStores("eggs", {
    A: [deal("LARGE EGGS 12", 4.5)],
    B: [deal("LARGE EGGS 12", 3.99), deal("JUMBO EGGS 12", 5.25)],
  });
  assert.deepEqual(
    results.map((r) => [r.store, r.price]),
    [["B", 3.99], ["A", 4.5], ["B", 5.25]]
  );
  assert.equal(byStore.B.length, 2);
});

test("basket picks the cheapest single store", () => {
  const plan = planBasket(["eggs", "bread"], {
    A: [deal("LARGE EGGS", 4), deal("WHITE BREAD", 3)],
    B: [deal("LARGE EGGS", 5), deal("WHITE BREAD", 3.5)],
  });
  assert.deepEqual(plan.bestSingle.stores, ["A"]);
  assert.equal(plan.bestSingle.total, 7);
  assert.equal(plan.bestPair, null);
});

test("basket ranks finding more items above a lower total", () => {
  const plan = planBasket(["eggs", "bread"], {
    A: [deal("LARGE EGGS", 2)],
    B: [deal("LARGE EGGS", 5), deal("WHITE BREAD", 3)],
  });
  assert.deepEqual(plan.bestSingle.stores, ["B"]);
  assert.equal(plan.bestSingle.covered, 2);
});

test("basket suggests two stores only when it saves money", () => {
  const plan = planBasket(["eggs", "bread"], {
    A: [deal("LARGE EGGS", 2), deal("WHITE BREAD", 6)],
    B: [deal("LARGE EGGS", 6), deal("WHITE BREAD", 2)],
  });
  assert.equal(plan.bestSingle.total, 8);
  assert.deepEqual(plan.bestPair.stores.sort(), ["A", "B"]);
  assert.equal(plan.bestPair.total, 4);
  assert.equal(plan.bestPair.savings, 4);
});

test("basket lists items nothing is on sale for", () => {
  const plan = planBasket(["eggs", "saffron", "eggs"], {
    A: [deal("LARGE EGGS", 4)],
  });
  assert.deepEqual(plan.notOnSale, ["saffron"]);
  assert.equal(plan.items.length, 2);
});

test("a store without the right aisle shows nothing, not milk chocolate", () => {
  const { byStore } = searchAllStores("milk", {
    A: [deal("NEILSON 2% MILK 4 L", 5.75)],
    B: [deal("MILK-BONE DOG TREATS", 1.99)],
  });
  assert.equal(byStore.A.length, 1);
  assert.equal(byStore.B.length, 0);
});

test("basket skips excluded items and uses the next cheapest", () => {
  const flavoured = deal("NEILSON FLAVOURED MILK 1 L", 2);
  const plain = deal("NEILSON 2% MILK 4 L", 5.75);
  const plan = planBasket(["milk"], { A: [flavoured, plain] }, { exclude: [flavoured.id] });
  assert.equal(plan.bestSingle.picks[0].name, "NEILSON 2% MILK 4 L");
});
