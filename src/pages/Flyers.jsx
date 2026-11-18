import {
  Fragment,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/Flyers.css";
import "../styles/global.css";
import axios from "axios";
import SearchAll from "../components/SearchAll";
import GroceryList from "../components/GroceryList";
import { API, toTitleCase } from "../lib/format";
import { MenuBar, PixelIcon, PixelLoader, Window } from "../components/Retro";

const STORES = ["No Frills", "T&T Supermarket", "FreshCo", "Loblaws", "Costco"];

// How far down the page before the Back to Top button appears.
const BACK_TO_TOP_AFTER_PX = 400;

const VIEWS = [
  { id: "browse", label: "Browse a store" },
  { id: "search", label: "Search by item" },
  { id: "list", label: "Grocery list" },
];

// Canadian postal codes never use D, F, I, O, Q or U, and W/Z never start one.
const POSTAL_CODE_RE =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

function normalizePostal(value) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function mapsSearchUrl(store, postal) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${store} near ${postal}`,
  )}`;
}

// One request per postal code for every store's nearest branch, shared by the
// background prefetch and store clicks so nothing is looked up twice.
const locationRequests = new Map();
function fetchAllLocations(postal) {
  if (!locationRequests.has(postal)) {
    const request = axios
      .get(`${API}/api/locations`, { params: { postal } })
      .then((res) => res.data);
    request.catch(() => locationRequests.delete(postal));
    locationRequests.set(postal, request);
  }
  return locationRequests.get(postal);
}

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
  // Result of the server check for a postal code: "unknown" | "valid".
  const [postalCheck, setPostalCheck] = useState({ postal: null });
  // Background lookup of every store's nearest branch for a postal code.
  const [nearbyResult, setNearbyResult] = useState({ postal: null });
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
  const [searchParams, setSearchParams] = useSearchParams();
  const view = VIEWS.some((v) => v.id === searchParams.get("view"))
    ? searchParams.get("view")
    : "browse";

  function changeView(id) {
    setSearchParams(id === "browse" ? {} : { view: id });
  }

  const postal = normalizePostal(postalCode);
  const postalCodeValid = POSTAL_CODE_RE.test(postalCode.trim());

  // "incomplete" | "invalid" | "checking" | "unknown" | "valid"
  const formatProblem =
    postal.length < 6
      ? "incomplete"
      : !POSTAL_CODE_RE.test(postal)
        ? "invalid"
        : null;
  const postalStatus =
    formatProblem ??
    (postalCheck.postal === postal ? postalCheck.status : "checking");
  const postalPlace = postalCheck.postal === postal ? postalCheck.place : "";
  const nearby =
    nearbyResult.postal === postal
      ? nearbyResult
      : {
          status: postalStatus === "valid" ? "loading" : "idle",
          stores: {},
        };

  // When the postal code changes while a store is open, reload it for the
  // new area. An effect event so it always sees the latest store.
  const reloadOpenStore = useEffectEvent(() => {
    if (storeName) handleClick(storeName);
  });

  // As soon as a full postal code is typed: check it's real, then start
  // finding every store's nearest branch in the background.
  useEffect(() => {
    if (postal.length < 6 || !POSTAL_CODE_RE.test(postal)) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      let place = "";
      try {
        const res = await axios.get(`${API}/api/postal/${postal}`);
        place = [res.data.city, res.data.province].filter(Boolean).join(", ");
      } catch (err) {
        if (cancelled) return;
        const status = err.response?.status;
        if (status === 404 || status === 400) {
          setPostalCheck({ postal, status: "unknown" });
          return;
        }
        // Backend unreachable: don't block the user over it.
      }
      if (cancelled) return;
      setPostalCheck({ postal, status: "valid", place });
      reloadOpenStore();

      try {
        const data = await fetchAllLocations(postal);
        if (!cancelled) {
          setNearbyResult({
            postal,
            status: "ready",
            stores: data.stores || {},
          });
        }
      } catch {
        if (!cancelled)
          setNearbyResult({ postal, status: "error", stores: {} });
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [postal]);

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

  function formatDate(iso) {
    // Use the date part only so the day doesn't shift with the viewer's timezone
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function backToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleClick(store) {
    if (!postalCodeValid) {
      setError("Please enter a valid postal code.");
      return;
    }
    if (postalStatus === "unknown") {
      setError("We couldn't find that postal code.");
      return;
    }
    setLoaded(false);
    setStoreName(store);
    setError("");
    setOpenCategory(null);
    const thisRequest = ++requestId.current;
    loadLocation(store, postal, thisRequest);
    try {
      const res = await axios.get(
        `${API}/api/flyers/${encodeURIComponent(store)}`,
        { params: { postal } },
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
        error.response?.data?.error || "Couldn't load flyers. Try again?",
      );
      setLoaded(true);
    }
  }

  // Usually instant: the background lookup started when the postal code was
  // entered, so this just waits for (or reuses) that same request.
  async function loadLocation(store, postal, thisRequest) {
    setLocation(null);
    setLocationLoading(true);
    try {
      const data = await fetchAllLocations(postal);
      if (thisRequest === requestId.current) {
        setLocation(
          data.stores?.[store] || {
            found: false,
            mapsUrl: mapsSearchUrl(store, postal),
          },
        );
      }
    } catch {
      if (thisRequest === requestId.current) {
        setLocation({ found: false, mapsUrl: mapsSearchUrl(store, postal) });
      }
    } finally {
      if (thisRequest === requestId.current) setLocationLoading(false);
    }
  }

  const foundCount = Object.values(nearby.stores).filter((l) => l.found).length;
  const postalMessage = {
    incomplete: "",
    invalid: "That doesn't look like a Canadian postal code.",
    checking: "Checking postal code",
    unknown: "We couldn't find that postal code.",
    valid:
      nearby.status === "loading"
        ? `Looking up stores near ${postalPlace || postalCode.trim()}`
        : nearby.status === "ready"
          ? `Found ${foundCount} stores near ${postalPlace || postalCode.trim()}`
          : postalPlace,
  }[postalStatus];

  return (
    <div className="flyers-page">
      <MenuBar
        items={[
          { id: "home", label: "Home", onClick: () => navigate("/") },
          ...VIEWS.map((v) => ({
            id: v.id,
            label: v.label,
            active: view === v.id,
            onClick: () => changeView(v.id),
          })),
        ]}
      />

      <header className="page-header">
        <h1 className="page-title">Flyer Fairy</h1>
        <p className="page-subtitle">Grocery deals near you!</p>
      </header>

      <Window
        title="find_stores.exe"
        icon="magnifier"
        className="controls-card"
      >
        <div className="postal-row">
          <label htmlFor="postalCode">Postal code</label>
          <input
            id="postalCode"
            className={`postal-input ${
              postalStatus === "invalid" || postalStatus === "unknown"
                ? "invalid"
                : ""
            }`}
            aria-describedby="postalStatus"
            value={postalCode}
            maxLength={7}
            placeholder="L3R 3G7"
            onChange={(e) => handlePostalChange(e.target.value)}
          />
        </div>
        <p
          id="postalStatus"
          className={`postal-status ${postalStatus}`}
          aria-live="polite"
        >
          {postalMessage || "\u00a0"}
        </p>
        {view === "browse" && (
          <div className="store-chips">
            {STORES.map((store) => {
              const nearest = nearby.stores[store];
              return (
                <button
                  key={store}
                  className={`store-chip ${storeName === store ? "active" : ""}`}
                  onClick={() => handleClick(store)}
                >
                  {store}
                  {nearest?.found && nearest.distanceKm != null && (
                    <span className="chip-distance">
                      {nearest.distanceKm} km
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Window>

      <div className="view-panel" key={view}>
        {view === "search" && (
          <SearchAll
            stores={STORES}
            postal={postal}
            ready={postalStatus === "valid"}
            nearbyStores={nearby.stores}
          />
        )}
        {view === "list" && (
          <GroceryList
            stores={STORES}
            postal={postal}
            ready={postalStatus === "valid"}
            nearbyStores={nearby.stores}
          />
        )}

        {view === "browse" && (
          <>
            {!loaded && <PixelLoader label="Loading flyers" />}
            {loaded && error && <p className="flyer-error">{error}</p>}

            {loaded && !error && storeName !== "" && (
              <section className="results">
                {!flyer ? (
                  <p className="flyer-empty">
                    No current {storeName} flyers near {postalCode}.
                  </p>
                ) : (
                  <Window
                    title={`${storeName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_flyer.txt`}
                    icon="strawberry"
                    tone="pink"
                    className="flyer-window"
                  >
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
                          On sale {formatDate(flyer.validFrom)} to{" "}
                          {formatDate(flyer.validTo)}
                        </div>

                        <div className="flyer-location">
                          {locationLoading && (
                            <span className="flyer-meta shimmer">
                              Looking up the closest {storeName}
                            </span>
                          )}
                          {!locationLoading && location?.found && (
                            <>
                              <div className="flyer-store-name">
                                {location.name}
                                {location.distanceKm != null && (
                                  <span className="flyer-distance">
                                    , {location.distanceKm} km away
                                  </span>
                                )}
                              </div>
                              {location.address && (
                                <div className="flyer-meta">
                                  {location.address}
                                </div>
                              )}
                            </>
                          )}
                          {!locationLoading && location && !location.found && (
                            <span className="flyer-meta">
                              Couldn't pin down the exact store near{" "}
                              {postalCode}
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
                              {location.found
                                ? "Open in Google Maps"
                                : `Search for ${storeName} on Google Maps`}
                            </a>
                          )}
                          <span className="flyer-count">
                            {itemCount} items on sale
                          </span>
                        </div>
                      </div>
                    </div>
                  </Window>
                )}

                {flyer && (
                  <div className="search-wrap">
                    <svg
                      className="search-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                      type="search"
                      className="search-input"
                      placeholder="Search"
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
                      ? `No deals match "${search.trim()}"`
                      : `${matchCount} deal${matchCount === 1 ? "" : "s"} matching "${search.trim()}"`}
                  </p>
                )}

                {visibleCategories.length > 0 && (
                  <Window
                    title="aisles"
                    icon="folder"
                    className="categories-window"
                  >
                    <div className="categories">
                      {visibleCategories.map(([category, categoryItems]) => {
                        // Searching opens every category that has matches.
                        const isOpen =
                          query !== "" || openCategory === category;
                        return (
                          <Fragment key={category}>
                            <button
                              className={`category-header ${isOpen ? "open" : ""}`}
                              onClick={() =>
                                setOpenCategory(
                                  openCategory === category ? null : category,
                                )
                              }
                              aria-expanded={isOpen}
                            >
                              <PixelIcon
                                name={isOpen ? "folder-open" : "folder"}
                                size={22}
                                className="category-folder"
                              />
                              <span className="category-name">{category}</span>
                              <span className="category-count">
                                {categoryItems.length}
                              </span>
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
                  </Window>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <button
        className={`back-to-top-btn ${showBackToTop ? "visible" : ""}`}
        onClick={backToTop}
        title="Go to top"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        ↑
      </button>
    </div>
  );
}

export default Flyers;
