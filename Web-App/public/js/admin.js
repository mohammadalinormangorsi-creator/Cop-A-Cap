import { PRODUCTS, applyCatalog, formatPrice } from "./products.js";

const CATALOG_PAGE_SIZE = 8;
const SALES_PAGE_SIZE = 5;
const USERS_PAGE_SIZE = 8;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paginationHtml({ page, totalItems, pageSize, id }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = totalItems ? (current - 1) * pageSize + 1 : 0;
  const to = Math.min(current * pageSize, totalItems);
  return `
    <div class="admin-pagination" id="${esc(id)}" data-page="${current}" data-pages="${totalPages}">
      <p class="admin-page-meta">Showing ${from}–${to} of ${totalItems}</p>
      <div class="admin-page-controls">
        <button class="btn ghost" type="button" data-page-go="prev" ${current <= 1 ? "disabled" : ""}>Previous</button>
        <span class="admin-page-num">Page ${current} / ${totalPages}</span>
        <button class="btn ghost" type="button" data-page-go="next" ${current >= totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function bindPagination(el, { getPage, setPage, onChange }) {
  if (!el) return;
  el.querySelectorAll("[data-page-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-page-go");
      const pages = Number(el.dataset.pages) || 1;
      let next = getPage();
      if (dir === "prev") next -= 1;
      if (dir === "next") next += 1;
      next = Math.min(pages, Math.max(1, next));
      if (next === getPage()) return;
      setPage(next);
      onChange();
    });
  });
}

export function parseAdminPath(path) {
  if (path === "/admin" || path === "/super-admin" || path === "/admin/catalog") {
    return { page: "catalog" };
  }
  if (path === "/admin/sales") return { page: "sales" };
  if (path === "/admin/users") return { page: "users" };
  return null;
}

export function isAdminPath(path) {
  return Boolean(parseAdminPath(path));
}

function navLink(href, label, active) {
  return `<a class="shop-nav-link${active ? " active" : ""}" href="${href}" data-link>${label}</a>`;
}

function adminShell({ userName, role, active, body }) {
  return `
    <div class="shop-shell admin-shell">
      <header class="shop-top">
        <a class="shop-logo" href="/admin" data-link>
          <span class="shop-mark">C</span>
          <span class="shop-logo-text">Cop A Cap Admin</span>
        </a>
        <nav class="shop-nav">
          ${navLink("/admin", "Catalog", active === "catalog")}
          ${navLink("/admin/sales", "Sales report", active === "sales")}
          ${navLink("/admin/users", "Users", active === "users")}
          <button class="theme-toggle" type="button" aria-label="Toggle theme">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </button>
          <button class="shop-nav-link shop-exit" type="button" id="logout">Exit</button>
        </nav>
      </header>
      <main class="shop-main admin-main">
        <div class="admin-banner">
          <div>
            <p class="shop-kicker">Admin console</p>
            <p class="admin-role">Signed in as ${esc(userName || "Admin")} · ${esc(role || "Admin")}</p>
          </div>
          <p class="admin-banner-note">Customer shop is a separate page. Staff are routed here only.</p>
        </div>
        ${body}
      </main>
    </div>
  `;
}

function catalogRowHtml(p) {
  const available = p.available !== false;
  return `
    <tr>
      <td class="admin-cap">
        <img src="${esc(p.image)}" alt="" />
        <div>
          <strong>${esc(p.name)}</strong>
          <span>${esc(p.type)}</span>
        </div>
      </td>
      <td>
        <input class="admin-input" type="number" min="0" step="1" value="${esc(p.price)}" data-price="${esc(p.id)}" />
      </td>
      <td>
        <input class="admin-input" type="number" min="0" step="1" value="${esc(p.stock)}" data-stock="${esc(p.id)}" />
      </td>
      <td>
        <label class="admin-avail">
          <input type="checkbox" data-available="${esc(p.id)}"${available ? " checked" : ""} />
          ${available ? "Available" : "Unavailable"}
        </label>
      </td>
      <td>
        <button class="btn" type="button" data-save-cap="${esc(p.id)}">Save</button>
      </td>
    </tr>`;
}

function catalogBody() {
  return `
    <section class="admin-page">
      <h1>Catalog</h1>
      <p class="shop-lead">Edit price and availability (plus stock). Changes apply to the customer shop after you save.</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cap</th>
              <th>Price (₱)</th>
              <th>Stock</th>
              <th>Availability</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="catalog-tbody"></tbody>
        </table>
      </div>
      <div id="catalog-pagination-host"></div>
    </section>
  `;
}

function usersBody() {
  return `
    <section class="admin-page">
      <h1>Users</h1>
      <p class="shop-lead">Directory of registered accounts. Shared by Admin and Super Admin.</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Mobile</th>
            </tr>
          </thead>
          <tbody id="users-tbody"></tbody>
        </table>
      </div>
      <div id="users-pagination-host"></div>
    </section>
  `;
}

function userRowHtml(u) {
  const roleClass =
    u.accessType === "Super Admin" ? "super" : u.accessType === "Admin" ? "admin" : "";
  return `
    <tr>
      <td>${esc(u.fullName)}</td>
      <td>${esc(u.email)}</td>
      <td><span class="badge ${roleClass}">${esc(u.accessType)}</span></td>
      <td>${esc(u.mobile)}</td>
    </tr>`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function salesBody() {
  const now = new Date();
  return `
    <section class="admin-page">
      <h1>Sales report</h1>
      <p class="shop-lead">View daily, weekly, monthly, quarterly, or yearly totals. Hover calendar dates for history, or click a date to pin it.</p>
      <div class="sales-periods" role="tablist">
        ${["daily", "weekly", "monthly", "quarterly", "yearly"]
          .map(
            (period) =>
              `<button class="btn ghost${period === "monthly" ? " active" : ""}" type="button" data-period="${period}">${period[0].toUpperCase()}${period.slice(1)}</button>`
          )
          .join("")}
      </div>
      <p class="sales-range" id="sales-range"></p>
      <div class="sales-stats" id="sales-stats"></div>
      <div class="sales-layout">
        <section class="sales-cal-card">
          <div class="sales-cal-head">
            <button class="btn ghost" type="button" id="cal-prev" aria-label="Previous month">←</button>
            <h2 id="cal-title">${MONTHS[now.getMonth()]} ${now.getFullYear()}</h2>
            <button class="btn ghost" type="button" id="cal-next" aria-label="Next month">→</button>
          </div>
          <div class="sales-cal" id="sales-cal"></div>
          <p class="shop-lead sales-hint">Hover a highlighted date to preview orders. Click it to pin the history below.</p>
        </section>
        <section class="sales-history" id="sales-history">
          <h2>Purchase history</h2>
          <div id="sales-history-list"><p class="shop-lead">Select a period or a calendar date.</p></div>
          <div id="sales-pagination-host"></div>
        </section>
      </div>
    </section>
  `;
}

export function renderAdminView({ path, user }) {
  const route = parseAdminPath(path) || { page: "catalog" };
  const userName = user?.fullName || "";
  const role = user?.accessType || "Admin";
  if (route.page === "sales") {
    return adminShell({ userName, role, active: "sales", body: salesBody() });
  }
  if (route.page === "users") {
    return adminShell({ userName, role, active: "users", body: usersBody() });
  }
  return adminShell({ userName, role, active: "catalog", body: catalogBody() });
}

function peso(amount) {
  return formatPrice(amount);
}

function formatWhen(iso) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function orderListHtml(orders) {
  if (!orders?.length) return `<p class="shop-lead">No purchases in this view.</p>`;
  return orders
    .map((order) => {
      const items = (order.items || [])
        .map((item) => `${esc(item.name)}${item.size ? ` · ${esc(item.size)}` : ""} × ${item.qty}`)
        .join(", ");
      const proof = order.paymentProof
        ? `<button type="button" class="btn ghost sale-proof-btn" data-proof="${esc(order.id)}">View payment proof</button>
           <div class="sale-proof" id="proof-${esc(order.id)}" hidden>
             <img src="${esc(order.paymentProof)}" alt="Payment proof for ${esc(order.id)}" />
           </div>`
        : "";
      return `
        <article class="sale-card">
          <div>
            <strong>${esc(order.id)}</strong>
            <p>${esc(formatWhen(order.createdAt))} · ${esc(order.method)}</p>
            <p>${esc(order.buyer?.name || "")} · ${esc(items)}</p>
            <p>${esc(order.method)} ${peso(order.walletBefore)} → ${peso(order.walletAfter)}</p>
            ${proof}
          </div>
          <strong>${peso(order.total)}</strong>
        </article>`;
    })
    .join("");
}

function statsHtml(totals) {
  return `
    <div class="stat-card"><span>Orders</span><strong>${totals.count || 0}</strong></div>
    <div class="stat-card"><span>Pieces</span><strong>${totals.pieces || 0}</strong></div>
    <div class="stat-card"><span>Revenue</span><strong>${peso(totals.revenue || 0)}</strong></div>
  `;
}

function formatRange(from, to) {
  try {
    const a = new Date(from).toLocaleDateString("en-PH", { dateStyle: "medium" });
    const b = new Date(to).toLocaleDateString("en-PH", { dateStyle: "medium" });
    return a === b ? a : `${a} – ${b}`;
  } catch {
    return "";
  }
}

function calendarHtml(year, month, days, selected) {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const cells = [];
  ["S", "M", "T", "W", "T", "F", "S"].forEach((d) => {
    cells.push(`<span class="sales-dow">${d}</span>`);
  });
  for (let i = 0; i < startPad; i += 1) cells.push(`<span class="sales-day is-empty"></span>`);
  for (let day = 1; day <= lastDate; day += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const info = days[key];
    const has = Boolean(info?.count);
    const tip = has
      ? `${info.count} order${info.count === 1 ? "" : "s"} · ${peso(info.revenue)}\n${(info.orders || [])
          .map((o) => `${o.buyer?.name || "Customer"} · ${peso(o.total)}`)
          .join("\n")}`
      : "No purchases";
    const tipSide = day > 22 ? " tip-left" : day < 6 ? " tip-right" : "";
    cells.push(`
      <button class="sales-day${has ? " has-sales" : ""}${selected === key ? " is-selected" : ""}" type="button" data-day="${key}" title="${esc(tip)}" aria-label="${esc(tip)}">
        <span>${day}</span>
        ${has ? `<b>${info.count}</b>` : ""}
        ${
          has
            ? `<div class="sales-tip${tipSide}">
                <strong>${esc(key)}</strong>
                <p>${info.count} purchase${info.count === 1 ? "" : "s"} · ${peso(info.revenue)}</p>
                ${(info.orders || [])
                  .map(
                    (o) =>
                      `<p>${esc(o.id)} · ${esc(o.buyer?.name || "")} · ${esc(o.method)} · ${peso(o.total)}</p>`
                  )
                  .join("")}
              </div>`
            : ""
        }
      </button>`);
  }
  return cells.join("");
}

function bindCatalogRows({ api, toast, onSaved }) {
  document.querySelectorAll("[data-available]").forEach((box) => {
    box.addEventListener("change", () => {
      const label = box.closest("label");
      if (label) label.lastChild.textContent = box.checked ? " Available" : " Unavailable";
    });
  });

  document.querySelectorAll("[data-save-cap]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-save-cap");
      const price = document.querySelector(`[data-price="${id}"]`)?.value;
      const stock = document.querySelector(`[data-stock="${id}"]`)?.value;
      const available = document.querySelector(`[data-available="${id}"]`)?.checked;
      try {
        const data = await api("/api/admin/catalog", {
          method: "PATCH",
          body: JSON.stringify({
            id,
            price: Number(price),
            stock: Number(stock),
            available: Boolean(available),
          }),
        });
        applyCatalog(data.catalog || {});
        toast?.("Cap updated.");
        onSaved?.();
      } catch (err) {
        toast?.(err.message || "Could not save cap.");
      }
    });
  });
}

export function bindAdminActions({ api, toast, navigate }) {
  const catalogTbody = document.getElementById("catalog-tbody");
  if (catalogTbody) {
    const catalogState = { page: 1 };
    const host = document.getElementById("catalog-pagination-host");

    function renderCatalogPage() {
      const total = PRODUCTS.length;
      const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
      catalogState.page = Math.min(catalogState.page, totalPages);
      const start = (catalogState.page - 1) * CATALOG_PAGE_SIZE;
      const slice = PRODUCTS.slice(start, start + CATALOG_PAGE_SIZE);
      catalogTbody.innerHTML = slice.map(catalogRowHtml).join("");
      if (host) {
        host.innerHTML = paginationHtml({
          page: catalogState.page,
          totalItems: total,
          pageSize: CATALOG_PAGE_SIZE,
          id: "catalog-pagination",
        });
        bindPagination(document.getElementById("catalog-pagination"), {
          getPage: () => catalogState.page,
          setPage: (p) => {
            catalogState.page = p;
          },
          onChange: renderCatalogPage,
        });
      }
      bindCatalogRows({
        api,
        toast,
        onSaved: renderCatalogPage,
      });
    }

    renderCatalogPage();
  }

  const usersTbody = document.getElementById("users-tbody");
  if (usersTbody) {
    const usersState = { page: 1, users: [] };
    const host = document.getElementById("users-pagination-host");

    function renderUsersPage() {
      const total = usersState.users.length;
      const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
      usersState.page = Math.min(usersState.page, totalPages);
      const start = (usersState.page - 1) * USERS_PAGE_SIZE;
      const slice = usersState.users.slice(start, start + USERS_PAGE_SIZE);
      usersTbody.innerHTML = slice.length
        ? slice.map(userRowHtml).join("")
        : `<tr><td colspan="4"><p class="shop-lead">No users found.</p></td></tr>`;
      if (host) {
        host.innerHTML = paginationHtml({
          page: usersState.page,
          totalItems: total,
          pageSize: USERS_PAGE_SIZE,
          id: "users-pagination",
        });
        bindPagination(document.getElementById("users-pagination"), {
          getPage: () => usersState.page,
          setPage: (p) => {
            usersState.page = p;
          },
          onChange: renderUsersPage,
        });
      }
    }

    api("/api/admin/users")
      .then((data) => {
        usersState.users = Array.isArray(data.users) ? data.users : [];
        renderUsersPage();
      })
      .catch((err) => toast?.(err.message || "Could not load users."));
  }

  const cal = document.getElementById("sales-cal");
  if (!cal) return;

  const state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    period: "monthly",
    date: null,
    selected: null,
    days: {},
    orders: [],
    page: 1,
  };

  function bindProofButtons() {
    document.querySelectorAll("[data-proof]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-proof");
        const panel = document.getElementById(`proof-${id}`);
        if (!panel) return;
        panel.hidden = !panel.hidden;
        btn.textContent = panel.hidden ? "View payment proof" : "Hide payment proof";
      });
    });
  }

  function renderSalesPage() {
    const list = document.getElementById("sales-history-list");
    const host = document.getElementById("sales-pagination-host");
    const heading = document.querySelector("#sales-history h2");
    const label = state.selected
      ? `Purchases on ${state.selected}`
      : `${state.period[0].toUpperCase()}${state.period.slice(1)} purchases`;
    if (heading) heading.textContent = label;

    const total = state.orders.length;
    const totalPages = Math.max(1, Math.ceil(total / SALES_PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * SALES_PAGE_SIZE;
    const slice = state.orders.slice(start, start + SALES_PAGE_SIZE);
    if (list) list.innerHTML = orderListHtml(slice);
    if (host) {
      host.innerHTML = paginationHtml({
        page: state.page,
        totalItems: total,
        pageSize: SALES_PAGE_SIZE,
        id: "sales-pagination",
      });
      bindPagination(document.getElementById("sales-pagination"), {
        getPage: () => state.page,
        setPage: (p) => {
          state.page = p;
        },
        onChange: renderSalesPage,
      });
    }
    bindProofButtons();
  }

  async function loadReport() {
    const now = new Date();
    const date =
      state.selected ||
      (state.year === now.getFullYear() && state.month === now.getMonth() + 1
        ? `${state.year}-${String(state.month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
        : `${state.year}-${String(state.month).padStart(2, "0")}-01`);
    const report = await api(
      `/api/admin/sales?period=${state.selected ? "daily" : state.period}&date=${date}`
    );
    document.getElementById("sales-stats").innerHTML = statsHtml(report.totals);
    const rangeEl = document.getElementById("sales-range");
    if (rangeEl) {
      const periodLabel = state.selected
        ? "Selected day"
        : `${state.period[0].toUpperCase()}${state.period.slice(1)} range`;
      rangeEl.textContent = `${periodLabel}: ${formatRange(report.from, report.to)}`;
    }
    state.orders = state.selected
      ? state.days[state.selected]?.orders || report.orders || []
      : report.orders || [];
    state.page = 1;
    renderSalesPage();
  }

  async function loadCalendar() {
    const data = await api(`/api/admin/sales/calendar?year=${state.year}&month=${state.month}`);
    state.days = data.days || {};
    document.getElementById("cal-title").textContent = `${MONTHS[state.month - 1]} ${state.year}`;
    cal.innerHTML = calendarHtml(state.year, state.month, state.days, state.selected);
    cal.querySelectorAll("[data-day]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        state.selected = btn.getAttribute("data-day");
        await loadCalendar();
        await loadReport();
      });
    });
  }

  document.querySelectorAll("[data-period]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.period = btn.getAttribute("data-period");
      state.selected = null;
      document.querySelectorAll("[data-period]").forEach((el) => el.classList.toggle("active", el === btn));
      await loadCalendar();
      await loadReport();
    });
  });

  document.getElementById("cal-prev")?.addEventListener("click", async () => {
    state.month -= 1;
    if (state.month < 1) {
      state.month = 12;
      state.year -= 1;
    }
    state.selected = null;
    await loadCalendar();
    await loadReport();
  });

  document.getElementById("cal-next")?.addEventListener("click", async () => {
    state.month += 1;
    if (state.month > 12) {
      state.month = 1;
      state.year += 1;
    }
    state.selected = null;
    await loadCalendar();
    await loadReport();
  });

  loadCalendar().then(loadReport).catch((err) => toast?.(err.message || "Could not load sales."));
}
