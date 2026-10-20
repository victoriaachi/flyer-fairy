import { useState } from "react";
import { useNavigate } from "react-router-dom";
import reactLogo from "../assets/react.svg";
import viteLogo from "../assets/vite.svg";
import heroImg from "../assets/hero.png";
import "../styles/Home.css";
import "../styles/global.css";

function Home() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  function handleClick() {
    console.log("deez nuts");
    navigate("/flyers");
  }

  return (
    <>
      <div className="hero">
        <button onClick={handleClick}>
          🧚✨ click to unlock magical savings
        </button>
      </div>
    </>
  );
}

export default Home;
