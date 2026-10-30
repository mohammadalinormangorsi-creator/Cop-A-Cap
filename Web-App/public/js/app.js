import {
  lettersOnlyName,
  isValidEmail,
  isValidPhMobile,
  passwordChecks,
  passwordStrength,
  maxBirthDate,
  isAtLeast18,
  toIso,
  daysInMonth,
  pad,
} from "./validation.js";
import { isShopPath, renderShopView, bindShopActions, loadInventory, loadWallet } from "./shop.js";
import { isAdminPath, renderAdminView, bindAdminActions } from "./admin.js";

const app = document.getElementById("app");
const toastEl = document.getElementById("toast");
const loaderEl = document.getElementById("loader");
const modalEl = document.getElementById("modal");
const privacyModalEl = document.getElementById("privacy-modal");

const calendarState = {
  viewYear: 0,
  viewMonth: 0,
  selected: null,
  mode: "years",
  yearPageStart: 0,
  open: false,
  yearConfirmed: false,
  monthConfirmed: false,
};
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRIVACY_FULL_HTML = `
  <h4>Security</h4>
  <ul>
    <li><strong>Secure Login Authentication</strong> — The system ensures that users can only log in using valid registered credentials.</li>
    <li><strong>Password Protection</strong> — User passwords are protected and should not be displayed or stored as plain text.</li>
    <li><strong>Email OTP Verification</strong> — The system uses a One-Time Password (OTP) sent to the user’s registered email address to provide an additional layer of account security.</li>
    <li><strong>Login Attempt Protection</strong> — The system limits repeated failed login attempts to help prevent unauthorized access.</li>
    <li><strong>Session Security</strong> — Active login sessions are protected, and users may be required to log in again when their session expires.</li>
    <li><strong>Input Validation</strong> — The system validates information entered into the login form to prevent invalid or potentially harmful inputs.</li>
  </ul>
  <h4>Privacy</h4>
  <ul>
    <li><strong>Personal Information Protection</strong> — User information, such as names, email addresses, and account credentials, is protected.</li>
    <li><strong>Limited Data Collection</strong> — The system collects only the information necessary for user authentication and system functions.</li>
    <li><strong>Authorized Access</strong> — Sensitive user information can only be accessed by authorized users or administrators.</li>
    <li><strong>Data Confidentiality</strong> — Users’ personal information should not be shared with unauthorized individuals.</li>
    <li><strong>Secure Data Storage</strong> — User information is stored securely in the database with appropriate access restrictions.</li>
    <li><strong>Privacy Policy</strong> — The system informs users about what information is collected, how it is used, and how it is protected.</li>
  </ul>
`;

function privacyNoticeHtml({ withAgree = false } = {}) {
  return `
    <div class="privacy-block${withAgree ? " with-agree" : ""}">
      <div class="privacy-notice">
        <strong>Security and Privacy</strong>
        <p>Your account security and privacy are important to us. Cop A Cap uses secure authentication, password protection, and email OTP verification to help protect your account. Personal information is collected only when necessary and is protected against unauthorized access.</p>
        <button type="button" class="text-link" data-privacy-open>Read full Security and Privacy</button>
      </div>
      ${
        withAgree
          ? `<div class="agree-side">
              <label class="agree-row">
                <input type="checkbox" id="signupAgree" />
                <span>I agree to the Terms of Service and Privacy Policy</span>
              </label>
              <div class="error" data-error="agree"></div>
            </div>`
          : ""
      }
    </div>
  `;
}

function themeToggleIcon(theme) {
  if (theme === "dark") {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 14.5A8.5 8.5 0 1110.5 3a6.5 6.5 0 0010.5 11.5z"/></svg>`;
}

function getTheme() {
  return localStorage.getItem("atrium_theme") || "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("atrium_theme", theme);
  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.innerHTML = themeToggleIcon(theme);
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  });
}

function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
}

function openPrivacyModal({ requireAgree = false } = {}) {
  const agree = document.getElementById("privacyAgree");
  const continueBtn = document.getElementById("privacyContinue");
  const footer = document.getElementById("privacy-footer");
  if (footer) footer.hidden = !requireAgree;
  if (agree) {
    agree.checked = false;
    agree.onchange = () => {
      if (continueBtn) continueBtn.disabled = !agree.checked;
      setError("privacyAgree", "");
      setError("agree", "");
    };
  }
  if (continueBtn) continueBtn.disabled = true;
  setError("privacyAgree", "");
  privacyModalEl.hidden = false;
  if (!requireAgree) return Promise.resolve(true);
  return new Promise((resolve) => {
    privacyModalEl._agreeResolve = resolve;
  });
}

function closePrivacyModal(agreed = false) {
  privacyModalEl.hidden = true;
  const resolve = privacyModalEl._agreeResolve;
  privacyModalEl._agreeResolve = null;
  resolve?.(agreed);
}

function bindGlobalControls() {
  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.onclick = toggleTheme;
  });
  document.querySelectorAll("[data-privacy-open]").forEach((btn) => {
    btn.onclick = () => openPrivacyModal({ requireAgree: false });
  });
}

const privacyBodyEl = document.getElementById("privacy-body");
if (privacyBodyEl) {
  privacyBodyEl.innerHTML = PRIVACY_FULL_HTML;
}
privacyModalEl?.addEventListener("click", (e) => {
  if (e.target.closest("[data-privacy-close]")) {
    closePrivacyModal(false);
    return;
  }
  if (e.target.closest("[data-privacy-continue]")) {
    const agree = document.getElementById("privacyAgree");
    if (!agree?.checked) {
      setError("privacyAgree", "Please check the box to continue.");
      return;
    }
    const formAgree = document.getElementById("signupAgree");
    if (formAgree) formAgree.checked = true;
    closePrivacyModal(true);
  }
});
applyTheme(getTheme());

function pathOnly(value = location.pathname) {
  return String(value).split("#")[0].replace(/\/$/, "") || "/";
}

const state = {
  view: pathOnly(),
  user: null,
  demoOtp: "",
  otpEmail: "",
  otpMode: "register",
  resetEmail: "",
};

function toast(message) {
  toastEl.hidden = false;
  toastEl.textContent = message;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => {
    toastEl.hidden = true;
  }, 3600);
}

let loadCount = 0;

function setLoading(on, label = "Please wait") {
  if (on) {
    loadCount += 1;
    loaderEl.querySelector(".loader-text").textContent = label;
    loaderEl.hidden = false;
  } else {
    loadCount = Math.max(0, loadCount - 1);
    if (!loadCount) loaderEl.hidden = true;
  }
}

