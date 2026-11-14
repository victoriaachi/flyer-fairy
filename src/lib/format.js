// Shared by the flyer, search and grocery list views.

export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function toTitleCase(str) {
  return String(str || "")
    .toLowerCase()
    .split(" ")
    .map((word) =>
      word.includes("kg") || word.includes("ml") || word.includes("pc")
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

export function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}

// "No Frills and FreshCo", "No Frills, FreshCo and Loblaws"
export function joinNames(names) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
