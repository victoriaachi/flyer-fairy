import { useNavigate } from "react-router-dom";
import "../styles/Home.css";
import "../styles/global.css";

function Home() {
  const navigate = useNavigate();

  return (
    <main className="home">
      <div className="home-card">
        <p className="home-eyebrow">Weekly grocery deals</p>
        <h1 className="home-title">Flyer Fairy</h1>
        <p className="home-tagline">
          Every flyer near you, sorted into aisles, so you can see what's worth buying this week.
        </p>
        <button className="home-cta" onClick={() => navigate("/flyers")}>
          Browse this week's flyers
        </button>
      </div>
    </main>
  );
}

export default Home;
