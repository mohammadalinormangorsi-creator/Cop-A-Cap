import {
  PRODUCTS,
  getProduct,
  getStock,
  isAvailable,
  applyStocks,
  applyCatalog,
  formatPrice,
  productSizes,
  isValidCapSize,
  hasSizeChoices,
  ADJUSTABLE_FIT,
} from "./products.js";
import { lettersOnlyName, isValidPhMobile } from "./validation.js";

const CART_KEY = "copacap_cart";
const BUYER_KEY = "copacap_buyer";
const LAST_ORDER_KEY = "copacap_last_order";

let WALLET = { GCash: 8000, Maya: 5500, BPI: 20000 };

export function getWallet() {
  return WALLET;
}

export function applyWallet(wallet = {}) {
  WALLET = {
    GCash: Number(wallet.GCash) || 0,
    Maya: Number(wallet.Maya) || 0,
    BPI: Number(wallet.BPI) || 0,
  };
}

export function getCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => ({
        id: item.id,
        size: String(item.size || "").trim(),
        qty: Math.max(0, Number(item.qty) || 0),
      }))
      .filter((item) => item.id && item.size && item.qty > 0);
  } catch {
    return [];
  }
}

export function setCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function cartCount() {
  return getCart().reduce((sum, item) => sum + (item.qty || 1), 0);
}

function cartLineQty(productId, excludeSize = null) {
  return getCart()
    .filter((item) => item.id === productId && item.size !== excludeSize)
    .reduce((sum, item) => sum + (item.qty || 0), 0);
}

function resolveCartSize(productId, size) {
  const product = getProduct(productId);
  if (!product) return "";
  if (!hasSizeChoices(product)) return ADJUSTABLE_FIT;
  const value = String(size || "").trim();
  return productSizes(productId).includes(value) ? value : "";
}

export function addToCart(productId, size, qty = 1) {
  const product = getProduct(productId);
  if (!product || !isAvailable(productId)) return getCart();
  const resolved = resolveCartSize(productId, size);
  if (!resolved || !isValidCapSize(resolved)) return getCart();
  const stock = getStock(productId);
  if (stock < 1) return getCart();
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId && item.size === resolved);
  const otherQty = cartLineQty(productId, resolved);
  const nextQty = Math.min(stock - otherQty, (existing?.qty || 0) + qty);
  if (nextQty < 1) return getCart();
  if (existing) existing.qty = nextQty;
  else cart.push({ id: productId, size: resolved, qty: nextQty });
  setCart(cart);
  return cart;
}

export function clearCart() {
  setCart([]);
}

export function removeFromCart(productId, size) {
  setCart(getCart().filter((item) => !(item.id === productId && item.size === size)));
  return getCart();
}

export function setCartQty(productId, size, qty) {
  const otherQty = cartLineQty(productId, size);
  const next = Math.min(getStock(productId) - otherQty, Math.max(0, Number(qty) || 0));
  if (next < 1) return removeFromCart(productId, size);
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId && item.size === size);
  if (existing) existing.qty = next;
  setCart(cart);
  return cart;
}

function clampCartToStock() {
  const next = [];
  const used = {};
  getCart().forEach((item) => {
    const product = getProduct(item.id);
    if (!product) return;
    const size = resolveCartSize(item.id, item.size);
    if (!size || !isValidCapSize(size)) return;
    const stock = getStock(item.id);
    const already = used[item.id] || 0;
    const qty = Math.min(stock - already, Math.max(0, item.qty || 1));
    if (qty < 1) return;
    used[item.id] = already + qty;
    next.push({ id: item.id, size, qty });
  });
  setCart(next);
}

function fitLabel(productId, size) {
  const product = getProduct(productId);
  if (!hasSizeChoices(product)) return ADJUSTABLE_FIT;
  return size ? `Size ${size}` : "Select size";
}

function stockLabel(id) {
  const product = getProduct(id);
  if (product?.available === false) return "Unavailable";
  const stock = getStock(id);
  if (stock < 1) return "Sold out";
  return `${stock} available`;
}

export async function loadInventory(apiFn) {
  try {
    const data = await apiFn("/api/catalog");
    applyCatalog(data.catalog || {});
  } catch {
    try {
      const data = await apiFn("/api/inventory");
      applyStocks(data.stocks || {});
    } catch {
      /* keep catalog defaults */
    }
  }
  clampCartToStock();
}

export async function loadWallet(apiFn) {
  try {
    const data = await apiFn("/api/wallet");
    applyWallet(data.wallet || {});
  } catch {
    /* keep defaults */
  }
}

function getLastOrder() {
  try {
    return JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) || "null");
  } catch {
    return null;
  }
}

function setLastOrder(order) {
  sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
}

