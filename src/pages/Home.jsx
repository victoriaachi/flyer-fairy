import { useNavigate } from "react-router-dom";
import "../styles/Home.css";
import "../styles/global.css";
import { PixelIcon, Window } from "../components/Retro";

const SHORTCUTS = [
  { icon: "folder", label: "Browse a store", to: "/flyers" },
  { icon: "magnifier", label: "Search by item", to: "/flyers?view=search" },
  { icon: "basket", label: "Grocery list", to: "/flyers?view=list" },
];

function Home() {
  const navigate = useNavigate();

  return (
    <main className="home">
      <Window
        title="welcome.txt"
        icon="strawberry"
        tone="pink"
        className="home-card"
      >
        <PixelIcon name="strawberry" size={44} className="home-berry" />
        <h1 className="home-title">Flyer Fairy</h1>
        <p className="home-tagline">
          This week's grocery flyers from stores near you!
        </p>
        <button className="primary-button" onClick={() => navigate("/flyers")}>
          See this week's flyers
        </button>
      </Window>

      <ul className="desktop-icons">
        {SHORTCUTS.map((s) => (
          <li key={s.label}>
            <button className="desktop-icon" onClick={() => navigate(s.to)}>
              <PixelIcon name={s.icon} size={44} />
              <span>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default Home;
