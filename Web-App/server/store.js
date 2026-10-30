const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "users.json");
const INVENTORY_FILE = path.join(DATA_DIR, "inventory.json");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.json");
const SALES_FILE = path.join(DATA_DIR, "sales.json");
const WALLETS_FILE = path.join(DATA_DIR, "wallets.json");

const PAY_METHODS = ["GCash", "Maya", "BPI"];
const DEFAULT_WALLET = { GCash: 8000, Maya: 5500, BPI: 20000 };
const CAP_SIZES = ["7", "7 1/8", "7 1/4", "7 3/8", "7 1/2", "7 5/8", "7 3/4", "7 7/8", "8"];
const ADJUSTABLE_FIT = "Adjustable fit";
const VALID_FITS = new Set([...CAP_SIZES, ADJUSTABLE_FIT]);

const DEFAULT_CATALOG = {
  "ch-black": { name: "CH BLACK", type: "FITTED", price: 950 },
  "ch-blue": { name: "CH BLUE", type: "FITTED", price: 950 },
  "custom-made-ny": { name: "CUSTOM MADE NY", type: "FITTED", price: 950 },
  "iced-out-supreme": { name: "ICED OUT SUPREME", type: "FITTED", price: 950 },
  "iced-out-supreme-black": { name: "ICED OUT SUPREME BLACK", type: "FITTED", price: 950 },
  "la-camo": { name: "LA CAMO", type: "FITTED", price: 950 },
  "la-green": { name: "LA GREEN", type: "FITTED", price: 950 },
  "mary-rude-awakenings": { name: "MARY RUDE AWAKENINGS", type: "FITTED", price: 950 },
  "new-york-yankees-sky-blue": { name: "NEW YORK YANKEES (SKY BLUE)", type: "FITTED", price: 950 },
  "new-york-yankees-camo": { name: "NEW YORK YANKEES CAMO", type: "FITTED", price: 950 },
  "ny-black": { name: "NY BLACK", type: "FITTED", price: 950 },
  "ny-pink": { name: "NY PINK", type: "FITTED", price: 950 },
  "ny-realtree": { name: "NY REALTREE", type: "FITTED", price: 950 },
  "ny-royal-blue": { name: "NY ROYAL BLUE", type: "FITTED", price: 950 },
  "oma-studios": { name: "oMA STUDIOS", type: "FITTED", price: 950 },
  "realtree-sox": { name: "REALTREE SOX", type: "FITTED", price: 950 },
  "reversed-stitch-rude": { name: "REVERSED STITCH RUDE", type: "FITTED", price: 950 },
  "san-diego": { name: "SAN DIEGO", type: "FITTED", price: 950 },
  "san-francisco": { name: "SAN FRANCISCO", type: "FITTED", price: 950 },
  "shohei-ohtani-red": { name: "SHOHEI OHTANI RED", type: "FITTED", price: 950 },
  "skull-ny": { name: "SKULL NY", type: "FITTED", price: 950 },
  "triple-la": { name: "TRIPLE LA", type: "FITTED", price: 950 },
  "triple-la-blue": { name: "TRIPLE LA BLUE", type: "FITTED", price: 950 },
  "triple-ny": { name: "TRIPLE NY", type: "FITTED", price: 950 },
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
  }
  if (!fs.existsSync(INVENTORY_FILE)) {
    const stocks = {};
    Object.keys(DEFAULT_CATALOG).forEach((id) => {
      stocks[id] = 10;
    });
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(stocks, null, 2));
  }
  if (!fs.existsSync(CATALOG_FILE)) {
    const catalog = {};
    Object.entries(DEFAULT_CATALOG).forEach(([id, row]) => {
      catalog[id] = { price: row.price, available: true };
    });
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
  }
  if (!fs.existsSync(SALES_FILE)) {
    fs.writeFileSync(SALES_FILE, JSON.stringify({ orders: [] }, null, 2));
  }
  if (!fs.existsSync(WALLETS_FILE)) {
    fs.writeFileSync(WALLETS_FILE, JSON.stringify({}, null, 2));
  }
}