async function withLoading(label, fn) {
  setLoading(true, label);
  try {
    return await fn();
  } finally {
    setLoading(false);
  }
}

function modalIcon(type) {
  if (type === "success") {
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 7L10 17l-6-6"/></svg>`;
  }
  if (type === "error") {
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 7V5a2 2 0 012-2h7v18h-7a2 2 0 01-2-2v-2M10 12H3m0 0l3-3M3 12l3 3"/></svg>`;
}

function closeModal(value) {
  if (modalEl._timer) {
    clearTimeout(modalEl._timer);
    modalEl._timer = null;
  }
  const resolve = modalEl._resolve;
  modalEl._resolve = null;
  modalEl.hidden = true;
  resolve?.(value);
}

function hideModal() {
  closeModal(false);
}

function showModal({ type = "confirm", title, message, confirmText, cancelText, autoClose }) {
  const resolveOld = modalEl._resolve;
  if (modalEl._timer) {
    clearTimeout(modalEl._timer);
    modalEl._timer = null;
  }
  modalEl._resolve = null;
  resolveOld?.(false);

  const icon = document.getElementById("modal-icon");
  icon.className = `modal-icon ${type}`;
  icon.innerHTML = modalIcon(type);
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-message").textContent = message;
  const actions = document.getElementById("modal-actions");
  modalEl.classList.toggle("auto-close", Boolean(autoClose));
  if (autoClose) {
    actions.replaceChildren();
  } else if (cancelText) {
    actions.innerHTML = `<button class="btn ghost" type="button" data-modal="no">${cancelText}</button><button class="btn ${type === "error" ? "danger" : ""}" type="button" data-modal="yes">${confirmText || "Yes"}</button>`;
  } else {
    actions.innerHTML = `<button class="btn" type="button" data-modal="yes">${confirmText || "OK"}</button>`;
  }
  modalEl.hidden = false;
  return new Promise((resolve) => {
    modalEl._resolve = resolve;
    if (autoClose) {
      modalEl._timer = setTimeout(() => closeModal(true), autoClose);
    }
  });
}

modalEl.addEventListener("click", (e) => {
  const choice = e.target.closest("[data-modal]")?.dataset.modal;
  const dismiss = e.target.closest("[data-modal-dismiss]");
  if (!choice && !dismiss) return;
  const hasCancel = Boolean(modalEl.querySelector("[data-modal='no']"));
  const auto = modalEl.classList.contains("auto-close");
  if (dismiss && auto) return;
  if (dismiss && hasCancel === false && !choice) {
    closeModal(true);
    return;
  }
  if (dismiss && hasCancel) {
    closeModal(false);
    return;
  }
  if (!choice) return;
  closeModal(choice === "yes");
});

function token() {
  return localStorage.getItem("atrium_token");
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || data.errors && Object.values(data.errors)[0] || "Something went wrong.";
    const err = new Error(message);
    err.payload = data;
    throw err;
  }
  return data;
}

function navigate(path) {
  const [pathname, hash] = String(path).split("#");
  const next = pathOnly(pathname);
  const samePage = next === state.view;

  if (samePage && hash) {
    history.pushState({}, "", `${next}#${hash}`);
    scrollToSection(hash);
    return;
  }

  history.pushState({}, "", hash ? `${next}#${hash}` : next);
  state.view = next;
  render().then(() => {
    if (hash) scrollToSection(hash);
  });
}

function scrollToSection(id) {
  const main = document.querySelector(".shop-main") || document.querySelector(".main");
  if (id === "overview") {
    main?.scrollTo({ top: 0, behavior: "smooth" });
    setActiveNav("overview");
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  setActiveNav(id);
}

function setActiveNav(id) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.scroll === id);
  });
}

window.addEventListener("popstate", () => {
  state.view = pathOnly();
  render();
});

function calendarSvg() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`;
}

function eyeButton(id) {
  return `<button class="eye" type="button" data-toggle="${id}" aria-label="Show password" aria-pressed="false">${passwordEyeSvg(false)}</button>`;
}

function passwordEyeSvg(shown) {
  if (shown) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.1 12.3a1 1 0 010-.6C3.5 7.5 7.4 4.5 12 4.5s8.5 3 9.9 7.2a1 1 0 010 .6C20.5 16.5 16.6 19.5 12 19.5s-8.5-3-9.9-7.2z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.98 8.22A10.48 10.48 0 001.93 12C3.23 16.34 7.24 19.5 12 19.5c.99 0 1.95-.14 2.86-.4M6.23 6.23A10.45 10.45 0 0112 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 01-4.3 5.77M6.23 6.23L3 3m3.23 3.23l3.65 3.65m7.89 7.89L21 21m-3.23-3.23l-3.65-3.65m0 0a3 3 0 10-4.24-4.24m4.24 4.24L9.88 9.88"/></svg>`;
}

function authLayout(inner) {
  return `
    <div class="auth-shell">
      <aside class="brand-pane">
        <div class="brand-mark"><span class="mark">C</span> Cop A Cap</div>
        <div class="brand-copy">
          <h1>BUILT FOR THE ONES WHO STAND OUT.</h1>
          <p>Fresh caps. Rare finds. Everyday heat. Cop the latest drops and add that finishing touch to your fit.</p>
          <p class="brand-tag">NO BASIC CAPS. JUST STRAIGHT HEAT.</p>
          <div class="trust-row">
            <div class="trust"><b>Fresh drops</b><span>Fitted heat only</span></div>
            <div class="trust"><b>OTP protected</b><span>Secure sign-in</span></div>
            <div class="trust"><b>PH ready</b><span>Local checkout vibe</span></div>
          </div>
        </div>
        <div class="brand-foot">Cop A Cap · No basic caps · Just straight heat</div>
      </aside>
      <section class="form-pane">
        <div class="form-pane-bar">
          <button class="theme-toggle" type="button" aria-label="Toggle theme">${themeToggleIcon(getTheme())}</button>
        </div>
        ${inner}
      </section>
    </div>
  `;
}

