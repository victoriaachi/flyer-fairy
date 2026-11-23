const stores = {
  "No Frills": 2332,
  "Food Basics": 2265,
  "T&T Supermarket": 6373,
  FreshCo: 2267,
  Loblaws: 2018,
  Costco: 2596,
};

const categories = {
  Produce: [
    "fruit", "vegetable", "veggie", "apple", "pineapple", "banana", "berry",
    "berries", "strawberries", "blueberries", "raspberries", "blackberries",
    "cranberries", "lettuce", "salad", "tomato", "potato", "sweet potato",
    "onion", "pepper", "mushroom", "mango", "spinach", "cauliflower",
    "broccoli", "melon", "watermelon", "cantaloupe", "squash", "pomegranate",
    "cherry", "cherries", "corn", "cucumber", "cabbage", "coconut", "papaya",
    "garlic", "romaine", "kale", "avocado", "grape", "orange", "mandarin",
    "clementine", "lemon", "lime", "pear", "peach", "plum", "kiwi", "carrot",
    "celery", "zucchini", "eggplant", "bok choy", "ginger", "herbs", "cilantro",
    "parsley", "asparagus", "beet", "radish", "yam", "leek", "persimmon",
  ],

  "Meat & Seafood": [
    "beef", "steak", "chicken", "pork", "turkey", "sausage", "bacon", "ham",
    "fish", "salmon", "shrimp", "seafood", "meat", "eel", "duck", "fillet",
    "roast", "ribs", "wings", "drumsticks", "thighs", "breast", "ground beef",
    "lamb", "veal", "salami", "pepperoni", "prosciutto", "deli", "hot dog",
    "wieners", "pepperettes", "burger", "patties", "tuna", "cod", "tilapia", "crab", "lobster",
    "scallops", "mussels", "squid", "tofu",
  ],

  "Dairy & Eggs": [
    "milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "sour cream",
    "egg", "cottage cheese", "dairy", "margarine", "kefir", "cream cheese",
    "whipped cream", "cool whip", "dessert topping",
  ],

  Bakery: [
    "bread", "bun", "roll", "bagel", "cake", "muffin", "pastry", "danish",
    "pie", "bakery", "croissant", "baguette", "naan", "pita", "loaf",
    "english muffin", "donut", "tart", "crescents",
  ],

  Frozen: [
    "corn dog", "corn dogs",
    "frozen", "ice cream", "popsicle", "frozen meal", "frozen pizza", "freeze",
    "gelato", "sorbet", "fries", "perogies", "dumplings",
  ],

  "Pantry & Staples": [
    "rice", "pasta", "spaghetti", "macaroni", "noodle", "flour", "sugar",
    "oats", "canned", "beans", "soup", "broth", "stock", "anise", "spice",
    "lard", "shortening", "baking", "jelly powder", "jello", "pudding",
    "peanut butter", "jam", "honey", "nutella", "salt", "lentils", "chickpeas",
    "tomato sauce", "kraft dinner", "mac & cheese", "mac and cheese",
  ],

  "Snacks & Candy": [
    "chips", "cracker", "crackers", "potato chips", "potato crisps", "tortilla chips", "crispers", "bits & bites", "cookie",
    "chocolate", "candy", "popcorn", "snack", "pistachios", "nuts", "almonds",
    "cashews", "pretzels", "gum", "gummies", "gummy", "bar", "granola bar",
    "protein bar", "clif bar", "shortbread", "gingerbread", "crispbread",
    "rice cakes", "doritos", "lays", "pringles", "oreo",
  ],

  Beverages: [
    "juice", "pop", "soda", "orange juice", "apple juice", "apple cider", "smoothie", "coffee", "tea", "water", "drink", "beverage",
    "sparkling", "protein shake", "kombucha", "coca-cola", "pepsi", "gatorade", "k-cup",
  ],

  "Sauces & Condiments": [
    "sauce", "ketchup", "mustard", "vegetable oil", "canola oil", "olive oil", "tomato paste", "pizza sauce", "mayonnaise", "dressing", "dip", "oil",
    "olive oil", "vinegar", "mayo", "salsa", "relish", "gravy", "soy sauce",
    "hot sauce", "syrup", "maple syrup", "pasta sauce",
  ],

  "Ready Made Meals": [
    "prepared", "meal kit", "sandwich", "pizza", "burrito", "lasagna",
    "sushi", "rotisserie", "entree", "dinner kit",
  ],

  "Breakfast Foods": [
    "cereal", "granola", "oatmeal", "pancake", "pancake mix", "waffle",
    "pop tarts", "rice krispies", "special k", "cheerios", "corn flakes",
  ],

  "Health & Wellness": [
    "vitamin", "supplement", "protein powder", "cough", "cold & flu",
    "sinus", "tablets", "capsules", "pain relief", "advil", "tylenol",
    "neocitran", "buckley's", "benylin", "allergy", "probiotic",
  ],

  "Household Supplies": [
    "paper towel", "toilet paper", "bathroom tissue", "tissue", "garbage bag",
    "cleaner", "detergent", "laundry", "dishwashing", "dish soap", "cling wrap",
    "plastic wrap", "foil", "zip bags", "ziploc", "batteries", "light bulbs",
    "scent boosters", "fabric softener", "dryer sheets", "dishwasher tablets", "bleach", "sponges",
    "food storage", "container", "sistema", "brita", "water filter",
    "windshield wash", "lysol", "tide", "downy",
  ],

  "Personal Care": [
    "shampoo", "conditioner", "soap", "body wash", "toothpaste", "toothbrush",
    "deodorant", "razor", "lotion", "haircare", "styling", "cotton swabs",
    "q-tips", "pads", "liners", "tampons", "mouthwash", "floss", "sunscreen",
    "cosmetics", "skincare", "petroleum jelly", "vaseline",
  ],

  Baby: ["diaper", "formula", "baby", "wipes"],

  Pets: [
    "dog food", "cat food", "pet", "kibble", "cat litter", "dog treats",
    "cat treats", "milk-bone", "temptations", "whiskas", "friskies", "purina",
    "pedigree", "iams", "fancy feast", "greenies", "meow mix",
  ],

  Alcohol: ["beer", "wine", "vodka", "liquor", "cider", "whisky", "rum"],

  "International Foods": [
    "asian", "mexican", "italian", "indian", "tortilla", "kimchi", "ramen",
    "miso", "curry", "taco",
  ],

  "Home & Seasonal": [
    "candle", "candles", "lights", "garland", "wreath", "ornament", "tree",
    "throw", "throws", "blanket", "pillow", "decor", "toy", "toys", "bear",
    "gift", "gift card", "wrapping paper", "christmas", "holiday", "towel",
    "bedding", "mug", "cookware", "pan", "kitchen", "cutting board", "bows",
    "barbie", "lego", "mega bloks", "mega blocks", "planters",
    "fruit of the loom", "socks", "underwear",
  ],

  Other: [],
};

module.exports = {
  stores,
  categories,
};
