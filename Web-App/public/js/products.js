/** Fitted size options for caps that need a measured size (start at 7). */
export const CAP_SIZES = ["7", "7 1/8", "7 1/4", "7 3/8", "7 1/2", "7 5/8", "7 3/4", "7 7/8", "8"];

export const ADJUSTABLE_FIT = "Adjustable fit";

export function isValidCapSize(size) {
  const value = String(size || "").trim();
  return value === ADJUSTABLE_FIT || CAP_SIZES.includes(value);
}

export function hasSizeChoices(product) {
  return Array.isArray(product?.sizes) && product.sizes.length > 0;
}

export const PRODUCTS = [
  {
    id: "ch-black",
    name: "CH BLACK",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/ch-black.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "ch-blue",
    name: "CH BLUE",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/ch-blue.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "custom-made-ny",
    name: "CUSTOM MADE NY",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/custom-made-ny.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "iced-out-supreme",
    name: "ICED OUT SUPREME",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [...CAP_SIZES],
    image: "/assets/caps/iced-out-supreme.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "iced-out-supreme-black",
    name: "ICED OUT SUPREME BLACK",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [...CAP_SIZES],
    image: "/assets/caps/iced-out-supreme-black.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "la-camo",
    name: "LA CAMO",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/la-camo.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "la-green",
    name: "LA GREEN",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/la-green.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "mary-rude-awakenings",
    name: "MARY RUDE AWAKENINGS",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/mary-rude-awakenings.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "new-york-yankees-sky-blue",
    name: "NEW YORK YANKEES (SKY BLUE)",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [...CAP_SIZES],
    image: "/assets/caps/new-york-yankees-sky-blue.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "new-york-yankees-camo",
    name: "NEW YORK YANKEES CAMO",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [...CAP_SIZES],
    image: "/assets/caps/new-york-yankees-camo.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "ny-black",
    name: "NY BLACK",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/ny-black.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "ny-pink",
    name: "NY PINK",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/ny-pink.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "ny-realtree",
    name: "NY REALTREE",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [...CAP_SIZES],
    image: "/assets/caps/ny-realtree.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "ny-royal-blue",
    name: "NY ROYAL BLUE",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [...CAP_SIZES],
    image: "/assets/caps/ny-royal-blue.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "oma-studios",
    name: "oMA STUDIOS",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/oma-studios.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "realtree-sox",
    name: "REALTREE SOX",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [...CAP_SIZES],
    image: "/assets/caps/realtree-sox.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "reversed-stitch-rude",
    name: "REVERSED STITCH RUDE",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/reversed-stitch-rude.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "san-diego",
    name: "SAN DIEGO",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/san-diego.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "san-francisco",
    name: "SAN FRANCISCO",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/san-francisco.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "shohei-ohtani-red",
    name: "SHOHEI OHTANI RED",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/shohei-ohtani-red.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "skull-ny",
    name: "SKULL NY",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/skull-ny.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "triple-la",
    name: "TRIPLE LA",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/triple-la.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "triple-la-blue",
    name: "TRIPLE LA BLUE",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/triple-la-blue.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
  {
    id: "triple-ny",
    name: "TRIPLE NY",
    type: "FITTED",
    price: 950,
    stock: 10,
    sizes: [],
    image: "/assets/caps/triple-ny.jpg",
    description: "Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.",
  },
];

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

export function getStock(id) {
  return Math.max(0, Number(getProduct(id)?.stock) || 0);
}

export function isAvailable(id) {
  const product = getProduct(id);
  return Boolean(product) && product.available !== false && getStock(id) > 0;
}

export function applyStocks(stocks = {}) {
  PRODUCTS.forEach((product) => {
    if (Object.prototype.hasOwnProperty.call(stocks, product.id)) {
      product.stock = Math.max(0, Number(stocks[product.id]) || 0);
    }
  });
}

export function applyCatalog(catalog = {}) {
  PRODUCTS.forEach((product) => {
    const row = catalog[product.id];
    if (!row) return;
    if (row.price != null) product.price = Math.max(0, Number(row.price) || product.price);
    if (row.stock != null) product.stock = Math.max(0, Number(row.stock) || 0);
    product.available = row.available !== false;
    if (!Array.isArray(product.sizes)) product.sizes = [];
  });
}

export function productSizes(id) {
  const product = getProduct(id);
  return Array.isArray(product?.sizes) ? product.sizes : [];
}

export function formatPrice(amount) {
  return `₱${Number(amount).toLocaleString("en-PH")}`;
}