function getBuyer() {
  try {
    return JSON.parse(sessionStorage.getItem(BUYER_KEY) || "{}");
  } catch {
    return {};
  }
}

function setBuyer(details) {
  sessionStorage.setItem(BUYER_KEY, JSON.stringify(details));
}

export function parseShopPath(path) {
  if (path === "/app") return { page: "home" };
  if (path === "/app/shop") return { page: "shop" };
  if (path === "/app/checkout") return { page: "checkout" };
  if (path === "/app/pay") return { page: "pay" };
  if (path === "/app/thanks") return { page: "thanks" };
  const productMatch = path.match(/^\/app\/product\/([^/]+)$/);
  if (productMatch) return { page: "product", id: decodeURIComponent(productMatch[1]) };
  return null;
}

export function isShopPath(path) {
  return Boolean(parseShopPath(path));
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navLink(href, label, active) {
  return `<a class="shop-nav-link${active ? " active" : ""}" href="${href}" data-link>${label}</a>`;
}

function shopShell({ userName, active, body }) {
  const count = cartCount();
  const commerce = active === "product" || active === "pay" || active === "checkout";
  const nav = commerce
    ? `
          ${navLink("/app/shop", "Back", false)}
          ${navLink("/app/shop", "Sale", false)}
          ${navLink("/app/shop", "New Arrival", false)}
          <a class="shop-cart-btn" href="/app/checkout" data-link>Cart${count ? ` (${count})` : ""}</a>
          <button class="theme-toggle" type="button" aria-label="Toggle theme">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </button>
          <button class="shop-nav-link shop-exit" type="button" id="logout">Exit</button>`
    : `
          ${navLink("/app", "Home", active === "home")}
          ${navLink("/app#size", "Size Chart", false)}
          ${navLink("/app#order", "How to Order", false)}
          ${navLink("/app/shop", "Buy", active === "shop")}
          <a class="shop-cart-btn" href="/app/checkout" data-link>Cart${count ? ` (${count})` : ""}</a>
          <button class="theme-toggle" type="button" aria-label="Toggle theme">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 14.5A8.5 8.5 0 1110.5 3a6.5 6.5 0 0010.5 11.5z"/></svg>
          </button>
          <button class="shop-nav-link shop-exit" type="button" id="logout">Exit</button>`;
  return `
    <div class="shop-shell${commerce ? " commerce" : ""}">
      <header class="shop-top">
        <a class="shop-logo" href="/app" data-link>
          <span class="shop-mark">C</span>
          <span class="shop-logo-text">Cop A Cap</span>
        </a>
        <nav class="shop-nav">
          ${nav}
        </nav>
      </header>
      <main class="shop-main">
        ${body}
      </main>
      <footer class="shop-footer">
        <div class="shop-footer-brand">
          <span class="shop-mark sm">C</span>
          <div>
            <strong>www.copacap.com.ph</strong>
            <p>NO BASIC CAPS. JUST STRAIGHT HEAT.</p>
          </div>
        </div>
        <div class="shop-socials">
          <p>SOCIALS</p>
          <div class="shop-social-row">
            <span>IG: _COPACAP</span>
            <span>TIKTOK: _COPACAP</span>
            <span>FACEBOOK: COP A CAP</span>
          </div>
        </div>
      </footer>
    </div>
  `;
}

function homeBody(userName) {
  return `
    <section class="shop-welcome">
      <p class="shop-kicker">Welcome${userName ? `, ${esc(userName.split(" ")[0])}` : ""}</p>
      <h1>Welcome to Cop A Cap</h1>
      <p class="shop-lead">Your #1 Local Cap Dealer.</p>
      <a class="btn shop-cta" href="/app/shop" data-link>Buy</a>
    </section>

    <section class="shop-banner" aria-label="Cop A Cap">
      <img src="/assets/brand/LOGO.png" alt="COP A CAP" />
    </section>

    <section class="shop-section" id="size">
      <div class="shop-section-head">
        <h2>SIZE GUIDE</h2>
        <p>Find your fit before you cop.</p>
      </div>
      <div class="size-grid">
        <figure class="size-tile">
          <img src="/assets/brand/SIZE-GUIDE.png" alt="Fitted size guide" />
          <figcaption>FITTED SIZE GUIDE</figcaption>
        </figure>
        <figure class="size-tile">
          <img src="/assets/brand/SIZE-GUIDE-2.png" alt="Snapback to fitted" />
          <figcaption>SNAPBACK TO FITTED</figcaption>
        </figure>
        <figure class="size-tile">
          <img src="/assets/brand/SOC-MED.png" alt="Follow Cop A Cap" />
          <figcaption>FOLLOW US!</figcaption>
        </figure>
      </div>
    </section>

    <section class="shop-section types-section">
      <div class="types-copy">
        <h2>Types of Caps</h2>
        <div class="type-block">
          <h3>FITTED</h3>
          <p>A snug, structured crown with no adjuster — the streetwear staple for a clean, locked-in look.</p>
        </div>
        <div class="type-block">
          <h3>SNAPBACK</h3>
          <p>Adjustable plastic strap, one-size-fits-most versatility. Easy to dial in and ready to wear.</p>
        </div>
        <div class="type-block">
          <h3>UNSTRUCTURED</h3>
          <p>A softer crown for a relaxed, vintage vibe. Low-key heat that still finishes the fit.</p>
        </div>
        <a class="btn ghost shop-cta-inline" href="/app/shop" data-link>Browse caps</a>
      </div>
      <div class="types-media">
        <img src="/assets/caps/collection.jpg" alt="Cop A Cap collection" />
      </div>
    </section>

    <section class="shop-section" id="order">
      <div class="shop-section-head">
        <h2>How to Order?</h2>
        <p>From drop to door — simple and straight.</p>
      </div>
      <div class="order-layout">
        <ol class="order-list">
          <li>Check out the most recent collection; each item is listed individually.</li>
          <li>Comment “mine” or DM to secure your drop.</li>
          <li>Payment via GCASH, MAYA, and BPI bank transfer. Strictly no COD.</li>
          <li>Shipping via J&amp;T, LALAMOVE, and FLASH EXPRESS.</li>
          <li>Confirmation message and order receipt sent after payment.</li>
        </ol>
        <figure class="order-art">
          <img src="/assets/brand/HOW-TO-ORDER.png" alt="How to order" />
        </figure>
      </div>
    </section>

    <section class="shop-section" id="feedback">
      <div class="shop-section-head">
        <h2>Feedback</h2>
        <p>What the community is saying.</p>
      </div>
      <div class="feedback-grid">
        <blockquote class="feedback-card">
          <p>“Best Cap Quality”</p>
          <cite>— Ara</cite>
        </blockquote>
        <blockquote class="feedback-card">
          <p>“Love The Color”</p>
          <cite>— Syd</cite>
        </blockquote>
        <blockquote class="feedback-card">
          <p>“It fits me so well.”</p>
          <cite>— Zed</cite>
        </blockquote>
      </div>
    </section>

    <section class="shop-socials-band" id="socials">
      <div>
        <h2>SOCIALS</h2>
        <p class="shop-url">www.copacap.com.ph</p>
      </div>
      <ul class="shop-handles">
        <li>IG: _COPACAP</li>
        <li>TIKTOK: _COPACAP</li>
        <li>FACEBOOK: COP A CAP</li>
      </ul>
    </section>
  `;
}

function shopGridBody() {
  const cards = PRODUCTS.map((p) => {
    const soldOut = !isAvailable(p.id);
    const fit = hasSizeChoices(p) ? "Sized fit" : ADJUSTABLE_FIT;
    return `
      <article class="product-card">
        <a class="product-card-media" href="/app/product/${esc(p.id)}" data-soft>
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />
        </a>
        <div class="product-card-body">
          <h3>${esc(p.name)}</h3>
          <p class="product-meta">${esc(p.type)} · ${formatPrice(p.price)}</p>
          <p class="product-kind">${esc(fit)} · ${esc(stockLabel(p.id))}</p>
          <div class="product-card-actions">
            <a class="btn ghost" href="/app/product/${esc(p.id)}" data-soft>View</a>
            <button class="btn" type="button" data-purchase="${esc(p.id)}"${soldOut ? " disabled" : ""}>${soldOut ? "Sold out" : "Purchase"}</button>
          </div>
        </div>
      </article>`;
  }).join("");

  return `
    <section class="shop-hero-banner">
      <div>
        <p class="shop-kicker">Collection</p>
        <h1>BEST CAP IN TOWN!</h1>
        <p class="shop-lead">All fitted. All ₱950. Cop before it’s gone.</p>
      </div>
    </section>
    <section class="product-grid">${cards}</section>
  `;
}

function sizePickerHtml(productId) {
  const sizes = productSizes(productId);
  return `
    <div class="size-picker" role="group" aria-label="Choose size">
      <p class="size-picker-label">Select size</p>
      <div class="size-options">
        ${sizes
          .map(
            (size) => `
          <label class="size-option">
            <input type="radio" name="capSize" value="${esc(size)}" />
            <span>${esc(size)}</span>
          </label>`
          )
          .join("")}
      </div>
      <div class="error" data-error="capSize"></div>
    </div>
  `;
}

function adjustableFitHtml() {
  return `
    <div class="size-picker adjustable-fit">
      <p class="size-picker-label">Fit</p>
      <p class="adjustable-fit-badge">${esc(ADJUSTABLE_FIT)}</p>
    </div>
  `;
}

function productStage(product, { action }) {
  const soldOut = !isAvailable(product.id);
  const sized = hasSizeChoices(product);
  const button =
    action === "pay"
      ? `<button class="btn product-action" type="button" id="pay-btn">Pay</button>`
      : soldOut
        ? `<button class="btn product-action" type="button" disabled>Sold out</button>`
        : `<button class="btn product-action" type="button" data-add-cart="${esc(product.id)}">Add to cart</button>`;
  const fitBlock =
    soldOut || action === "pay" ? "" : sized ? sizePickerHtml(product.id) : adjustableFitHtml();
  return `
    <section class="product-stage">
      <div class="product-stage-media">
        <img src="${esc(product.image)}" alt="${esc(product.name)}" />
      </div>
      <div class="product-stage-copy">
        <h1>${esc(product.name)}</h1>
        <p class="product-kind">${esc(product.type)}${sized ? "" : ` · ${esc(ADJUSTABLE_FIT)}`}</p>
        <p class="product-price">${formatPrice(product.price)}</p>
        <p class="product-kind">${esc(stockLabel(product.id))}</p>
        <p class="product-blurb">Designed with a brim for sun protection, a cap is a go-to accessory for casual and active lifestyles.</p>
        ${fitBlock}
        ${button}
      </div>
    </section>
  `;
}

function relatedGrid(currentId) {
  const items = PRODUCTS.filter((p) => p.id !== currentId).slice(0, 6);
  const cards = items
    .map(
      (p) => `
        <a class="related-card" href="/app/product/${esc(p.id)}" data-soft>
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />
          <h3>${esc(p.name)}</h3>
          <p>${formatPrice(p.price)} · ${esc(stockLabel(p.id))}</p>
          <span class="related-dash" aria-hidden="true"></span>
        </a>`
    )
    .join("");
  return `
    <section class="related">
      <h2>Related products</h2>
      <div class="related-grid">${cards}</div>
    </section>
  `;
}

function productBody(product) {
  if (!product) {
    return `
      <section class="shop-empty">
        <h1>Cap not found</h1>
        <p>That drop isn’t on the list.</p>
        <a class="btn shop-cta" href="/app/shop" data-link>Back to shop</a>
      </section>
    `;
  }
  return `${productStage(product, { action: "cart" })}${relatedGrid(product.id)}`;
}

function cartTotal() {
  return getCart().reduce((sum, item) => {
    const product = getProduct(item.id);
    return sum + (product ? product.price * (item.qty || 1) : 0);
  }, 0);
}

function walletTheme(method) {
  if (method === "Maya") return "maya";
  if (method === "BPI") return "bpi";
  return "gcash";
}

function walletCardHtml(user, method, total) {
  const balance = Number(getWallet()[method]) || 0;
  const after = balance - total;
  const short = after < 0;
  const theme = walletTheme(method);
  return `
    <aside class="wallet-card wallet-${theme}" id="wallet-card">
      <div class="wallet-brand">
        <span class="wallet-badge">${esc(method)}</span>
        <p class="wallet-app">${esc(method)} e-wallet</p>
      </div>
      <p class="wallet-owner">${esc(user?.fullName || "Customer")}</p>
      <p class="wallet-mobile">${esc(user?.mobile || "Linked mobile")}</p>
      <div class="wallet-balance">
        <span>Available balance</span>
        <strong id="wallet-balance-value">${formatPrice(balance)}</strong>
      </div>
      <div class="wallet-row"><span>Amount to pay</span><strong>${formatPrice(total)}</strong></div>
      <div class="wallet-row">
        <span>Balance after pay</span>
        <strong class="${short ? "is-short" : ""}">${short ? "Insufficient funds" : formatPrice(after)}</strong>
      </div>
      <p class="wallet-note">Your ${esc(method)} balance is checked before payment. Successful orders appear in the admin sales report.</p>
    </aside>
  `;
}

function refreshWalletCard(user) {
  const card = document.getElementById("wallet-card");
  if (!card) return;
  const method = document.querySelector("input[name='payMethod']:checked")?.value || "GCash";
  card.outerHTML = walletCardHtml(user, method, cartTotal());
}

function payBody(user) {
  const cart = getCart();
  if (!cart.length) {
    return `
      <section class="shop-empty">
        <h1>Nothing to pay</h1>
        <p>Add a cap to your cart first, then enter your details.</p>
        <a class="btn shop-cta" href="/app/shop" data-link>Back to shop</a>
      </section>
    `;
  }

  const buyer = getBuyer();
  const wallet = getWallet();
  const total = cartTotal();
  const summary = cart
    .map((item) => {
      const product = getProduct(item.id);
      if (!product) return "";
      return `<li><span>${esc(product.name)} · ${esc(fitLabel(item.id, item.size))} × ${item.qty || 1}</span><strong>${formatPrice(product.price * (item.qty || 1))}</strong></li>`;
    })
    .join("");

  const methods = ["GCash", "Maya", "BPI"]
    .map((method, i) => {
      const balance = Number(wallet[method]) || 0;
      const short = balance < total;
      return `<label class="pay-method${short ? " is-short" : ""}">
        <input type="radio" name="payMethod" value="${esc(method)}"${i === 0 ? " checked" : ""} />
        <span>
          <strong>${esc(method)}</strong>
          <small>Balance ${formatPrice(balance)}${short ? " · not enough" : ""}</small>
        </span>
      </label>`;
    })
    .join("");

  return `
    <section class="checkout-page pay-page">
      <p class="shop-kicker">Payment</p>
      <h1>Buyer details</h1>
      <p class="shop-lead">Enter your info, then pay from your GCash, Maya, or BPI balance.</p>
      <ul class="pay-summary">${summary}</ul>
      <div class="checkout-total">
        <span>Total</span>
        <strong>${formatPrice(total)}</strong>
      </div>
      <form id="pay-form" class="pay-form" novalidate>
        <div class="field">
          <label for="buyerName">Full name</label>
          <input id="buyerName" name="buyerName" required placeholder="Juan Dela Cruz" value="${esc(buyer.name || "")}" />
          <div class="error" data-error="buyerName"></div>
        </div>
        <div class="field">
          <label for="buyerContact">Contact number</label>
          <input id="buyerContact" name="buyerContact" inputmode="tel" required placeholder="09171234567 or +639171234567" value="${esc(buyer.contact || "")}" />
          <div class="error" data-error="buyerContact"></div>
        </div>
        <div class="field">
          <label for="buyerAddress">Delivery address</label>
          <textarea id="buyerAddress" name="buyerAddress" required placeholder="Street, city, province">${esc(buyer.address || "")}</textarea>
          <div class="error" data-error="buyerAddress"></div>
        </div>
        <fieldset class="pay-methods">
          <legend>Payment method</legend>
          ${methods}
        </fieldset>
        ${walletCardHtml(user, "GCash", total)}
        <div class="field pay-proof-field">
          <label for="paymentProof">Upload payment example / screenshot <span class="optional">(optional)</span></label>
          <input id="paymentProof" name="paymentProof" type="file" accept="image/*" />
          <p class="field-hint">Attach a GCash, Maya, or BPI screenshot so admin can verify the purchase in the sales report.</p>
          <div class="pay-proof-preview" id="pay-proof-preview" hidden>
            <img alt="Payment proof preview" />
          </div>
          <div class="error" data-error="paymentProof"></div>
        </div>
        <div class="error" data-error="payMethod"></div>
        <div class="pay-actions">
          <button type="button" class="btn ghost" id="clear-proof" hidden>Remove payment proof</button>
          <button class="btn product-action" type="submit" id="pay-btn">Pay with selected wallet</button>
        </div>
      </form>
    </section>
  `;
}

function cartLinesHtml() {
  return getCart()
    .map((item) => {
      const product = getProduct(item.id);
      if (!product) return "";
      const qty = item.qty || 1;
      const size = item.size;
      const usedOther = cartLineQty(product.id, size);
      const maxForLine = Math.max(0, getStock(product.id) - usedOther);
      const lineTotal = product.price * qty;
      return `
        <article class="checkout-line">
          <img src="${esc(product.image)}" alt="${esc(product.name)}" />
          <div class="checkout-line-copy">
            <h3>${esc(product.name)}</h3>
            <p>${esc(product.type)} · ${esc(fitLabel(product.id, size))} · ${esc(stockLabel(product.id))}</p>
            <p class="product-price">${formatPrice(lineTotal)}</p>
          </div>
          <div class="qty-stepper" role="group" aria-label="Quantity">
            <button type="button" data-qty-delta="-1" data-qty-id="${esc(product.id)}" data-qty-size="${esc(size)}" aria-label="Decrease quantity">−</button>
            <span>${qty}</span>
            <button type="button" data-qty-delta="1" data-qty-id="${esc(product.id)}" data-qty-size="${esc(size)}" aria-label="Increase quantity"${qty >= maxForLine ? " disabled" : ""}>+</button>
          </div>
          <button class="btn ghost cart-delete" type="button" data-remove="${esc(product.id)}" data-remove-size="${esc(size)}">Delete</button>
        </article>`;
    })
    .join("");
}

function updateCartCountBadge() {
  const count = cartCount();
  const cartBtn = document.querySelector(".shop-cart-btn");
  if (cartBtn) cartBtn.textContent = count ? `Cart (${count})` : "Cart";
}

function refreshCartView(navigate) {
  const list = document.querySelector(".checkout-list");
  const total = document.querySelector(".checkout-total strong");
  if (!getCart().length) {
    navigate("/app/checkout");
    return;
  }
  if (list) list.innerHTML = cartLinesHtml();
  if (total) total.textContent = formatPrice(cartTotal());
  updateCartCountBadge();
  bindCartControls(navigate);
}

function bindCartControls(navigate) {
  document.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.onclick = () => {
      removeFromCart(btn.getAttribute("data-remove"), btn.getAttribute("data-remove-size"));
      refreshCartView(navigate);
    };
  });

  document.querySelectorAll("[data-qty-id]").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-qty-id");
      const size = btn.getAttribute("data-qty-size");
      const delta = Number(btn.getAttribute("data-qty-delta") || 0);
      const current = getCart().find((item) => item.id === id && item.size === size)?.qty || 1;
      setCartQty(id, size, current + delta);
      refreshCartView(navigate);
    };
  });
}

