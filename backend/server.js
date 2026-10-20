const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { stores, categories } = require("./data/data");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 8000;

app.get("/api/test", (req, res) => {
  res.json({
    message: "Hello from backend!",
    success: true,
  });
});

async function getCurrentFlyers(name) {
  let response;
  let storeData;
  let url = `https://dam.flippenterprise.net/api/flipp/data?locale=en&postal_code=L3R3G7&sid=7927696267820832`;
  try {
    response = await axios.get(url);
    console.log("url", url);
    // console.log(response.data);
    // console.log("response", response.data);
    storeData = response.data.flyers.filter((item) => item.merchant === name);
    // console.log("storeData", storeData);
  } catch (error) {
    console.log("error!", error.message);
  }
  //   console.log("hi");
  return storeData;
}

async function categorizeItems(items) {
  let categorizedItems = {
    Produce: [],
    "Meat & Seafood": [],
    "Dairy & Eggs": [],
    Bakery: [],
    Frozen: [],
    "Pantry & Staples": [],
    "Snacks & Candy": [],
    Beverages: [],
    "Sauces & Condiments": [],
    "Ready Made Meals": [],
    "Breakfast Foods": [],
    "Health & Wellness": [],
    "Household Supplies": [],
    "Personal Care": [],
    Baby: [],
    Pets: [],
    Alcohol: [],
    "International Foods": [],
    Other: [],
  };

  for (let item in items) {
    if (Number(items[item].price) === 0 || Number(items[item].price) > 50) {
      continue;
    }

    const itemName = items[item].name.toLowerCase();
    let foundMatch = false;

    for (let category in categories) {
      for (let subcategory in categories[category]) {
        const groceryName = categories[category][subcategory].toLowerCase();

        if (itemName.includes(groceryName)) {
          categorizedItems[category].push(items[item]);
          foundMatch = true;
          break;
        }
      }

      if (foundMatch) {
        break;
      }
    }

    if (!foundMatch) {
      categorizedItems["Other"].push(items[item]);
    }
  }

  return categorizedItems;
}

app.get("/api/flyers/:store", async (req, res) => {
  //   console.log("req", req.params);
  const store = req.params.store;
  //   console.log("stores", stores);

  let data = await getCurrentFlyers(store);
  //   console.log("data", data);
  //   const flyerId = stores[store];
  //   console.log("flyerId", flyerId);
  const flyerIds = data.map((item) => item.id);
  //   console.log("flyerIds", flyerIds);
  let message = [];
  try {
    for (const flyerId of flyerIds) {
      const url = `https://dam.flippenterprise.net/api/flipp/flyers/${flyerId}/flyer_items?locale=en`;

      //   console.log(url);

      const response = await axios.get(url);
      console.log("ebfore mesage");
      message.push(...response.data);
      console.log("message1");
    }
    const categorizedResponse = await categorizeItems(message);
    console.log("categorizedResponse", categorizedResponse["Produce"][1]);
    console.log("message 1", message[0]);
    res.json({
      message: categorizedResponse,
      success: true,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      error: "Failed to fetch flyers",
    });
  }
});

app.listen(PORT, () => {
  console.log("bombaclatt backend ");
  console.log(`Server running on port ${PORT}`);
});
