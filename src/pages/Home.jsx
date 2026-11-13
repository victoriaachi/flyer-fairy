import { useNavigate } from "react-router-dom";
import "../styles/Home.css";
import "../styles/global.css";

function Home() {
  const navigate = useNavigate();

  return (
    <main className="home">
      <div className="home-card">
        <div className="home-fairy" aria-hidden="true">
          🧚
        </div>
        <h1 className="home-title">Flyer Fairy</h1>
        <p className="home-tagline">
          This week's grocery deals near you, sorted and sprinkled with magic ✨
        </p>
        <button className="home-cta" onClick={() => navigate("/flyers")}>
          Unlock magical savings 💖
        </button>
      </div>
    </main>
  );
}

export default Home;
