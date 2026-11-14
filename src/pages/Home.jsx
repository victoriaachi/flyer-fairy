import { useNavigate } from "react-router-dom";
import "../styles/Home.css";
import "../styles/global.css";

function Home() {
  const navigate = useNavigate();

  return (
    <main className="home">
      <div className="home-card">
        <h1 className="home-title">Flyer Fairy</h1>
        <p className="home-tagline">
          This week's grocery flyers from stores near you!
        </p>
        <button className="home-cta" onClick={() => navigate("/flyers")}>
          See this week's flyers
        </button>
      </div>
    </main>
  );
}

export default Home;