function loginView() {
  return authLayout(`
    <div class="card login">
      <h2>Welcome back</h2>
      <p class="lede">Sign in to browse drops, size guides, and checkout.</p>
      <form id="login-form">
        <div class="field">
          <label for="email">Email / Username</label>
          <input id="email" name="email" type="email" autocomplete="username" required placeholder="you@company.com" />
          <div class="error" data-error="email"></div>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="password-wrap">
            <input id="password" name="password" type="password" autocomplete="current-password" required />
            ${eyeButton("password")}
          </div>
          <div class="error" data-error="password"></div>
        </div>
        <button class="btn" type="submit">Continue</button>
      </form>
      ${privacyNoticeHtml()}
      <div class="auth-links">
        <a href="/forgot" data-link>Forgot password?</a>
        <p>New here? <a href="/signup" data-link>Create an account</a></p>
      </div>
    </div>
  `);
}

function signupView() {
  return authLayout(`
    <div class="card wide">
      <h2>Create your account</h2>
      <p class="lede">All fields are required. Username is your email address.</p>
      <form id="signup-form" novalidate>
        <div class="grid-2">
          <div class="field full">
            <label for="fullName">Full name</label>
            <input id="fullName" name="fullName" required placeholder="Juan Dela Cruz" />
            <div class="hint">Letters, spaces, period (.), and dash (-) only. Numbers are not allowed.</div>
            <div class="error" data-error="fullName"></div>
          </div>
          <div class="field full">
            <label for="birthdayDisplay">Birthday</label>
            <div class="birthday-wrap" id="birthday-wrap">
              <div class="birthday-field">
                <input id="birthdayDisplay" type="text" inputmode="numeric" placeholder="mm/dd/yyyy" autocomplete="bday" maxlength="10" />
                <button class="cal-icon-btn" type="button" id="calIconBtn" aria-label="Open calendar">${calendarSvg()}</button>
              </div>
              <div class="birthday-popover" id="birthday-calendar" hidden>
                <div class="cal-header">
                  <button type="button" class="cal-nav-btn" data-cal-prev aria-label="Previous">&#8249;</button>
                  <div class="cal-title-wrap" id="calTitleWrap">
                    <button type="button" class="cal-month-btn" id="calMonthBtn" data-cal-month-open>January</button>
                    <button type="button" class="cal-year-btn" id="calYearBtn" data-cal-year-open>2008</button>
                  </div>
                  <button type="button" class="cal-nav-btn" data-cal-next aria-label="Next">&#8250;</button>
                </div>
                <div class="cal-weekdays" id="calWeekdays">
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                <div class="cal-grid" id="calGrid"></div>
              </div>
            </div>
            <input type="hidden" id="birthday" name="birthday" />
            <div class="hint">Pick Year → Month → Day, or type mm/dd/yyyy. You must be at least 18.</div>
            <div class="error" data-error="birthday"></div>
          </div>
          <div class="field full">
            <label for="address">Address</label>
            <textarea id="address" name="address" required placeholder="Street, city, province"></textarea>
            <div class="error" data-error="address"></div>
          </div>
          <div class="field full">
            <label for="email">Email / Username</label>
            <input id="email" name="email" type="email" required placeholder="you@domain.com" />
            <input id="username" name="username" type="hidden" />
            <div class="hint">Your email is also your username.</div>
            <div class="error" data-error="email"></div>
          </div>
          <div class="field">
            <label for="mobile">Mobile phone number</label>
            <input id="mobile" name="mobile" inputmode="tel" required placeholder="09171234567 or +639171234567" />
            <div class="error" data-error="mobile"></div>
          </div>
          <div class="field">
            <label for="accessType">Access type</label>
            <select id="accessType" name="accessType" required>
              <option value="">Select role</option>
              <option>Super Admin</option>
              <option>Admin</option>
              <option>User</option>
            </select>
            <div class="error" data-error="accessType"></div>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <div class="password-wrap">
              <input id="password" name="password" type="password" autocomplete="new-password" required maxlength="16" />
              ${eyeButton("password")}
            </div>
            <div class="strength weak" id="strength">
              <div class="bars"><span></span><span></span><span></span></div>
              <b>Weak</b>
            </div>
            <ul class="reqs" id="reqs"></ul>
            <div class="error" data-error="password"></div>
          </div>
          <div class="field">
            <label for="confirmPassword">Confirm password</label>
            <div class="password-wrap">
              <input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required maxlength="16" />
              ${eyeButton("confirmPassword")}
            </div>
            <div class="hint">Paste is disabled. Type the password again.</div>
            <div class="error" data-error="confirmPassword"></div>
          </div>
        </div>
        ${privacyNoticeHtml({ withAgree: true })}
        <button class="btn" type="submit" style="margin-top: 8px">Create account</button>
      </form>
      <div class="switch">Already registered? <a href="/" data-link>Sign in</a></div>
    </div>
  `);
}