function selectedCapSize() {
  return document.querySelector("input[name='capSize']:checked")?.value || "";
}

function checkoutBody() {
  const cart = getCart();
  if (!cart.length) {
    return `
      <section class="shop-empty">
        <h1>Your cart is empty</h1>
        <p>Browse the drop and add a fitted to get started.</p>
        <a class="btn" href="/app/shop" data-link>Go to shop</a>
      </section>
    `;
  }

  return `
    <section class="checkout-page">
      <p class="shop-kicker">Cart</p>
      <h1>Your bag</h1>
      <div class="checkout-list">${cartLinesHtml()}</div>
      <div class="checkout-total">
        <span>Total</span>
        <strong>${formatPrice(cartTotal())}</strong>
      </div>
      <button class="btn product-action" type="button" id="proceed-pay-btn">Proceed to payment</button>
    </section>
  `;
}

function formatOrderDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function receiptHtml(order) {
  if (!order) return "";
  const lines = (order.items || [])
    .map(
      (item) =>
        `<tr><td>${esc(item.name)}${item.size ? ` · ${esc(item.size === ADJUSTABLE_FIT ? ADJUSTABLE_FIT : `Size ${item.size}`)}` : ""} × ${item.qty}</td><td>${formatPrice(item.price * item.qty)}</td></tr>`
    )
    .join("");
  const proof = order.paymentProof
    ? `<div class="receipt-proof"><p>Payment proof</p><img src="${esc(order.paymentProof)}" alt="Uploaded payment proof" /></div>`
    : "";
  return `
    <article class="receipt" id="receipt">
      <header class="receipt-head">
        <span class="shop-mark">C</span>
        <div>
          <strong>COP A CAP</strong>
          <p>Official receipt</p>
        </div>
      </header>
      <p class="receipt-meta">OR No. ${esc(order.id)}</p>
      <p class="receipt-meta">${esc(formatOrderDate(order.createdAt))}</p>
      <p class="receipt-meta">Paid via ${esc(order.method)}</p>
      <div class="receipt-buyer">
        <p><strong>${esc(order.buyer?.name || "")}</strong></p>
        <p>${esc(order.buyer?.contact || "")}</p>
        <p>${esc(order.buyer?.address || "")}</p>
      </div>
      <table class="receipt-table">
        <tbody>${lines}</tbody>
      </table>
      <div class="receipt-total">
        <span>Total</span>
        <strong>${formatPrice(order.total)}</strong>
      </div>
      <p class="receipt-wallet">${esc(order.method)} balance ${formatPrice(order.walletBefore)} → ${formatPrice(order.walletAfter)}</p>
      ${proof}
      <p class="receipt-foot">Logged in sales report · ${esc(order.id)}</p>
    </article>
  `;
}