function readJson(file, fallback) {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureStore();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readStore() {
  return readJson(DATA_FILE, { users: [] });
}

function writeStore(store) {
  writeJson(DATA_FILE, store);
}

function findUserByEmail(email) {
  const store = readStore();
  return store.users.find((u) => u.email === String(email).toLowerCase());
}

function saveUser(user) {
  const store = readStore();
  const idx = store.users.findIndex((u) => u.id === user.id);
  if (idx >= 0) store.users[idx] = user;
  else store.users.push(user);
  writeStore(store);
  return user;
}

function allUsers() {
  return readStore().users;
}

function readInventory() {
  return readJson(INVENTORY_FILE, {});
}

function writeInventory(stocks) {
  writeJson(INVENTORY_FILE, stocks);
}

function getInventory() {
  return readInventory();
}

function readCatalogOverrides() {
  return readJson(CATALOG_FILE, {});
}

function writeCatalogOverrides(catalog) {
  writeJson(CATALOG_FILE, catalog);
}

function getCatalogMap() {
  const saved = readCatalogOverrides();
  const stocks = readInventory();
  const map = {};
  Object.entries(DEFAULT_CATALOG).forEach(([id, base]) => {
    const row = saved[id] || {};
    map[id] = {
      id,
      name: base.name,
      type: base.type,
      price: Math.max(0, Number(row.price ?? base.price) || 950),
      available: row.available !== false,
      stock: Math.max(0, Number(stocks[id]) || 0),
    };
  });
  return map;
}

function updateCatalogItem({ id, price, stock, available }) {
  const map = getCatalogMap();
  if (!map[id]) return { ok: false, error: "Unknown cap." };
  const saved = readCatalogOverrides();
  saved[id] = saved[id] || { price: map[id].price, available: true };
  if (price != null && price !== "") {
    const nextPrice = Number(price);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      return { ok: false, error: "Enter a valid price." };
    }
    saved[id].price = Math.round(nextPrice * 100) / 100;
  }
  if (available != null) saved[id].available = Boolean(available);
  writeCatalogOverrides(saved);
  if (stock != null && stock !== "") {
    const nextStock = Number(stock);
    if (!Number.isInteger(nextStock) || nextStock < 0) {
      return { ok: false, error: "Stock must be a whole number of 0 or more." };
    }
    const stocks = readInventory();
    stocks[id] = nextStock;
    writeInventory(stocks);
  }
  return { ok: true, catalog: getCatalogMap() };
}

function purchaseInventory(items = []) {
  const stocks = readInventory();
  const catalog = getCatalogMap();
  for (const item of items) {
    const id = String(item.id || "");
    const qty = Math.max(0, Number(item.qty) || 0);
    if (!id || qty < 1) continue;
    const product = catalog[id];
    if (!product) return { ok: false, error: "That cap is not in stock.", stocks };
    if (!product.available) {
      return { ok: false, error: `${product.name} is unavailable.`, stocks };
    }
    if (product.stock < qty) {
      return {
        ok: false,
        error: `Only ${product.stock} piece${product.stock === 1 ? "" : "s"} left for this cap.`,
        stocks,
      };
    }
  }
  for (const item of items) {
    const id = String(item.id || "");
    const qty = Math.max(0, Number(item.qty) || 0);
    if (!id || qty < 1) continue;
    stocks[id] = Math.max(0, Number(stocks[id]) - qty);
  }
  writeInventory(stocks);
  return { ok: true, stocks };
}

function readWallets() {
  return readJson(WALLETS_FILE, {});
}

function getWallet(userId) {
  const wallets = readWallets();
  const saved = wallets[userId] || {};
  return {
    GCash: Number.isFinite(Number(saved.GCash)) ? Number(saved.GCash) : DEFAULT_WALLET.GCash,
    Maya: Number.isFinite(Number(saved.Maya)) ? Number(saved.Maya) : DEFAULT_WALLET.Maya,
    BPI: Number.isFinite(Number(saved.BPI)) ? Number(saved.BPI) : DEFAULT_WALLET.BPI,
  };
}

function saveWallet(userId, wallet) {
  const wallets = readWallets();
  wallets[userId] = wallet;
  writeJson(WALLETS_FILE, wallets);
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString("en-PH")}`;
}

function makeReceiptNo() {
  return `CC-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function readSales() {
  const data = readJson(SALES_FILE, { orders: [] });
  return Array.isArray(data.orders) ? data.orders : [];
}

function writeSales(orders) {
  writeJson(SALES_FILE, { orders });
}

function appendSale(order) {
  const orders = readSales();
  orders.push(order);
  writeSales(orders);
}