function otpView() {
  const title = state.otpMode === "reset" ? "Verify reset request" : "Verify your email";
  return authLayout(`
    <div class="card">
      <h2>${title}</h2>
      <p class="lede">Enter the 6-digit code sent to <b>${state.otpEmail}</b>. Check Gmail (and Spam). Codes expire in 5 minutes.</p>
      ${state.demoOtp ? `<div class="demo-otp">Demo code (local development)<br /><b>${state.demoOtp}</b></div>` : ""}
      <form id="otp-form">
        <div class="otp-boxes" id="otp-boxes">
          ${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" maxlength="1" data-otp="${i}" aria-label="Digit ${i + 1}" />`).join("")}
        </div>
        <div class="error" data-error="otp" style="text-align:center"></div>
        <button class="btn" type="submit">Verify code</button>
      </form>
      <div class="switch"><button class="linkish" id="resend" type="button">Resend code</button></div>
    </div>
  `);
}

function forgotView() {
  return authLayout(`
    <div class="card">
      <h2>Reset password</h2>
      <p class="lede">We’ll send a verification code to your registered email.</p>
      <form id="forgot-form">
        <div class="field">
          <label for="email">Email address</label>
          <input id="email" name="email" type="email" required />
          <div class="error" data-error="email"></div>
        </div>
        <button class="btn" type="submit">Send code</button>
      </form>
      <div class="switch"><a href="/" data-link>Back to sign in</a></div>
    </div>
  `);
}

function resetView() {
  return authLayout(`
    <div class="card">
      <h2>Choose a new password</h2>
      <p class="lede">Previous passwords cannot be reused.</p>
      ${state.demoOtp ? `<div class="demo-otp">Demo code<br /><b>${state.demoOtp}</b></div>` : ""}
      <form id="reset-form">
        <div class="field">
          <label for="otp">Verification code</label>
          <input id="otp" name="otp" inputmode="numeric" maxlength="6" required />
        </div>
        <div class="field">
          <label for="password">New password</label>
          <div class="password-wrap">
            <input id="password" name="password" type="password" required maxlength="16" />
            ${eyeButton("password")}
          </div>
          <div class="strength weak" id="strength"><div class="bars"><span></span><span></span><span></span></div><b>Weak</b></div>
          <ul class="reqs" id="reqs"></ul>
        </div>
        <div class="field">
          <label for="confirmPassword">Confirm password</label>
          <div class="password-wrap">
            <input id="confirmPassword" name="confirmPassword" type="password" required maxlength="16" />
            ${eyeButton("confirmPassword")}
          </div>
          <div class="error" data-error="form"></div>
        </div>
        <button class="btn" type="submit">Update password</button>
      </form>
    </div>
  `);
}

function dashboardShell(roleLabel, body) {
  return `
    <div class="shell">
      <aside class="side">
        <div class="brand-mark"><span class="mark">C</span> Cop A Cap</div>
        <nav>
          <button class="nav-btn active" type="button" data-scroll="overview">Overview</button>
          <button class="nav-btn" type="button" data-scroll="security">Security</button>
          <button class="linkish" id="logout" type="button">Sign out</button>
        </nav>
      </aside>
      <main class="main">
        <div class="topbar" id="overview">
          <div>
            <div class="kicker">${roleLabel}</div>
            <h2 style="margin:8px 0 0">Hello, ${state.user?.fullName || "there"}</h2>
            <p class="lede">Access type is locked to this account and cannot be changed at login.</p>
          </div>
          <div class="topbar-actions">
            <button class="theme-toggle" type="button" aria-label="Toggle theme">${themeToggleIcon(getTheme())}</button>
          </div>
        </div>
        ${body}
      </main>
    </div>
  `;
}

function userDashboard(users = []) {
  const role = state.user.accessType;
  const stats = `
    <div class="stats">
      <div class="stat"><span>Access type</span><b>${role}</b></div>
      <div class="stat"><span>Registered email</span><b style="font-size:18px">${state.user.email}</b></div>
      <div class="stat"><span>Mobile</span><b style="font-size:18px">${state.user.mobile}</b></div>
    </div>
  `;
  const table =
    role === "User"
      ? ""
      : `
    <div class="panel">
      <h3 style="margin-top:0">Directory</h3>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Mobile</th></tr></thead>
        <tbody>
          ${users
            .map(
              (u) => `<tr>
                <td>${u.fullName}</td>
                <td>${u.email}</td>
                <td><span class="badge ${u.accessType === "Super Admin" ? "super" : u.accessType === "Admin" ? "admin" : ""}">${u.accessType}</span></td>
                <td>${u.mobile}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  return dashboardShell(
    role,
    `
    ${stats}
    <div class="panel" id="security">
      <h3 style="margin-top:0">Change password</h3>
      <form id="change-form" style="max-width:420px">
        <div class="field">
          <label>Current password</label>
          <div class="password-wrap">
            <input id="currentPassword" name="currentPassword" type="password" required />
            ${eyeButton("currentPassword")}
          </div>
        </div>
        <div class="field">
          <label>New password</label>
          <div class="password-wrap">
            <input id="password" name="password" type="password" required maxlength="16" />
            ${eyeButton("password")}
          </div>
          <div class="strength weak" id="strength"><div class="bars"><span></span><span></span><span></span></div><b>Weak</b></div>
          <ul class="reqs" id="reqs"></ul>
        </div>
        <div class="field">
          <label>Confirm password</label>
          <div class="password-wrap">
            <input id="confirmPassword" name="confirmPassword" type="password" required maxlength="16" />
            ${eyeButton("confirmPassword")}
          </div>
          <div class="error" data-error="form"></div>
        </div>
        <button class="btn" type="submit">Save password</button>
      </form>
    </div>
    ${table}
  `
  );
}

function setError(name, message) {
  const el = document.querySelector(`[data-error="${name}"]`);
  if (el) el.textContent = message || "";
}

function bindPasswordToggle() {
  document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.toggle);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = passwordEyeSvg(show);
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });
}

function renderPasswordMeter(input) {
  const strengthEl = document.getElementById("strength");
  const reqsEl = document.getElementById("reqs");
  if (!strengthEl || !reqsEl) return;

  const update = () => {
    const checks = passwordChecks(input.value);
    const strength = passwordStrength(input.value);
    strengthEl.className = `strength ${strength}`;
    strengthEl.querySelector("b").textContent =
      strength === "strong" ? "Strong" : strength === "average" ? "Average" : "Weak";
    reqsEl.innerHTML = `
      <li class="${checks.length ? "ok" : ""}">${checks.length ? "✅" : "❌"} 8–16 characters</li>
      <li class="${checks.upper ? "ok" : ""}">${checks.upper ? "✅" : "❌"} Uppercase letter</li>
      <li class="${checks.lower ? "ok" : ""}">${checks.lower ? "✅" : "❌"} Lowercase letter</li>
      <li class="${checks.number ? "ok" : ""}">${checks.number ? "✅" : "❌"} Number</li>
      <li class="${checks.special ? "ok" : ""}">${checks.special ? "✅" : "❌"} Special character</li>
    `;
  };
  input.addEventListener("input", update);
  update();
}

function bindLinks() {
  document.querySelectorAll("[data-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(a.getAttribute("href"));
    });
  });
}

function bindDashboardNav() {
  document.querySelectorAll("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => scrollToSection(btn.dataset.scroll));
  });
}

function toDisplayDate(y, m, d) {
  return `${pad(m)}/${pad(d)}/${y}`;
}

function syncBirthdayInputs() {
  const hidden = document.getElementById("birthday");
  const display = document.getElementById("birthdayDisplay");
  if (!hidden) return;
  if (calendarState.selected) {
    const { y, m, d } = calendarState.selected;
    hidden.value = toIso(y, m, d);
    if (display) display.value = toDisplayDate(y, m, d);
  } else {
    hidden.value = "";
  }
}

function openBirthdayCalendar() {
  const cal = document.getElementById("birthday-calendar");
  if (!cal) return;
  calendarState.open = true;
  if (calendarState.selected) {
    calendarState.viewYear = calendarState.selected.y;
    calendarState.viewMonth = calendarState.selected.m - 1;
    calendarState.yearConfirmed = true;
    calendarState.monthConfirmed = true;
    calendarState.mode = "days";
  } else if (!calendarState.yearConfirmed) {
    calendarState.mode = "years";
    alignYearPage(calendarState.viewYear);
  } else if (!calendarState.monthConfirmed) {
    calendarState.mode = "months";
  } else {
    calendarState.mode = "days";
  }
  cal.hidden = false;
  renderBirthdayCalendar();
}

function closeBirthdayCalendar() {
  const cal = document.getElementById("birthday-calendar");
  if (!cal) return;
  calendarState.open = false;
  cal.hidden = true;
}

function isBirthdaySelectable(y, m, d) {
  const max = maxBirthDate();
  const min = new Date(max.getFullYear() - 100, 0, 1);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return false;
  return date.getTime() <= max.getTime() && date.getTime() >= min.getTime();
}

function isMonthSelectable(year, monthIndex) {
  const max = maxBirthDate();
  const minYear = max.getFullYear() - 100;
  if (year < minYear || year > max.getFullYear()) return false;
  if (year === max.getFullYear() && monthIndex > max.getMonth()) return false;
  return true;
}

function validateBirthdayField() {
  const birthday = document.getElementById("birthday")?.value;
  if (birthday && !isAtLeast18(birthday)) {
    setError("birthday", "You must be at least 18 years old.");
  } else {
    setError("birthday", birthday ? "" : "");
  }
}

function getBirthdayYearBounds() {
  const max = maxBirthDate();
  return { minYear: max.getFullYear() - 100, maxYear: max.getFullYear() };
}

function alignYearPage(year) {
  const { minYear, maxYear } = getBirthdayYearBounds();
  const target = Math.min(Math.max(year, minYear), maxYear);
  const pageIndex = Math.floor((maxYear - target) / 12);
  calendarState.yearPageStart = maxYear - pageIndex * 12;
}

function getYearPageMeta() {
  const { minYear, maxYear } = getBirthdayYearBounds();
  const pageIndex = Math.floor((maxYear - calendarState.yearPageStart) / 12);
  const maxPageIndex = Math.floor((maxYear - minYear) / 12);
  return { minYear, maxYear, pageIndex, maxPageIndex };
}

function getYearPageYears() {
  const { minYear, maxYear } = getBirthdayYearBounds();
  const start = calendarState.yearPageStart || maxYear;
  const years = [];
  for (let y = start; y > start - 12 && y >= minYear; y--) years.push(y);
  return years;
}

function updateCalendarHeader() {
  const monthBtn = document.getElementById("calMonthBtn");
  const yearBtn = document.getElementById("calYearBtn");
  if (!monthBtn || !yearBtn) return;

  if (calendarState.mode === "years") {
    monthBtn.textContent = "1. Year";
    monthBtn.disabled = true;
    yearBtn.hidden = true;
    return;
  }

  if (calendarState.mode === "months") {
    monthBtn.textContent = "2. Month";
    monthBtn.disabled = true;
    yearBtn.hidden = false;
    yearBtn.textContent = String(calendarState.viewYear);
    return;
  }

  monthBtn.disabled = !calendarState.yearConfirmed;
  yearBtn.hidden = false;
  monthBtn.textContent = MONTH_NAMES[calendarState.viewMonth];
  yearBtn.textContent = String(calendarState.viewYear);
}

function renderBirthdayCalendar() {
  const grid = document.getElementById("calGrid");
  const weekdays = document.getElementById("calWeekdays");
  const prevBtn = document.querySelector("[data-cal-prev]");
  const nextBtn = document.querySelector("[data-cal-next]");
  if (!grid) return;

  const max = maxBirthDate();
  const { minYear, maxYear } = getBirthdayYearBounds();

  if (calendarState.mode === "years") {
    if (weekdays) weekdays.hidden = true;
    grid.className = "cal-grid cal-year-grid";
    updateCalendarHeader();
    const years = getYearPageYears();
    grid.innerHTML = years
      .map(
        (y) =>
          `<button type="button" class="cal-year-tile${calendarState.yearConfirmed && calendarState.viewYear === y ? " selected" : ""}" data-year="${y}">${y}</button>`
      )
      .join("");
    if (prevBtn) prevBtn.disabled = getYearPageMeta().pageIndex >= getYearPageMeta().maxPageIndex;
    if (nextBtn) nextBtn.disabled = getYearPageMeta().pageIndex <= 0;
    syncBirthdayInputs();
    return;
  }

  if (calendarState.mode === "months") {
    if (!calendarState.yearConfirmed) {
      calendarState.mode = "years";
      alignYearPage(calendarState.viewYear);
      renderBirthdayCalendar();
      return;
    }
    if (weekdays) weekdays.hidden = true;
    grid.className = "cal-grid cal-month-grid";
    updateCalendarHeader();
    grid.innerHTML = MONTH_SHORT.map((name, i) => {
      const allowed = isMonthSelectable(calendarState.viewYear, i);
      return `<button type="button" class="cal-month-tile${calendarState.monthConfirmed && calendarState.viewMonth === i ? " selected" : ""}${allowed ? "" : " disabled"}" data-month="${i}" ${allowed ? "" : "disabled"}>${name}</button>`;
    }).join("");
    if (prevBtn) prevBtn.disabled = calendarState.viewYear <= minYear;
    if (nextBtn) nextBtn.disabled = calendarState.viewYear >= maxYear;
    syncBirthdayInputs();
    return;
  }

  if (weekdays) weekdays.hidden = false;
  grid.className = "cal-grid";
  if (!calendarState.yearConfirmed || !calendarState.monthConfirmed) {
    calendarState.mode = !calendarState.yearConfirmed ? "years" : "months";
    if (calendarState.mode === "years") alignYearPage(calendarState.viewYear);
    renderBirthdayCalendar();
    return;
  }
  updateCalendarHeader();

  const { viewYear, viewMonth, selected } = calendarState;
  const viewStart = new Date(viewYear, viewMonth, 1);
  const minNav = new Date(minYear, 0, 1);
  const maxNav = new Date(maxYear, max.getMonth(), 1);
  if (prevBtn) prevBtn.disabled = viewStart <= minNav;
  if (nextBtn) nextBtn.disabled = viewStart >= maxNav;

  const firstDay = viewStart.getDay();
  const daysInCurr = daysInMonth(viewYear, viewMonth + 1);
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevMonthDays = daysInMonth(prevYear, prevMonth + 1);
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ y: prevYear, m: prevMonth + 1, d: prevMonthDays - i, outside: true });
  }
  for (let d = 1; d <= daysInCurr; d++) {
    cells.push({ y: viewYear, m: viewMonth + 1, d, outside: false });
  }
  let nextDay = 1;
  const nextMonth0 = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  while (cells.length % 7 !== 0) {
    cells.push({ y: nextYear, m: nextMonth0 + 1, d: nextDay++, outside: true });
  }

  grid.innerHTML = cells
    .map((cell) => {
      const selectable = isBirthdaySelectable(cell.y, cell.m, cell.d);
      const isSelected =
        selected && selected.y === cell.y && selected.m === cell.m && selected.d === cell.d;
      const cls = [
        "cal-day",
        cell.outside ? "outside" : "",
        !selectable ? "disabled" : "",
        isSelected ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-y="${cell.y}" data-m="${cell.m}" data-d="${cell.d}" ${!selectable ? "disabled" : ""}>${cell.d}</button>`;
    })
    .join("");

  syncBirthdayInputs();
}

