import { useState } from "react";
import axios from "axios";
import {
  API,
  formatPrice,
  joinNames,
  plural,
  toTitleCase,
} from "../lib/format";

const STORAGE_KEY = "groceryList";
const EXAMPLE_LIST = ["eggs", "milk", "bread", "apples", "chicken thigh"];

function loadList() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable; the list just won't be remembered
  }
}

// Write a grocery list, get the cheapest way to buy it from this week's
// flyers: one store, two stores, or every store.
export default function GroceryList({ stores, postal, ready, nearbyStores }) {
  const [list, setList] = useState(loadList);
  const [draft, setDraft] = useState("");
  // Flyer items the shopper said aren't what they meant.
  const [exclude, setExclude] = useState([]);
  const [plan, setPlan] = useState({ status: "idle" });
  const [chosen, setChosen] = useState(null); // "single" | "pair" | "cheapest"

  function updateList(next) {
    setList(next);
    saveList(next);
  }

  function addItems(text) {
    // Accept "eggs, milk, bread" pasted in one go.
    const added = text
      .split(/[,\n]/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !list.includes(t));
    if (added.length) updateList([...list, ...new Set(added)]);
    setDraft("");
  }

  function removeItem(term) {
    updateList(list.filter((t) => t !== term));
  }

  async function runPlan(nextExclude = exclude) {
    if (!list.length || !ready) return;
    setPlan((p) => ({ ...p, status: "loading" }));
    try {
      const res = await axios.post(`${API}/api/basket`, {
        postal,
        items: list,
        exclude: nextExclude,
      });
      setPlan({ status: "ready", data: res.data, list: [...list], postal });
    } catch (err) {
      setPlan({
        status: "error",
        error:
          err.response?.data?.error ||
          "Couldn't work out your list. Try again?",
      });
    }
  }

  function findCheapest() {
    setExclude([]);
    setChosen(null);
    runPlan([]);
  }

  function skipItem(id) {
    const next = [...exclude, id];
    setExclude(next);
    runPlan(next);
  }

  function resetSkipped() {
    setExclude([]);
    runPlan([]);
  }

  const data = plan.data;
  const outOfDate =
    data && (plan.postal !== postal || plan.list.join("|") !== list.join("|"));

  // Recommend splitting only when the backend says it's worth it.
  const options = data
    ? [
        data.bestSingle && {
          id: "single",
          label: "One stop",
          trip: data.bestSingle,
        },
        data.bestPair && {
          id: "pair",
          label: "Two stops",
          trip: data.bestPair,
        },
        data.cheapest &&
          data.cheapest.stores.length > 2 && {
            id: "cheapest",
            label: `Every deal (${data.cheapest.stores.length} stops)`,
            trip: data.cheapest,
          },
      ].filter(Boolean)
    : [];
  const recommended = data?.bestPair ? "pair" : "single";
  const selected =
    options.find((o) => o.id === chosen) ||
    options.find((o) => o.id === recommended);
  const listSize = data?.items.length || 0;

  const distance = (store) => {
    const km = nearbyStores[store]?.distanceKm;
    return km != null ? `${km} km` : null;
  };

  return (
    <section className="grocery-list">
      <form
        className="list-form"
        onSubmit={(e) => {
          e.preventDefault();
          addItems(draft);
        }}
      >
        <input
          className="search-input list-input"
          placeholder="Add an item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Add an item to your list"
        />
        <button type="submit" disabled={!draft.trim()}>
          Add
        </button>
      </form>

      {list.length === 0 ? (
        <p className="search-summary">
          Your list is empty.{" "}
          <button
            className="text-button"
            onClick={() => updateList(EXAMPLE_LIST)}
          >
            Start with an example list
          </button>
        </p>
      ) : (
        <ul className="list-chips">
          {list.map((term) => (
            <li key={term}>
              {term}
              <button
                className="chip-remove"
                onClick={() => removeItem(term)}
                aria-label={`Remove ${term}`}
              >
                ✕
              </button>
            </li>
          ))}
          <li className="list-clear">
            <button className="text-button" onClick={() => updateList([])}>
              Clear list
            </button>
          </li>
        </ul>
      )}

      <div className="list-actions">
        <button
          className="primary-button"
          onClick={findCheapest}
          disabled={!list.length || !ready || plan.status === "loading"}
        >
          {data && !outOfDate ? "Recalculate" : "Cheapest way to buy this list"}
        </button>
        {!ready && (
          <span className="flyer-meta">Enter your postal code first.</span>
        )}
        {outOfDate && (
          <span className="flyer-meta">Your list changed since this plan.</span>
        )}
      </div>

      {plan.status === "loading" && (
        <p className="loading">Pricing your list at every store</p>
      )}
      {plan.status === "error" && <p className="flyer-error">{plan.error}</p>}

      {data && plan.status !== "loading" && (
        <div className="plan">
          <div className="plan-options">
            {options.map((option) => (
              <button
                key={option.id}
                className={`plan-option ${
                  selected?.id === option.id ? "selected" : ""
                }`}
                onClick={() => setChosen(option.id)}
                aria-pressed={selected?.id === option.id}
              >
                <span className="plan-option-label">
                  {option.label}
                  {option.id === recommended && (
                    <span className="best-tag">Best</span>
                  )}
                </span>
                <span className="plan-option-total">
                  {formatPrice(option.trip.total)}
                </span>
                <span className="plan-option-stores">
                  {joinNames(option.trip.stores)}
                </span>
                <span className="plan-option-meta">
                  {option.trip.covered} of {listSize} items
                  {option.trip.savings > 0 &&
                    `, saves ${formatPrice(option.trip.savings)}`}
                </span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="plan-picks">
              {selected.trip.stores.map((store) => {
                const picks = selected.trip.picks.filter(
                  (p) => p.store === store,
                );
                const subtotal = picks.reduce((n, p) => n + p.price, 0);
                return (
                  <div className="plan-store" key={store}>
                    <h3 className="plan-store-name">
                      {store}
                      {distance(store) && (
                        <span className="flyer-distance">
                          , {distance(store)}
                        </span>
                      )}
                      <span className="plan-store-total">
                        {formatPrice(subtotal)}
                      </span>
                    </h3>
                    <ul>
                      {picks.map((pick) => (
                        <li className="plan-pick" key={pick.term}>
                          <img src={pick.image} alt="" loading="lazy" />
                          <div className="plan-pick-text">
                            <span className="plan-pick-term">{pick.term}</span>
                            <span className="plan-pick-name">
                              {toTitleCase(pick.name)}
                            </span>
                          </div>
                          <span className="item-price">
                            {formatPrice(pick.price)}
                          </span>
                          <button
                            className="text-button skip-button"
                            onClick={() => skipItem(pick.id)}
                            title="Use the next cheapest match instead"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {selected.trip.missing.length > 0 && (
                <p className="plan-missing">
                  Not on sale here this week: {selected.trip.missing.join(", ")}
                </p>
              )}
            </div>
          )}

          {exclude.length > 0 && (
            <p className="search-summary">
              Skipped {plural(exclude.length, "match", "matches")}.{" "}
              <button className="text-button" onClick={resetSkipped}>
                Undo
              </button>
            </p>
          )}

          <h3 className="compare-title">Every store side by side</h3>
          <div className="compare-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  {stores.map((store) => (
                    <th scope="col" key={store}>
                      {store}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const prices = stores
                    .map((s) => row.byStore[s]?.price)
                    .filter((p) => p != null);
                  const low = prices.length ? Math.min(...prices) : null;
                  return (
                    <tr key={row.term}>
                      <th scope="row">{row.term}</th>
                      {stores.map((store) => {
                        const match = row.byStore[store];
                        return (
                          <td
                            key={store}
                            className={
                              match && match.price === low ? "lowest" : ""
                            }
                            title={match ? toTitleCase(match.name) : ""}
                          >
                            {match ? formatPrice(match.price) : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  {stores.map((store) => {
                    const trip = data.singleStores.find(
                      (t) => t.stores[0] === store,
                    );
                    return (
                      <td key={store}>
                        {trip ? formatPrice(trip.total) : "-"}
                        {trip && (
                          <span className="compare-covered">
                            {trip.covered} of {listSize}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {data.notOnSale.length > 0 && (
            <p className="plan-missing">
              Nothing on sale anywhere for: {data.notOnSale.join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
