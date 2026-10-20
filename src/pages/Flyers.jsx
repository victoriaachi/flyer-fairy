import { useState } from "react";
import { useNavigate } from "react-router-dom";
import reactLogo from "../assets/react.svg";
import viteLogo from "../assets/vite.svg";
import heroImg from "../assets/hero.png";
import "../styles/Flyers.css";
import "../styles/global.css";
import axios from "axios";

function Flyers() {
  const [count, setCount] = useState(0);
  const [storeName, setStoreName] = useState("");
  const [items, setItems] = useState({});
  const [loaded, setLoaded] = useState(true);
  const [openCategory, setOpenCategory] = useState(null);

  const navigate = useNavigate();

  function toTitleCase(str) {
    let titleWord = str
      .toLowerCase() // 1. Lowercase everything first
      .split(" ") // 2. Split the string into an array of words
      .map(
        (word) =>
          word.includes("kg") || word.includes("ml") || word.includes("pc")
            ? word.toUpperCase()
            : word.charAt(0).toUpperCase() + // 3. Capitalize the first letter
              word.slice(1) // 4. Append the rest of the word
      )
      .join(" "); // 5. Join the words back with spaces
    return titleWord;
  }

  async function backToTop() {
    console.log("scroll ");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleClick(store) {
    setLoaded(false);
    if (!store) {
      setLoaded(true);
      navigate("/");
      return;
    }
    setStoreName(store);
    console.log("balls");
    console.log("store", store);
    try {
      const res = await axios.get(`http://localhost:8000/api/flyers/${store}`);
      console.log("res", res);
      // const items = res.data.message.filter(
      //   (item) => Number(item.price) != 0 && Number(item.price) < 50
      // );

      setItems(res.data.message);
      setLoaded(true);
    } catch (error) {
      console.log(error);
      setLoaded(true);
    }
  }

  return (
    <>
      <div className="hero">
        <p> 🧚✨ Where should the fairy fly today?</p>
        <button onClick={() => handleClick()}>GO back</button>
        <button onClick={() => handleClick("No Frills")}> No Frills</button>
        <button onClick={() => handleClick("T&T Supermarket")}>
          {" "}
          T&T Supermarket
        </button>
        <button onClick={() => handleClick("FreshCo")}> FreshCo</button>
        <button onClick={() => handleClick("Loblaws")}> Loblaws</button>
        <button onClick={() => handleClick("Costco")}> Costco</button>
        {loaded && storeName != "" && (
          <button
            className="back-to-top-btn"
            onClick={() => backToTop()}
            id="backToTopBtn"
            title="Go to top"
          >
            Back to Top ⬆️
          </button>
        )}
      </div>
      {!loaded && <p>🧚✨ Sprinkling some savings magic...</p>}
      {loaded && storeName != "" && (
        <>
          <div>
            <h1>{storeName}</h1>
            <table className="flyer-table">
              <thead>
                <tr className="flyer-header">
                  <th>Image</th>
                  <th>Name</th>
                  <th>Price</th>
                </tr>
              </thead>

              <tbody>
                {Object.entries(items).map(([category, categoryItems]) => (
                  <>
                    <tr
                      className="category-header"
                      onClick={() =>
                        setOpenCategory(
                          openCategory === category ? null : category
                        )
                      }
                    >
                      <th colSpan="3">
                        {category} ({categoryItems.length})
                      </th>
                    </tr>
                    {openCategory === category &&
                      categoryItems.map((item) => (
                        <tr className="flyer-row" key={item.id}>
                          <td className="flyer-image-cell">
                            <img
                              className="flyer-image"
                              src={item.cutout_image_url}
                              alt={toTitleCase(item.name)}
                            />
                          </td>

                          <td className="flyer-name">
                            {toTitleCase(item.name)}
                          </td>

                          <td className="flyer-price">
                            ${Number(item.price).toFixed(2)}
                          </td>
                        </tr>
                      ))}{" "}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default Flyers;
