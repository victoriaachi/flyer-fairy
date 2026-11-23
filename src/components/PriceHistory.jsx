import { useEffect, useState } from "react";
import axios from "axios";
import { API, formatPrice, toTitleCase } from "../lib/format";
import { PixelIcon, PixelLoader, Window } from "./Retro";

const SUGGESTIONS = ["eggs", "milk", "butter", "salmon", "chicken thigh"];

// fixed colour per store, checked for contrast and colourblind safety on the cream background
const STORE_COLORS = {
  "No Frills": "#d0627f",
  "T&T Supermarket": "#4e8a26",
  FreshCo: "#3f7fc2",
  Loblaws: "#b87908",
  Costco: "#8a64c8",
};

// draw at the real width so text stays readable on phones
function useWidth() {
  const [el, setEl] = useState(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width];
}

function formatWeek(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function niceMax(value) {
  const steps = [1, 2, 2.5, 5, 10];
  const magnitude = 10 ** Math.floor(Math.log10(value || 1));
  for (const s of steps) if (s * magnitude >= value) return s * magnitude;
  return 10 * magnitude;
}

function HistoryChart({ stores, weeks }) {
  const [hover, setHover] = useState(null);
  const [plotRef, width] = useWidth();
  const narrow = width < 480;
  const CHART = {
    width: Math.max(width, 280),
    height: narrow ? 220 : 260,
    top: 16,
    right: narrow ? 100 : 116,
    bottom: 34,
    left: 44,
  };
  const plotW = CHART.width - CHART.left - CHART.right;
  const plotH = CHART.height - CHART.top - CHART.bottom;

  const prices = weeks.flatMap((w) =>
    stores.map((s) => w.stores[s]?.price).filter((p) => p != null),
  );
  const yMax = niceMax(Math.max(...prices) * 1.1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);

  const x = (i) =>
    CHART.left +
    (weeks.length === 1 ? plotW / 2 : (i / (weeks.length - 1)) * plotW);
  const y = (price) => CHART.top + plotH - (price / yMax) * plotH;
  const columnW = weeks.length === 1 ? plotW : plotW / (weeks.length - 1);

  const series = stores
    .map((store) => ({
      store,
      points: weeks
        .map((w, i) =>
          w.stores[store] ? { i, price: w.stores[store].price } : null,
        )
        .filter(Boolean),
    }))
    .filter((s) => s.points.length);

  // store names at the end of each line, nudged apart so they dont overlap
  const labels = series
    .map((s) => {
      const last = s.points[s.points.length - 1];
      return { store: s.store, y: y(last.price), x: x(last.i) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 15) labels[i].y = labels[i - 1].y + 15;
  }

  const hovered = hover != null ? weeks[hover] : null;

  return (
    <div className="history-chart">
      <ul className="history-legend">
        {series.map((s) => (
          <li key={s.store}>
            <span
              className="legend-swatch"
              style={{ background: STORE_COLORS[s.store] }}
            />
            {s.store}
          </li>
        ))}
      </ul>

      <div className="history-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-label="Cheapest price at each store by flyer week"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                className="grid-line"
                x1={CHART.left}
                x2={CHART.left + plotW}
                y1={y(t)}
                y2={y(t)}
              />
              <text
                className="axis-label"
                x={CHART.left - 8}
                y={y(t) + 4}
                textAnchor="end"
              >
                ${t % 1 ? t.toFixed(2) : t}
              </text>
            </g>
          ))}

          {weeks.map((w, i) => (
            <text
              key={w.week}
              className="axis-label"
              x={x(i)}
              y={CHART.height - 10}
              textAnchor="middle"
            >
              {formatWeek(w.week)}
            </text>
          ))}

          {hover != null && (
            <line
              className="crosshair"
              x1={x(hover)}
              x2={x(hover)}
              y1={CHART.top}
              y2={CHART.top + plotH}
            />
          )}

          {series.map((s) => (
            <g key={s.store}>
              {s.points.length > 1 && (
                <polyline
                  className="series-line"
                  stroke={STORE_COLORS[s.store]}
                  points={s.points
                    .map((p) => `${x(p.i)},${y(p.price)}`)
                    .join(" ")}
                />
              )}
              {s.points.map((p) => (
                <circle
                  key={p.i}
                  className="series-dot"
                  cx={x(p.i)}
                  cy={y(p.price)}
                  r={hover === p.i ? 6 : 4.5}
                  fill={STORE_COLORS[s.store]}
                />
              ))}
            </g>
          ))}

          {labels.map((l) => (
            <text key={l.store} className="line-label" x={l.x + 12} y={l.y + 4}>
              {l.store}
            </text>
          ))}

          {weeks.map((w, i) => (
            <rect
              key={w.week}
              className="hit-area"
              x={x(i) - columnW / 2}
              y={CHART.top}
              width={columnW}
              height={plotH}
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {hovered && (
          <div
            className={`chart-tooltip ${
              x(hover) / CHART.width < 0.3
                ? "align-left"
                : x(hover) / CHART.width > 0.7
                  ? "align-right"
                  : ""
            }`}
            style={{ left: `${(x(hover) / CHART.width) * 100}%` }}
            role="status"
          >
            <div className="tooltip-title">
              Week of {formatWeek(hovered.week)}
            </div>
            {stores
              .filter((s) => hovered.stores[s])
              .sort((a, b) => hovered.stores[a].price - hovered.stores[b].price)
              .map((s) => (
                <div className="tooltip-row" key={s}>
                  <span
                    className="legend-swatch"
                    style={{ background: STORE_COLORS[s] }}
                  />
                  <span className="tooltip-store">{s}</span>
                  <span className="tooltip-price">
                    {formatPrice(hovered.stores[s].price)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PriceHistory({ postal, ready }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [result, setResult] = useState({ key: null });

  const key = `${postal}|${submitted.toLowerCase()}`;

  function runSearch(text) {
    setQuery(text);
    setSubmitted(text.trim());
  }

  useEffect(() => {
    if (!ready || !submitted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/history`, {
          params: { q: submitted, postal },
        });
        if (!cancelled) setResult({ key, status: "ready", data: res.data });
      } catch (err) {
        if (!cancelled) {
          setResult({
            key,
            status: "error",
            error:
              err.response?.data?.error ||
              "Couldn't load price history. Try again?",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, submitted, postal, ready]);

  const current =
    result.key === key
      ? result
      : { status: submitted && ready ? "loading" : "idle" };
  const data = current.status === "ready" ? current.data : null;
  const weeks = data?.weeks || [];
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const change =
    thisWeek && lastWeek
      ? thisWeek.cheapest.price - lastWeek.cheapest.price
      : null;

  return (
    <Window title="price_history.log" icon="chart" tone="pink" className="price-history">
      <form
        className="search-wrap"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
      >
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          className="search-input"
          placeholder="Track the price of an item"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Item to see price history for"
          disabled={!ready}
        />
        {query && (
          <button
            type="button"
            className="search-clear has-go"
            onClick={() => runSearch("")}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
        <button
          type="submit"
          className="search-go"
          disabled={!ready || !query.trim()}
          aria-label="Show price history"
        >
          <PixelIcon name="arrow" size={16} />
        </button>
      </form>

      {!ready && (
        <p className="search-summary">
          Enter your postal code to see price history.
        </p>
      )}

      {ready && !submitted && !query && (
        <p className="search-summary">
          Try{" "}
          {SUGGESTIONS.map((s, i) => (
            <span key={s}>
              <button
                className="suggestion-button"
                onClick={() => runSearch(s)}
              >
                {s}
              </button>
              {i < SUGGESTIONS.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      {current.status === "loading" && (
        <PixelLoader label="Reading saved prices" />
      )}
      {current.status === "error" && (
        <p className="flyer-error">{current.error}</p>
      )}

      {data && weeks.length === 0 && (
        <p className="search-summary">
          No saved prices for "{data.query}" near you yet. Prices get saved
          every week, so check back soon.
        </p>
      )}

      {thisWeek && (
        <>
          <div className="history-headline">
            <span className="history-headline-label">Cheapest this week</span>
            <span className="history-headline-price">
              {formatPrice(thisWeek.cheapest.price)}
            </span>
            <span className="history-headline-store">
              at {thisWeek.cheapest.store}
              {change != null &&
                (Math.abs(change) < 0.005
                  ? ", same as last week"
                  : `, ${change < 0 ? "down" : "up"} ${formatPrice(Math.abs(change))} from last week`)}
            </span>
          </div>

          <HistoryChart stores={data.stores} weeks={weeks} />

          {weeks.length === 1 && (
            <p className="search-summary">
              This is the first saved week. A new point gets added each week, so
              the lines fill in over time.
            </p>
          )}

          <div className="compare-scroll history-table">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Week of</th>
                  {data.stores.map((s) => (
                    <th scope="col" key={s}>
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...weeks].reverse().map((w) => (
                  <tr key={w.week}>
                    <th scope="row">{formatWeek(w.week)}</th>
                    {data.stores.map((s) => {
                      const cell = w.stores[s];
                      return (
                        <td
                          key={s}
                          className={
                            cell && w.cheapest.store === s ? "lowest" : ""
                          }
                          title={cell ? toTitleCase(cell.name) : ""}
                        >
                          {cell ? formatPrice(cell.price) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Window>
  );
}