function onDocumentCalendarClick(e) {
  if (!calendarState.open) return;
  const wrap = document.getElementById("birthday-wrap");
  if (wrap && !wrap.contains(e.target)) closeBirthdayCalendar();
}

if (!window.__atriumCalOutside) {
  window.__atriumCalOutside = true;
  document.addEventListener("click", onDocumentCalendarClick);
}

function bindBirthdayCalendar() {
  const wrap = document.getElementById("birthday-wrap");
  const cal = document.getElementById("birthday-calendar");
  const icon = document.getElementById("calIconBtn");
  const display = document.getElementById("birthdayDisplay");
  if (!wrap || !cal || !icon) return;

  const max = maxBirthDate();
  calendarState.viewYear = max.getFullYear();
  calendarState.viewMonth = max.getMonth();
  calendarState.selected = null;
  calendarState.mode = "years";
  calendarState.yearPageStart = max.getFullYear();
  calendarState.yearConfirmed = false;
  calendarState.monthConfirmed = false;
  calendarState.open = false;
  cal.hidden = true;
  if (display) display.value = "";
  document.getElementById("birthday").value = "";

  icon.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (calendarState.open) closeBirthdayCalendar();
    else openBirthdayCalendar();
  };

  display?.addEventListener("focus", () => openBirthdayCalendar());

  display?.addEventListener("input", () => {
    const digits = display.value.replace(/\D/g, "").slice(0, 8);
    let next = digits;
    if (digits.length > 4) next = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) next = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    display.value = next;
    if (digits.length === 8) {
      const m = Number(digits.slice(0, 2));
      const d = Number(digits.slice(2, 4));
      const y = Number(digits.slice(4));
      if (isBirthdaySelectable(y, m, d) && isAtLeast18(toIso(y, m, d))) {
        calendarState.selected = { y, m, d };
        calendarState.viewYear = y;
        calendarState.viewMonth = m - 1;
        calendarState.yearConfirmed = true;
        calendarState.monthConfirmed = true;
        syncBirthdayInputs();
        setError("birthday", "");
        if (calendarState.open) renderBirthdayCalendar();
      } else {
        calendarState.selected = null;
        calendarState.yearConfirmed = false;
        calendarState.monthConfirmed = false;
        document.getElementById("birthday").value = "";
        setError("birthday", "Enter a valid date. You must be at least 18.");
      }
    } else {
      calendarState.selected = null;
      calendarState.yearConfirmed = false;
      calendarState.monthConfirmed = false;
      document.getElementById("birthday").value = "";
    }
  });

  cal.onclick = (e) => {
    e.stopPropagation();
    if (e.target.closest("[data-cal-month-open]")) {
      if (!calendarState.yearConfirmed) {
        calendarState.mode = "years";
        alignYearPage(calendarState.viewYear);
      } else {
        calendarState.mode = "months";
      }
      renderBirthdayCalendar();
      return;
    }
    if (e.target.closest("[data-cal-year-open]")) {
      calendarState.mode = "years";
      alignYearPage(calendarState.viewYear);
      renderBirthdayCalendar();
      return;
    }

    if (e.target.closest("[data-cal-prev]")) {
      if (calendarState.mode === "years") {
        const { maxYear, pageIndex, maxPageIndex } = getYearPageMeta();
        if (pageIndex < maxPageIndex) calendarState.yearPageStart = maxYear - (pageIndex + 1) * 12;
      } else if (calendarState.mode === "months") {
        if (calendarState.viewYear > getBirthdayYearBounds().minYear) {
          calendarState.viewYear -= 1;
          calendarState.yearConfirmed = true;
          calendarState.monthConfirmed = false;
          calendarState.selected = null;
          syncBirthdayInputs();
        }
      } else if (calendarState.monthConfirmed) {
        if (calendarState.viewMonth === 0) {
          if (calendarState.viewYear <= getBirthdayYearBounds().minYear) {
            renderBirthdayCalendar();
            return;
          }
          calendarState.viewMonth = 11;
          calendarState.viewYear -= 1;
          calendarState.yearConfirmed = true;
        } else {
          calendarState.viewMonth -= 1;
        }
        calendarState.monthConfirmed = true;
      }
      renderBirthdayCalendar();
      return;
    }

    if (e.target.closest("[data-cal-next]")) {
      if (calendarState.mode === "years") {
        const { maxYear, pageIndex } = getYearPageMeta();
        if (pageIndex > 0) calendarState.yearPageStart = maxYear - (pageIndex - 1) * 12;
      } else if (calendarState.mode === "months") {
        if (calendarState.viewYear < getBirthdayYearBounds().maxYear) {
          calendarState.viewYear += 1;
          calendarState.yearConfirmed = true;
          calendarState.monthConfirmed = false;
          calendarState.selected = null;
          syncBirthdayInputs();
        }
      } else if (calendarState.monthConfirmed) {
        if (calendarState.viewMonth === 11) {
          if (calendarState.viewYear >= getBirthdayYearBounds().maxYear) {
            renderBirthdayCalendar();
            return;
          }
          calendarState.viewMonth = 0;
          calendarState.viewYear += 1;
          calendarState.yearConfirmed = true;
        } else {
          calendarState.viewMonth += 1;
        }
        calendarState.monthConfirmed = true;
      }
      renderBirthdayCalendar();
      return;
    }

    const yearTile = e.target.closest(".cal-year-tile");
    if (yearTile) {
      calendarState.viewYear = Number(yearTile.dataset.year);
      calendarState.yearConfirmed = true;
      calendarState.monthConfirmed = false;
      calendarState.selected = null;
      syncBirthdayInputs();
      if (!isMonthSelectable(calendarState.viewYear, calendarState.viewMonth)) {
        calendarState.viewMonth = 0;
      }
      calendarState.mode = "months";
      renderBirthdayCalendar();
      return;
    }

    const monthTile = e.target.closest(".cal-month-tile:not(.disabled):not([disabled])");
    if (monthTile) {
      if (!calendarState.yearConfirmed) {
        calendarState.mode = "years";
        alignYearPage(calendarState.viewYear);
        renderBirthdayCalendar();
        return;
      }
      calendarState.viewMonth = Number(monthTile.dataset.month);
      calendarState.monthConfirmed = true;
      calendarState.selected = null;
      syncBirthdayInputs();
      calendarState.mode = "days";
      renderBirthdayCalendar();
      return;
    }

    const day = e.target.closest(".cal-day:not(.disabled):not([disabled])");
    if (!day) return;
    if (!calendarState.yearConfirmed || !calendarState.monthConfirmed) {
      calendarState.mode = !calendarState.yearConfirmed ? "years" : "months";
      if (calendarState.mode === "years") alignYearPage(calendarState.viewYear);
      renderBirthdayCalendar();
      return;
    }
    calendarState.selected = {
      y: Number(day.dataset.y),
      m: Number(day.dataset.m),
      d: Number(day.dataset.d),
    };
    calendarState.viewYear = calendarState.selected.y;
    calendarState.viewMonth = calendarState.selected.m - 1;
    calendarState.yearConfirmed = true;
    calendarState.monthConfirmed = true;
    syncBirthdayInputs();
    validateBirthdayField();
    closeBirthdayCalendar();
  };
}