function checkoutOrder({ items = [], buyer = {}, method, user, paymentProof = "" }) {
  const catalog = getCatalogMap();
  const stocks = readInventory();
  const lines = [];
  let total = 0;

  const qtyById = {};
  for (const item of items) {
    const id = String(item.id || "");
    const size = String(item.size || "").trim();
    const qty = Math.max(0, Number(item.qty) || 0);
    if (!id || qty < 1) continue;
    const product = catalog[id];
    if (!product) return { ok: false, error: "That cap is not in the catalog.", stocks };
    if (!product.available) {
      return { ok: false, error: `${product.name} is unavailable.`, stocks };
    }
    if (!VALID_FITS.has(size)) {
      return { ok: false, error: `Choose a valid size/fit for ${product.name}.`, stocks };
    }
    qtyById[id] = (qtyById[id] || 0) + qty;
    if (product.stock < qtyById[id]) {
      return {
        ok: false,
        error: `Only ${product.stock} piece${product.stock === 1 ? "" : "s"} left for ${product.name}.`,
        stocks,
      };
    }
    lines.push({
      id,
      name: product.name,
      type: product.type,
      size,
      qty,
      price: product.price,
    });
    total += product.price * qty;
  }

  if (!lines.length) return { ok: false, error: "Your cart is empty.", stocks };
  if (!PAY_METHODS.includes(method)) {
    return { ok: false, error: "Choose GCash, Maya, or BPI.", stocks };
  }

  const wallet = getWallet(user.id);
  const balance = Number(wallet[method]) || 0;
  if (balance < total) {
    return {
      ok: false,
      error: `${method} balance is ${formatPeso(balance)}. This order is ${formatPeso(total)}.`,
      stocks,
      wallet,
    };
  }

  for (const line of lines) {
    stocks[line.id] = Math.max(0, Number(stocks[line.id]) - line.qty);
  }
  writeInventory(stocks);

  const nextWallet = { ...wallet, [method]: Math.round((balance - total) * 100) / 100 };
  saveWallet(user.id, nextWallet);

  const proof = String(paymentProof || "").trim();
  if (proof && (!proof.startsWith("data:image/") || proof.length > 900000)) {
    return {
      ok: false,
      error: "Payment proof must be an image under 650KB.",
      stocks,
      wallet,
    };
  }

  const order = {
    id: makeReceiptNo(),
    createdAt: new Date().toISOString(),
    userId: user.id,
    userEmail: user.email,
    buyer: {
      name: String(buyer.name || "").trim(),
      contact: String(buyer.contact || "").trim(),
      address: String(buyer.address || "").trim(),
    },
    method,
    items: lines,
    total,
    walletBefore: balance,
    walletAfter: nextWallet[method],
    paymentProof: proof || undefined,
  };
  appendSale(order);

  return {
    ok: true,
    stocks,
    order,
    wallet: nextWallet,
    catalog: getCatalogMap(),
  };
}

function localDateKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function periodRange(period, dateStr) {
  const d = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) {
    return periodRange(period);
  }
  d.setHours(0, 0, 0, 0);
  if (period === "weekly") {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: start, to: endOfDay(end) };
  }
  if (period === "monthly") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: start, to: endOfDay(end) };
  }
  if (period === "quarterly") {
    const q = Math.floor(d.getMonth() / 3) * 3;
    const start = new Date(d.getFullYear(), q, 1);
    const end = new Date(d.getFullYear(), q + 3, 0);
    return { from: start, to: endOfDay(end) };
  }
  if (period === "yearly") {
    const start = new Date(d.getFullYear(), 0, 1);
    const end = new Date(d.getFullYear(), 11, 31);
    return { from: start, to: endOfDay(end) };
  }
  return { from: d, to: endOfDay(d) };
}

function summarizeOrders(orders) {
  const pieces = orders.reduce(
    (sum, order) => sum + order.items.reduce((line, item) => line + (item.qty || 0), 0),
    0
  );
  const revenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  return { count: orders.length, pieces, revenue };
}

function getSalesReport({ period = "monthly", date } = {}) {
  const range = periodRange(period, date);
  const orders = readSales().filter((order) => {
    const t = new Date(order.createdAt).getTime();
    return t >= range.from.getTime() && t <= range.to.getTime();
  });
  const byDay = {};
  orders.forEach((order) => {
    const key = localDateKey(order.createdAt);
    if (!byDay[key]) byDay[key] = { date: key, orders: [] };
    byDay[key].orders.push(order);
  });
  Object.values(byDay).forEach((day) => {
    Object.assign(day, summarizeOrders(day.orders));
  });
  return {
    period,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    totals: summarizeOrders(orders),
    orders,
    byDay,
  };
}

function getSalesCalendar({ year, month } = {}) {
  const now = new Date();
  const y = Number(year) || now.getFullYear();
  const m = Number(month) || now.getMonth() + 1;
  const start = new Date(y, m - 1, 1);
  const end = endOfDay(new Date(y, m, 0));
  const days = {};
  readSales().forEach((order) => {
    const t = new Date(order.createdAt).getTime();
    if (t < start.getTime() || t > end.getTime()) return;
    const key = localDateKey(order.createdAt);
    if (!days[key]) days[key] = { date: key, orders: [] };
    days[key].orders.push(order);
  });
  Object.values(days).forEach((day) => {
    Object.assign(day, summarizeOrders(day.orders));
  });
  return { year: y, month: m, days };
}

module.exports = {
  findUserByEmail,
  saveUser,
  allUsers,
  getInventory,
  purchaseInventory,
  getCatalogMap,
  updateCatalogItem,
  getWallet,
  checkoutOrder,
  getSalesReport,
  getSalesCalendar,
  PAY_METHODS,
};
