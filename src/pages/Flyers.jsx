import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Flyers.css";
import "../styles/global.css";
import axios from "axios";

const STORES = ["No Frills", "T&T Supermarket", "FreshCo", "Loblaws", "Costco"];

const CATEGORY_EMOJI = {
  Produce: "🍓",
  "Meat & Seafood": "🍗",
  "Dairy & Eggs": "🥛",
  Bakery: "🥐",
  Frozen: "🧊",
  "Pantry & Staples": "🍝",
  "Snacks & Candy": "🍬",
  Beverages: "🧃",
  "Sauces & Condiments": "🍯",
  "Ready Made Meals": "🍱",
  "Breakfast Foods": "🥞",
  "Health & Wellness": "💊",
  "Household Supplies": "🧼",
  "Personal Care": "🧴",
  Baby: "🍼",
  Pets: "🐾",
  Alcohol: "🍷",
  "International Foods": "🌏",
  "Home & Seasonal": "🎀",
  Other: "✨",
};

// How far down the page before the Back to Top button appears.
const BACK_TO_TOP_AFTER_PX = 400;

function Flyers() {
  const [storeName, setStoreName] = useState("");
  const [items, setItems] = useState({});
  const [loaded, setLoaded] = useState(true);
  const [openCategory, setOpenCategory] = useState(null);
  const [flyer, setFlyer] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  // Ignore responses from an older click if the user picked another store.
  const requestId = useRef(0);
  const [postalCode, setPostalCode] = useState(() => {
    try {
      return localStorage.getItem("postalCode") || "L3R 3G7";
    } catch {
      return "L3R 3G7";
    }
  });

  const navigate = useNavigate();

  const postalCodeValid = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(
    postalCode.trim()
  );

  useEffect(() => {
    function onScroll() {
      setShowBackToTop(window.scrollY > BACK_TO_TOP_AFTER_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // While searching, keep only matching items and drop empty categories.
  const query = search.trim().toLowerCase();
  const visibleCategories = useMemo(() => {
    const entries = Object.entries(items);
    if (!query) return entries;
    const words = query.split(/\s+/);
    return entries
      .map(([category, list]) => [
        category,
        list.filter((item) => {
          const name = (item.name || "").toLowerCase();
          return words.every((w) => name.includes(w));
        }),
      ])
      .filter(([, list]) => list.length > 0);
  }, [items, query]);
  const matchCount = visibleCategories.reduce((n, [, l]) => n + l.length, 0);

  function handlePostalChange(value) {
    setPostalCode(value.toUpperCase());
    try {
      localStorage.setItem("postalCode", value.toUpperCase());
    } catch {
      // storage unavailable; ignore
    }
  }

  function formatDate(iso, withYear = false) {
    // Use the date part only so the day doesn't shift with the viewer's timezone
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  }

  function toTitleCase(str) {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) =>
        word.includes("kg") || word.includes("ml") || word.includes("pc")
          ? word.toUpperCase()
          : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ");
  }

  function backToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleClick(store) {
    if (!postalCodeValid) {
      setError("Please enter a valid postal code, like L3R 3G7.");
      return;
    }
    setLoaded(false);
    setStoreName(store);
    setError("");
    setOpenCategory(null);
    const thisRequest = ++requestId.current;
    const postal = postalCode.trim();
    loadLocation(store, postal, thisRequest);
    try {
      const res = await axios.get(
        `http://localhost:8000/api/flyers/${encodeURIComponent(store)}`,
        { params: { postal } }
      );
      if (thisRequest !== requestId.current) return;

      setItems(res.data.message);
      setFlyer(res.data.flyer || null);
      setItemCount(res.data.itemCount || 0);
      setLoaded(true);
    } catch (error) {
      console.log(error);
      if (thisRequest !== requestId.current) return;
      setItems({});
      setFlyer(null);
      setItemCount(0);
      setError(
        error.response?.data?.error || "Couldn't load flyers. Try again?"
      );
      setLoaded(true);
    }
  }

  async function loadLocation(store, postal, thisRequest) {
    setLocation(null);
    setLocationLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:8000/api/location/${encodeURIComponent(store)}`,
        { params: { postal } }
      );
      if (thisRequest === requestId.current) setLocation(res.data);
    } catch {
      if (thisRequest === requestId.current) {
        setLocation({
          found: false,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${store} near ${postal}`
          )}`,
        });
      }
    } finally {
      if (thisRequest === requestId.current) setLocationLoading(false);
    }
  }

  return (
    <div className="flyers-page">
      <header className="page-header">
        <button className="home-link" onClick={() => navigate("/")}>
          ← Home
        </button>
        <h1 className="page-title">Flyer Fairy</h1>
        <p className="page-subtitle">
          🧚 Where should the fairy fly today? ✨
        </p>
      </header>

      <section className="controls-card">
        <div className="postal-row">
          <label htmlFor="postalCode">📍 Your postal code</label>
          <input
            id="postalCode"
            className={`postal-input ${postalCodeValid ? "" : "invalid"}`}
            value={postalCode}
            maxLength={7}
            placeholder="L3R 3G7"
            onChange={(e) => handlePostalChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && storeName) handleClick(storeName);
            }}
          />
        </div>
        <div className="store-chips">
          {STORES.map((store) => (
            <button
              key={store}
              className={`store-chip ${storeName === store ? "active" : ""}`}
              onClick={() => handleClick(store)}
            >
              {store}
            </button>
          ))}
        </div>
      </section>

      {!loaded && (
        <p className="loading">🧚✨ Sprinkling some savings magic...</p>
      )}
      {loaded && error && <p className="flyer-error">{error}</p>}

      {loaded && !error && storeName !== "" && (
        <section className="results">
          {!flyer ? (
            <p className="flyer-empty">
              No current {storeName} flyers near {postalCode}.
            </p>
          ) : (
            <div className="flyer-info">
              {flyer.merchantLogo && (
                <img
                  className="flyer-logo"
                  src={flyer.merchantLogo}
                  alt={`${flyer.merchant} logo`}
                />
              )}
              <div className="flyer-info-text">
                <h2 className="flyer-store">{storeName}</h2>
                <div className="flyer-week">
                  🗓️ {formatDate(flyer.validFrom)} –{" "}
                  {formatDate(flyer.validTo, true)}
                </div>

                <div className="flyer-location">
                  {locationLoading && (
                    <span className="flyer-meta shimmer">
                      📍 Finding your nearest {storeName}...
                    </span>
                  )}
                  {!locationLoading && location?.found && (
                    <>
                      <div className="flyer-store-name">
                        📍 {location.name}
                        {location.distanceKm != null && (
                          <span className="flyer-distance">
                            {" "}
                            · {location.distanceKm} km away
                          </span>
                        )}
                      </div>
                      {location.address && (
                        <div className="flyer-meta">{location.address}</div>
                      )}
                    </>
                  )}
                  {!locationLoading && location && !location.found && (
                    <span className="flyer-meta">
                      📍 Couldn't pin down the exact store near {postalCode}
                    </span>
                  )}
                </div>

                <div className="flyer-actions">
                  {!locationLoading && location?.mapsUrl && (
                    <a
                      className="maps-link"
                      href={location.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      🗺️{" "}
                      {location.found
                        ? "Open in Google Maps"
                        : `Find ${storeName} on Google Maps`}
                    </a>
                  )}
                  <span className="flyer-count">
                    💖 {itemCount} items on sale
                  </span>
                </div>
              </div>
            </div>
          )}

          {flyer && (
            <div className="search-wrap">
              <span className="search-icon" aria-hidden="true">
                🔍
              </span>
              <input
                type="search"
                className="search-input"
                placeholder="Search deals... strawberries, milk, chips"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search items"
              />
              {search && (
                <button
                  className="search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {flyer && query && (
            <p className="search-summary">
              {matchCount === 0
                ? `No deals match "${search.trim()}" 🥺`
                : `${matchCount} deal${matchCount === 1 ? "" : "s"} matching "${search.trim()}"`}
            </p>
          )}

          <div className="categories">
            {visibleCategories.map(([category, categoryItems]) => {
              // Searching opens every category that has matches.
              const isOpen = query !== "" || openCategory === category;
              return (
                <Fragment key={category}>
                  <button
                    className={`category-header ${isOpen ? "open" : ""}`}
                    onClick={() =>
                      setOpenCategory(
                        openCategory === category ? null : category
                      )
                    }
                    aria-expanded={isOpen}
                  >
                    <span className="category-emoji">
                      {CATEGORY_EMOJI[category] || "✨"}
                    </span>
                    <span className="category-name">{category}</span>
                    <span className="category-count">
                      {categoryItems.length}
                    </span>
                    <span className="category-chevron">⌄</span>
                  </button>
                  {isOpen && (
                    <div className="item-grid">
                      {categoryItems.map((item) => (
                        <article className="item-card" key={item.id}>
                          <div className="item-image-wrap">
                            <img
                              className="item-image"
                              src={item.cutout_image_url}
                              alt={toTitleCase(item.name)}
                              loading="lazy"
                            />
                          </div>
                          <div className="item-name">
                            {toTitleCase(item.name)}
                          </div>
                          <div className="item-price">
                            ${Number(item.price).toFixed(2)}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </section>
      )}

      <button
        className={`back-to-top-btn ${showBackToTop ? "visible" : ""}`}
        onClick={backToTop}
        title="Go to top"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        ↑ Top
      </button>
    </div>
  );
}

export default Flyers;