function bindSignup() {
  const form = document.getElementById("signup-form");
  const fullName = document.getElementById("fullName");
  const email = document.getElementById("email");
  const username = document.getElementById("username");
  const mobile = document.getElementById("mobile");
  const password = document.getElementById("password");
  const confirm = document.getElementById("confirmPassword");

  renderPasswordMeter(password);
  ["paste", "drop", "copy", "cut"].forEach((evt) => {
    confirm.addEventListener(evt, (e) => e.preventDefault());
  });

  fullName.addEventListener("input", () => {
    const filtered = fullName.value.replace(/[^A-Za-zÀ-ÿÑñ\s.\-]/g, "");
    if (filtered !== fullName.value) fullName.value = filtered;
    const ok = !fullName.value || lettersOnlyName(fullName.value);
    fullName.setAttribute("aria-invalid", ok ? "false" : "true");
    setError(
      "fullName",
      ok ? "" : "Full name may contain letters, spaces, periods, and dashes only. Numbers are not allowed."
    );
  });

  fullName.addEventListener("keydown", (e) => {
    if (/^\d$/.test(e.key)) e.preventDefault();
  });

  fullName.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData("text") || "").replace(/[^A-Za-zÀ-ÿÑñ\s.\-]/g, "");
    fullName.value = text;
    fullName.dispatchEvent(new Event("input"));
  });

  email.addEventListener("input", () => {
    username.value = email.value.trim().toLowerCase();
  });

  email.addEventListener("blur", async () => {
    if (!isValidEmail(email.value)) {
      email.setAttribute("aria-invalid", "true");
      setError("email", "Enter a valid email address, including a valid domain.");
      return;
    }
    const data = await api("/api/email/available", {
      method: "POST",
      body: JSON.stringify({ email: email.value }),
    });
    email.setAttribute("aria-invalid", data.available ? "false" : "true");
    setError("email", data.error || "");
  });

  mobile.addEventListener("input", () => {
    const ok = !mobile.value || isValidPhMobile(mobile.value);
    mobile.setAttribute("aria-invalid", ok ? "false" : "true");
    setError(
      "mobile",
      ok ? "" : "Use 09XXXXXXXXX (11 digits) or +639XXXXXXXXX. Letters and extra symbols are not allowed."
    );
  });

  bindBirthdayCalendar();

  confirm.addEventListener("input", () => {
    setError("confirmPassword", confirm.value && confirm.value !== password.value ? "Passwords do not match." : "");
  });

  document.getElementById("signupAgree")?.addEventListener("change", () => setError("agree", ""));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const requiredFields = [
      ["fullName", "Enter your full name."],
      ["address", "Enter your address."],
      ["email", "Enter your email address."],
      ["mobile", "Enter your mobile number."],
      ["accessType", "Select an access type."],
      ["password", "Enter a password."],
      ["confirmPassword", "Confirm your password."],
    ];
    let firstInvalid = null;
    requiredFields.forEach(([id, message]) => {
      const el = document.getElementById(id);
      const empty = !el?.value?.trim();
      setError(id, empty ? message : "");
      if (empty && !firstInvalid) firstInvalid = el;
    });

    const birthday = document.getElementById("birthday").value;
    if (!birthday) {
      setError("birthday", "Please select your complete birthday.");
      firstInvalid ||= document.getElementById("birthdayDisplay");
    } else if (!isAtLeast18(birthday)) {
      setError("birthday", "You must be at least 18 years old.");
      firstInvalid ||= document.getElementById("birthdayDisplay");
    } else {
      setError("birthday", "");
    }

    if (firstInvalid) {
      firstInvalid.focus?.();
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const formAgree = document.getElementById("signupAgree");
    const agreed = await openPrivacyModal({ requireAgree: true });
    if (!agreed) {
      setError("agree", "You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    if (formAgree) formAgree.checked = true;
    setError("agree", "");

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.username = payload.email.trim().toLowerCase();
    payload.email = payload.username;
    try {
      const data = await withLoading("Sending verification code", () =>
        api("/api/register/request-otp", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
      state.otpEmail = payload.email;
      state.otpMode = "register";
      state.demoOtp = data.demoOtp || "";
      await showModal({
        type: "success",
        title: "Code sent",
        message: `A verification code was sent to ${payload.email}. Enter it on the next screen to finish creating your account.`,
        autoClose: 1500,
      });
      navigate("/verify");
    } catch (err) {
      const errors = err.payload?.errors || {};
      Object.entries(errors).forEach(([k, v]) => setError(k, v));
      await showModal({
        type: "error",
        title: "Registration unsuccessful",
        message: err.message || "We could not start your registration. Please review your details and try again.",
        autoClose: 1500,
      });
    }
  });
}

function bindOtpInputs() {
  const boxes = [...document.querySelectorAll("[data-otp]")];
  boxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(0, 1);
      if (box.value && boxes[i + 1]) boxes[i + 1].focus();
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && boxes[i - 1]) boxes[i - 1].focus();
    });
    box.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      text.split("").forEach((ch, idx) => {
        if (boxes[idx]) boxes[idx].value = ch;
      });
      boxes[Math.min(text.length, 5)]?.focus();
    });
  });
  return () => boxes.map((b) => b.value).join("");
}

