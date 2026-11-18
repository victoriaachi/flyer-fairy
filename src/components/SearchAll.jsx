import { useEffect, useState } from "react";
import axios from "axios";
import { API, formatPrice, plural, toTitleCase } from "../lib/format";
import { PixelLoader, Window } from "./Retro";

const SUGGESTIONS = ["eggs", "chicken thigh", "salmon", "apples", "butter"];

// Searches every store's flyer at once and lists matches cheapest first.
export default function SearchAll({ stores, postal, ready, nearbyStores }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ key: null });

  const q = query.trim();
  const key = `${postal}|${q.toLowerCase()}`;

  useEffect(() => {
    if (!ready || !q) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/api/search`, {
          params: { q, postal },
        });
        if (!cancelled) setResult({ key, status: "ready", data: res.data });
      } catch (err) {
        if (!cancelled) {
          setResult({
            key,
            status: "error",
            error: err.response?.data?.error || "Search failed. Try again?",
          });
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, q, postal, ready]);

  const current =
    result.key === key ? result : { status: q && ready ? "loading" : "idle" };
  const data = current.status === "ready" ? current.data : null;
  const storesWithDeals = data
    ? stores.filter((s) => data.byStore[s]?.length)
    : [];
  const cheapest = data?.results[0];

  return (
    <Window
      title="search_every_store.exe"
      icon="magnifier"
      className="search-all"
    >
      <div className="search-wrap">
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          className="search-input"
          placeholder="Search by item"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search every store"
          disabled={!ready}
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {!ready && (
        <p className="search-summary">Enter your postal code to search.</p>
      )}

      {ready && !q && (
        <p className="search-summary">
          Try{" "}
          {SUGGESTIONS.map((s, i) => (
            <span key={s}>
              <button className="text-button" onClick={() => setQuery(s)}>
                {s}
              </button>
              {i < SUGGESTIONS.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      {current.status === "loading" && (
        <PixelLoader label="Checking every store" />
      )}
      {current.status === "error" && (
        <p className="flyer-error">{current.error}</p>
      )}

      {data && (
        <>
          <p className="search-summary">
            {cheapest
              ? `${plural(data.total, "deal")} at ${plural(
                  storesWithDeals.length,
                  "store",
                )}. Cheapest is ${formatPrice(cheapest.price)} at ${
                  cheapest.store
                }.`
              : `Nothing matching "${data.query}" is on sale this week.`}
          </p>

          {cheapest && (
            <ul className="store-summary">
              {stores.map((store) => {
                const matches = data.byStore[store] || [];
                const km = nearbyStores[store]?.distanceKm;
                return (
                  <li key={store} className={matches.length ? "" : "none"}>
                    <span className="store-summary-name">{store}</span>
                    <span className="store-summary-detail">
                      {data.failed.includes(store)
                        ? "Couldn't load"
                        : matches.length
                          ? `${plural(matches.length, "deal")}, from ${formatPrice(
                              matches[0].price,
                            )}`
                          : "Nothing on sale"}
                      {km != null && `, ${km} km`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {cheapest && (
            <div className="item-grid search-grid">
              {data.results.map((item, i) => (
                <article
                  className={`item-card ${i === 0 ? "best" : ""}`}
                  key={`${item.store}-${item.id}`}
                >
                  <div className="item-store">
                    {item.store}
                    {i === 0 && <span className="best-tag">Cheapest</span>}
                  </div>
                  <div className="item-image-wrap">
                    <img
                      className="item-image"
                      src={item.image}
                      alt={toTitleCase(item.name)}
                      loading="lazy"
                    />
                  </div>
                  <div className="item-name">{toTitleCase(item.name)}</div>
                  <div className="item-price">{formatPrice(item.price)}</div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </Window>
  );
}
