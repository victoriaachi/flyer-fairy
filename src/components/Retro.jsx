// Little retro desktop pieces: windows, pixel icons, loading bar, menu bar.

import { useEffect, useState } from "react";

// ---------- Pixel icons ----------
// Each icon is a grid of characters; every letter is a colour, "." is empty.

const PALETTE = {
  D: "#5f7046", // dark matcha outline
  M: "#b5c99a", // matcha
  L: "#dceac9", // light matcha
  G: "#718355", // leaf green
  R: "#e8879f", // strawberry
  r: "#f3b3c3", // strawberry highlight
  W: "#fff6f8", // seed / paper
  P: "#f7d3dc", // pink paper
  Y: "#f4d98b", // sparkle gold
};

const ICONS = {
  strawberry: [
    "...G.G...",
    "..GGGGG..",
    ".RRRGRRR.",
    "RrRRRRWRR",
    "RRRWRRRRR",
    ".RRRRRWR.",
    ".RWRRRRR.",
    "..RRRWR..",
    "...RRR...",
  ],
  folder: [
    ".DDDD.......",
    "DMMMMDDDDDD.",
    "DMMMMMMMMMMD",
    "DLLLLLLLLLLD",
    "DLLLLLLLLLLD",
    "DLLLLLLLLLLD",
    "DLLLLLLLLLLD",
    "DDDDDDDDDDDD",
  ],
  "folder-open": [
    ".DDDD.......",
    "DMMMMDDDDDD.",
    "DMPPPPPPPPMD",
    "DMPWWWWWWPMD",
    "DDDDDDDDDDDDD",
    ".DLLLLLLLLLLD",
    ".DLLLLLLLLLD.",
    "DLLLLLLLLLLD.",
    "DDDDDDDDDDDD.",
  ],
  sparkle: [
    "...Y...",
    "...Y...",
    "..YYY..",
    "YYYWYYY",
    "..YYY..",
    "...Y...",
    "...Y...",
  ],
  basket: [
    "....DDDD....",
    "...D....D...",
    "..D......D..",
    "DDDDDDDDDDDD",
    "DRRMRRMRRMRD",
    ".DMMMMMMMMD.",
    ".DLMLMLMLMD.",
    "..DDDDDDDD..",
  ],
  "arrow-up": [
    "...DD...",
    "..DDDD..",
    ".DDDDDD.",
    "DDDDDDDD",
    "...DD...",
    "...DD...",
    "...DD...",
  ],
  arrow: [
    "....D...",
    "....DD..",
    "DDDDDDD.",
    "DDDDDDDD",
    "DDDDDDD.",
    "....DD..",
    "....D...",
  ],
  magnifier: [
    "..DDDD....",
    ".DLLLLD...",
    "DLWLLLLD..",
    "DLLLLLLD..",
    "DLLLLLLD..",
    ".DLLLLD...",
    "..DDDDDD..",
    "......DDD.",
    ".......DDD",
  ],
};

export function PixelIcon({ name, size = 22, className = "" }) {
  const rows = ICONS[name];
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const rects = [];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (PALETTE[ch]) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="1"
            height="1"
            fill={PALETTE[ch]}
          />,
        );
      }
    }),
  );
  return (
    <svg
      className={`pixel-icon ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      width={size}
      height={(size * height) / width}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rects}
    </svg>
  );
}

// ---------- Window ----------

export function Window({
  title,
  icon,
  className = "",
  children,
  tone = "green",
}) {
  return (
    <section className={`window window-${tone} ${className}`}>
      <div className="window-bar">
        {icon && <PixelIcon name={icon} size={16} />}
        <span className="window-title">{title}</span>
        <span className="window-buttons" aria-hidden="true">
          <span>_</span>
          <span>□</span>
          <span>×</span>
        </span>
      </div>
      <div className="window-body">{children}</div>
    </section>
  );
}

// ---------- Loading bar ----------

export function PixelLoader({ label }) {
  return (
    <div className="pixel-loader" role="status">
      <span className="pixel-loader-label">{label}</span>
      <span className="pixel-loader-bar" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </span>
    </div>
  );
}

// ---------- Menu bar ----------

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// items: [{ id, label, active, onClick }]
export function MenuBar({ items }) {
  const now = useClock();
  return (
    <nav className="menu-bar" aria-label="Main">
      <span className="menu-brand">
        <PixelIcon name="strawberry" size={18} />
        flyer fairy
      </span>
      <span className="menu-items">
        {items.map((item) => (
          <button
            key={item.id}
            className={`menu-item ${item.active ? "active" : ""}`}
            onClick={item.onClick}
            aria-current={item.active ? "page" : undefined}
          >
            {item.label}
          </button>
        ))}
      </span>
      <span className="menu-clock">
        {now.toLocaleDateString("en-CA", { weekday: "short" })}{" "}
        {now.toLocaleTimeString("en-CA", {
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </nav>
  );
}

// ---------- Background sparkles ----------

const SPARKLES = [
  { top: "12%", left: "4%", size: 18, delay: 0 },
  { top: "28%", left: "94%", size: 14, delay: 1.2 },
  { top: "55%", left: "2%", size: 12, delay: 2.1 },
  { top: "74%", left: "92%", size: 20, delay: 0.6 },
  { top: "90%", left: "8%", size: 14, delay: 1.7 },
  { top: "6%", left: "70%", size: 12, delay: 2.6 },
];

export function Sparkles() {
  return (
    <div className="sparkles" aria-hidden="true">
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="sparkle"
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }}
        >
          <PixelIcon name="sparkle" size={s.size} />
        </span>
      ))}
    </div>
  );
}

// ---------- Click sparkles ----------
// A tiny puff of pink pixels when you click a button or link. Skipped for
// people who've asked their OS for reduced motion.

const BURST_ANGLES = [45, 135, 225, 315];

export function ClickSparkles() {
  const [bursts, setBursts] = useState([]);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    let nextId = 0;
    function onPointerDown(e) {
      if (reduceMotion?.matches || e.button !== 0) return;
      if (!e.target.closest?.("button, a")) return;
      const id = nextId++;
      setBursts((list) => [
        ...list.slice(-2),
        { id, x: e.clientX, y: e.clientY },
      ]);
      setTimeout(
        () => setBursts((list) => list.filter((b) => b.id !== id)),
        450,
      );
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return bursts.map((b) => (
    <div
      key={b.id}
      className="click-burst"
      style={{ left: b.x, top: b.y }}
      aria-hidden="true"
    >
      {BURST_ANGLES.map((angle) => (
        <span key={angle} style={{ "--angle": `${angle}deg` }} />
      ))}
    </div>
  ));
}