function thanksBody() {
  const order = getLastOrder();
  return `
    <section class="thanks-banner">
      <p class="shop-kicker">Order confirmed</p>
      <h1>THANK YOU</h1>
      <p>Your cap is locked in. A receipt is ready to print, and this purchase is saved in the admin sales report.</p>
      ${order ? receiptHtml(order) : ""}
      <div class="thanks-actions">
        ${order ? `<button class="btn thanks-btn" type="button" id="print-receipt">Print receipt</button>` : ""}
        <a class="btn thanks-btn" href="/app/shop" data-link>Keep shopping</a>
      </div>
    </section>
  `;
}

function readProofFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("Payment proof must be an image file."));
      return;
    }
    if (file.size > 650 * 1024) {
      reject(new Error("Payment proof must be under 650KB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read payment proof."));
    reader.readAsDataURL(file);
  });
}

function printReceipt() {
  const receipt = document.getElementById("receipt");
  if (!receipt) {
    window.print();
    return;
  }
  const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!win) {
    window.print();
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><title>Cop A Cap Receipt</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; margin: 24px; color: #111; }
      .receipt { max-width: 420px; margin: 0 auto; }
      .receipt-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
      .shop-mark { display:inline-flex; width:36px; height:36px; align-items:center; justify-content:center; border:2px solid #111; font-weight:800; }
      .receipt-meta, .receipt-buyer p, .receipt-wallet, .receipt-foot { margin: 0; color: #525252; font-size: 13px; }
      .receipt-table { width: 100%; margin: 14px 0; border-collapse: collapse; }
      .receipt-table td { padding: 6px 0; border-bottom: 1px solid #eee; }
      .receipt-table td:last-child, .receipt-total { text-align: right; }
      .receipt-total { display:flex; justify-content:space-between; font-size:1.05rem; margin-bottom:8px; }
      .receipt-proof img { max-width: 100%; margin-top: 8px; border: 1px solid #ddd; }
      .receipt-foot { margin-top: 10px; font-weight: 600; }
    </style></head><body>${receipt.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 250);
}

export function renderShopView({ path, user }) {
  const route = parseShopPath(path) || { page: "home" };
  const userName = user?.fullName || "";

  if (route.page === "shop") {
    return shopShell({ userName, active: "shop", body: shopGridBody() });
  }
  if (route.page === "product") {
    return shopShell({
      userName,
      active: "product",
      body: productBody(getProduct(route.id)),
    });
  }
  if (route.page === "pay") {
    return shopShell({
      userName,
      active: "pay",
      body: payBody(user),
    });
  }
  if (route.page === "checkout") {
    return shopShell({ userName, active: "checkout", body: checkoutBody() });
  }
  if (route.page === "thanks") {
    return shopShell({ userName, active: "thanks", body: thanksBody() });
  }
  return shopShell({ userName, active: "home", body: homeBody(userName) });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function softNavigate(navigate, path) {
  const main = document.querySelector(".shop-main");
  if (main) {
    main.classList.add("is-leaving");
    await wait(240);
  }
  navigate(path);
}

export function bindShopActions({ navigate, toast, api, user }) {
  document.querySelectorAll("[data-soft]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      softNavigate(navigate, link.getAttribute("href"));
    });
  });

  document.querySelectorAll("[data-purchase]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-purchase");
      if (!isAvailable(id)) {
        toast?.("This cap is sold out.");
        return;
      }
      btn.classList.add("is-press");
      const product = getProduct(id);
      toast?.(
        hasSizeChoices(product)
          ? "Choose a size on the product page."
          : "Open the product page to add this adjustable fit."
      );
      await softNavigate(navigate, `/app/product/${encodeURIComponent(id)}`);
    });
  });

  document.querySelectorAll("[data-add-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-add-cart");
      const stock = getStock(id);
      const sizeErr = document.querySelector("[data-error='capSize']");
      const product = getProduct(id);
      if (!isAvailable(id)) {
        toast?.("This cap is sold out.");
        return;
      }
      const sized = hasSizeChoices(product);
      const size = sized ? selectedCapSize() : ADJUSTABLE_FIT;
      if (sized && !size) {
        if (sizeErr) sizeErr.textContent = "Select a size first.";
        toast?.("Select a size first.");
        return;
      }
      if (sizeErr) sizeErr.textContent = "";
      const inCart = getCart()
        .filter((item) => item.id === id)
        .reduce((sum, item) => sum + (item.qty || 0), 0);
      if (inCart >= stock) {
        toast?.(`Only ${stock} available.`);
        return;
      }
      const before = cartCount();
      addToCart(id, size);
      if (cartCount() === before) {
        toast?.(sized ? "Could not add that size — check stock." : "Could not add to cart — check stock.");
        return;
      }
      btn.classList.add("is-press");
      const cartBtn = document.querySelector(".shop-cart-btn");
      cartBtn?.classList.remove("is-pulse");
      void cartBtn?.offsetWidth;
      cartBtn?.classList.add("is-pulse");
      toast?.(sized ? `Added size ${size} to cart` : `Added ${ADJUSTABLE_FIT} to cart`);
    });
  });

  bindCartControls(navigate);

  document.querySelectorAll("input[name='payMethod']").forEach((input) => {
    input.addEventListener("change", () => refreshWalletCard(user));
  });

  const proofInput = document.getElementById("paymentProof");
  const proofPreview = document.getElementById("pay-proof-preview");
  const clearProof = document.getElementById("clear-proof");

  function setProofVisible(visible, dataUrl = "") {
    const img = proofPreview?.querySelector("img");
    if (img) img.src = visible ? dataUrl : "";
    if (proofPreview) proofPreview.hidden = !visible;
    if (clearProof) clearProof.hidden = !visible;
  }

  function focusFirstPayError() {
    const order = ["buyerName", "buyerContact", "buyerAddress", "payMethod", "paymentProof"];
    for (const key of order) {
      const err = document.querySelector(`[data-error='${key}']`);
      if (!err?.textContent) continue;
      const field =
        document.getElementById(key) ||
        document.querySelector(`input[name='${key}']`) ||
        err.closest(".field") ||
        err;
      field?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      if (typeof field?.focus === "function") field.focus({ preventScroll: true });
      break;
    }
  }

  proofInput?.addEventListener("change", async () => {
    const errEl = document.querySelector("[data-error='paymentProof']");
    try {
      const dataUrl = await readProofFile(proofInput.files?.[0]);
      if (errEl) errEl.textContent = "";
      if (dataUrl) setProofVisible(true, dataUrl);
      else setProofVisible(false);
    } catch (err) {
      if (errEl) errEl.textContent = err.message || "Invalid payment proof.";
      proofInput.value = "";
      setProofVisible(false);
    }
  });
  clearProof?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (proofInput) proofInput.value = "";
    setProofVisible(false);
    const errEl = document.querySelector("[data-error='paymentProof']");
    if (errEl) errEl.textContent = "";
    toast?.("Payment proof removed.");
  });

  document.getElementById("print-receipt")?.addEventListener("click", () => {
    printReceipt();
  });

  document.getElementById("proceed-pay-btn")?.addEventListener("click", async () => {
    if (!getCart().length) return;
    await softNavigate(navigate, "/app/pay");
  });

  document.getElementById("pay-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("buyerName")?.value.trim() || "";
    const contact = document.getElementById("buyerContact")?.value.trim() || "";
    const address = document.getElementById("buyerAddress")?.value.trim() || "";
    const method = document.querySelector("input[name='payMethod']:checked")?.value || "";
    let invalid = false;
    let paymentProof = "";
    const payBtn = document.getElementById("pay-btn");

    if (!lettersOnlyName(name)) {
      document.querySelector("[data-error='buyerName']").textContent = "Enter a valid full name.";
      invalid = true;
    } else {
      document.querySelector("[data-error='buyerName']").textContent = "";
    }
    if (!isValidPhMobile(contact)) {
      document.querySelector("[data-error='buyerContact']").textContent =
        "Use 09XXXXXXXXX or +639XXXXXXXXX.";
      invalid = true;
    } else {
      document.querySelector("[data-error='buyerContact']").textContent = "";
    }
    if (!address) {
      document.querySelector("[data-error='buyerAddress']").textContent = "Enter your delivery address.";
      invalid = true;
    } else {
      document.querySelector("[data-error='buyerAddress']").textContent = "";
    }
    if (!method) {
      document.querySelector("[data-error='payMethod']").textContent = "Choose a payment method.";
      invalid = true;
    } else {
      document.querySelector("[data-error='payMethod']").textContent = "";
    }
    try {
      paymentProof = await readProofFile(document.getElementById("paymentProof")?.files?.[0]);
      const proofErr = document.querySelector("[data-error='paymentProof']");
      if (proofErr) proofErr.textContent = "";
    } catch (err) {
      document.querySelector("[data-error='paymentProof']").textContent =
        err.message || "Invalid payment proof.";
      invalid = true;
    }
    if (invalid) {
      focusFirstPayError();
      toast?.("Please fix the highlighted fields, then pay again.");
      return;
    }

    payBtn?.classList.add("is-press");
    if (payBtn) payBtn.disabled = true;
    try {
      const cart = getCart();
      const result = await api("/api/inventory/purchase", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({ id: item.id, size: item.size, qty: item.qty || 1 })),
          buyer: { name, contact, address },
          method,
          paymentProof,
        }),
      });
      applyStocks(result.stocks || {});
      if (result.catalog) applyCatalog(result.catalog);
      if (result.wallet) applyWallet(result.wallet);
      setBuyer({ name, contact, address, method });
      setLastOrder(result.order);
      clearCart();
      toast?.("Payment successful. Receipt ready — order saved to sales report.");
      await softNavigate(navigate, "/app/thanks");
    } catch (err) {
      if (err.payload?.stocks) applyStocks(err.payload.stocks);
      if (err.payload?.wallet) applyWallet(err.payload.wallet);
      clampCartToStock();
      refreshWalletCard(user);
      toast?.(err.message || "Could not complete purchase.");
    } finally {
      if (payBtn) payBtn.disabled = false;
      payBtn?.classList.remove("is-press");
    }
  });
}