async function bindLogout() {
  document.getElementById("logout")?.addEventListener("click", async () => {
    const confirmed = await showModal({
      type: "confirm",
      title: "Sign out?",
      message: "Are you sure you want to exit Cop A Cap?",
      confirmText: "Yes",
      cancelText: "No",
    });
    if (!confirmed) return;
    await withLoading("Signing out", async () => {
      await api("/api/logout", { method: "POST" }).catch(() => {});
      localStorage.removeItem("atrium_token");
      state.user = null;
      navigate("/");
    });
  });
}

function isStaff(user) {
  return ["Admin", "Super Admin"].includes(user?.accessType);
}

function homeFor(user) {
  return isStaff(user) ? "/admin" : "/app";
}

async function render() {
  const path = pathOnly(state.view);
  state.view = path;
  const authed = isShopPath(path) || isAdminPath(path);

  if (authed) {
    if (!token()) {
      navigate("/");
      return;
    }
    try {
      const me = await withLoading(isAdminPath(path) ? "Opening admin" : "Opening shop", async () => {
        const data = await api("/api/me");
        await loadInventory(api);
        if (!isStaff(data.user)) await loadWallet(api);
        return data;
      });
      state.user = me.user;
      if (isAdminPath(path) && !isStaff(state.user)) {
        navigate(homeFor(state.user));
        return;
      }
      if (isShopPath(path) && isStaff(state.user)) {
        navigate("/admin");
        return;
      }
      if (isAdminPath(path)) {
        app.innerHTML = renderAdminView({ path, user: state.user });
        bindLinks();
        bindGlobalControls();
        bindAdminActions({ api, toast, navigate });
        await bindLogout();
        return;
      }
      app.innerHTML = renderShopView({ path, user: state.user });
      bindLinks();
      bindGlobalControls();
      bindShopActions({ navigate, toast, api, user: state.user });
      await bindLogout();
      const hash = location.hash.replace(/^#/, "");
      if (hash) {
        requestAnimationFrame(() => scrollToSection(hash));
      }
    } catch {
      localStorage.removeItem("atrium_token");
      navigate("/");
    }
    return;
  }

  if (path === "/signup") {
    app.innerHTML = signupView();
    bindPasswordToggle();
    bindLinks();
    bindGlobalControls();
    bindSignup();
    return;
  }

  if (path === "/verify") {
    if (!state.otpEmail) {
      navigate("/signup");
      return;
    }
    app.innerHTML = otpView();
    bindLinks();
    bindGlobalControls();
    const readOtp = bindOtpInputs();
    document.getElementById("otp-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const otp = readOtp();
      try {
        const data = await withLoading("Verifying your code", () =>
          api("/api/register/verify", {
            method: "POST",
            body: JSON.stringify({ email: state.otpEmail, otp }),
          })
        );
        localStorage.setItem("atrium_token", data.token);
        state.user = data.user;
        await showModal({
          type: "success",
          title: "Account created",
          message: `Welcome, ${data.user.fullName}. You’re in — time to cop.`,
          autoClose: 1500,
        });
        navigate(homeFor(data.user));
      } catch (err) {
        setError("otp", err.message);
        await showModal({
          type: "error",
          title: "Registration unsuccessful",
          message: err.message || "The verification code could not be confirmed.",
          autoClose: 1500,
        });
      }
    });
    document.getElementById("resend").addEventListener("click", async () => {
      try {
        const data = await withLoading("Sending a new code", () =>
          api("/api/register/resend-otp", {
            method: "POST",
            body: JSON.stringify({ email: state.otpEmail }),
          })
        );
        state.demoOtp = data.demoOtp || "";
        render();
        await showModal({
          type: "success",
          title: "Code sent",
          message: data.message || "A new verification code is on its way.",
          autoClose: 1500,
        });
      } catch (err) {
        await showModal({
          type: "error",
          title: "Could not resend",
          message: err.message,
          confirmText: "OK",
        });
      }
    });
    return;
  }

  if (path === "/forgot") {
    app.innerHTML = forgotView();
    bindLinks();
    bindGlobalControls();
    document.getElementById("forgot-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = e.target.email.value.trim().toLowerCase();
      try {
        const data = await withLoading("Sending reset code", () =>
          api("/api/password/forgot", {
            method: "POST",
            body: JSON.stringify({ email }),
          })
        );
        state.resetEmail = email;
        state.otpEmail = email;
        state.demoOtp = data.demoOtp || "";
        await showModal({
          type: "success",
          title: "Check your email",
          message: data.message || "If an account exists, a verification code has been sent.",
          autoClose: 1500,
        });
        navigate("/reset");
      } catch (err) {
        setError("email", err.message);
        await showModal({
          type: "error",
          title: "Request unsuccessful",
          message: err.message,
          autoClose: 1500,
        });
      }
    });
    return;
  }

  if (path === "/reset") {
    app.innerHTML = resetView();
    bindPasswordToggle();
    bindLinks();
    bindGlobalControls();
    renderPasswordMeter(document.getElementById("password"));
    document.getElementById("reset-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      payload.email = state.resetEmail || state.otpEmail;
      try {
        const data = await withLoading("Updating password", () =>
          api("/api/password/reset", {
            method: "POST",
            body: JSON.stringify(payload),
          })
        );
        localStorage.setItem("atrium_token", data.token);
        state.user = data.user;
        await showModal({
          type: "success",
          title: "Password updated",
          message: "Your new password is saved. Taking you to the shop.",
          autoClose: 1500,
        });
        navigate(homeFor(data.user));
      } catch (err) {
        setError("form", err.message);
        await showModal({
          type: "error",
          title: "Reset unsuccessful",
          message: err.message,
          autoClose: 1500,
        });
      }
    });
    return;
  }

  app.innerHTML = loginView();
  bindPasswordToggle();
  bindLinks();
  bindGlobalControls();
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const data = await withLoading("Signing you in", () =>
        api("/api/login", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
      localStorage.setItem("atrium_token", data.token);
      state.user = data.user;
      navigate(data.redirect || homeFor(data.user));
    } catch (err) {
      setError("password", err.message);
      await showModal({
        type: "error",
        title: "Sign-in unsuccessful",
        message: err.message || "Check your email and password, then try again.",
        confirmText: "Try again",
      });
    }
  });
}

render();
