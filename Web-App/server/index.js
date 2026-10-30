const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const {
  findUserByEmail,
  saveUser,
  allUsers,
  getInventory,
  getCatalogMap,
  updateCatalogItem,
  getWallet,
  checkoutOrder,
  getSalesReport,
  getSalesCalendar,
} = require("./store");
const { sendOtpEmail, isConfigured } = require("./mailer");
const {
  validateSignupPayload,
  isValidEmail,
  isStrongPassword,
  ACCESS_TYPES,
} = require("./validation");

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 45 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const HISTORY_LIMIT = 8;

const pendingSignups = new Map();
const pendingResets = new Map();
const sessions = new Map();

app.use(express.json({ limit: "1mb" }));
app.use(
  express.static(path.join(__dirname, "..", "public"), {
    etag: false,
    lastModified: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".js") || filePath.endsWith(".css") || filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    birthday: user.birthday,
    address: user.address,
    email: user.email,
    username: user.username,
    mobile: user.mobile,
    accessType: user.accessType,
    createdAt: user.createdAt,
  };
}

function getSession(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Please sign in to continue." });
  const user = findUserByEmail(session.email);
  if (!user) return res.status(401).json({ error: "Session is no longer valid." });
  req.user = user;
  req.sessionToken = session.token;
  next();
}

function landingFor(accessType) {
  if (accessType === "Admin" || accessType === "Super Admin") return "/admin";
  return "/app";
}

function requireAdmin(req, res, next) {
  if (!["Admin", "Super Admin"].includes(req.user.accessType)) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

function issueSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    token,
    email: user.email,
    accessType: user.accessType,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function createOtpRecord(destination) {
  const otp = generateOtp();
  return {
    destination,
    otpHash: hashOtp(otp),
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    sentAt: Date.now(),
  };
}

async function issueAndSendOtp(email, purpose) {
  const record = createOtpRecord(email);
  await sendOtpEmail(email, record.otp, purpose);
  delete record.otp;
  return record;
}

function mailErrorMessage(err) {
  console.error("OTP email failed:", err.message);
  return "We could not send the verification email. Check GMAIL_USER and GMAIL_PASSWORD, and use a Gmail App Password.";
}

function verifyOtpRecord(record, otp) {
  if (!record) return { ok: false, error: "No verification code found. Please request a new one." };
  if (Date.now() > record.expiresAt) {
    return { ok: false, error: "This code has expired. Please request a new one." };
  }
  if (record.attempts >= 5) {
    return { ok: false, error: "Too many incorrect codes. Please request a new one." };
  }
  record.attempts += 1;
  if (hashOtp(String(otp || "")) !== record.otpHash) {
    return { ok: false, error: "Incorrect verification code. Please try again." };
  }
  return { ok: true };
}

function canResend(record) {
  return !record || Date.now() - record.sentAt >= OTP_RESEND_MS;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/meta", (_req, res) => {
  const max = new Date();
  max.setFullYear(max.getFullYear() - 18);
  const iso = max.toISOString().slice(0, 10);
  res.json({
    minAge: 18,
    maxBirthday: iso,
    minBirthday: `${max.getFullYear() - 102}-01-01`,
    accessTypes: ACCESS_TYPES,
  });
});

app.post("/api/email/available", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return res.json({ available: false, error: "Enter a valid email address, including a valid domain." });
  }
  const exists = Boolean(findUserByEmail(email));
  res.json({
    available: !exists,
    error: exists
      ? "Email already registered. Please use a different email address or reset your password."
      : null,
  });
});

app.post("/api/register/request-otp", authLimiter, async (req, res) => {
  const { valid, errors, data } = validateSignupPayload(req.body);
  if (!valid) return res.status(400).json({ errors });

  if (findUserByEmail(data.email)) {
    return res.status(409).json({
      errors: {
        email:
          "Email already registered. Please use a different email address or reset your password.",
      },
    });
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  try {
    const otpRecord = await issueAndSendOtp(data.email, "register");
    pendingSignups.set(data.email, {
      ...data,
      passwordHash,
      otp: otpRecord,
    });
  } catch (err) {
    return res.status(502).json({ error: mailErrorMessage(err) });
  }

  res.json({
    ok: true,
    message: `A 6-digit verification code was sent to ${data.email}. Check your Gmail inbox.`,
    expiresInSeconds: OTP_TTL_MS / 1000,
  });
});

app.post("/api/register/resend-otp", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const pending = pendingSignups.get(email);
  if (!pending) {
    return res.status(404).json({ error: "No pending registration found for this email." });
  }
  if (!canResend(pending.otp)) {
    const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - pending.otp.sentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${wait}s before requesting a new code.` });
  }
  try {
    pending.otp = await issueAndSendOtp(email, "register");
  } catch (err) {
    return res.status(502).json({ error: mailErrorMessage(err) });
  }
  res.json({
    ok: true,
    message: `A new verification code was sent to ${email}. Check your Gmail inbox.`,
  });
});

app.post("/api/register/verify", authLimiter, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const otp = String(req.body.otp || "").trim();
  const pending = pendingSignups.get(email);
  const result = verifyOtpRecord(pending?.otp, otp);
  if (!result.ok) return res.status(400).json({ error: result.error });

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    fullName: pending.fullName,
    birthday: pending.birthday,
    address: pending.address,
    email: pending.email,
    username: pending.username,
    mobile: pending.mobile,
    accessType: pending.accessType,
    passwordHash: pending.passwordHash,
    passwordHistory: [pending.passwordHash],
    createdAt: now,
    verifiedAt: now,
  };
  saveUser(user);
  pendingSignups.delete(email);
  const token = issueSession(user);
  res.json({
    ok: true,
    token,
    user: publicUser(user),
    redirect: landingFor(user.accessType),
  });
});

app.post("/api/login", authLimiter, async (req, res) => {
  const email = String(req.body.email || req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = issueSession(user);
  res.json({
    ok: true,
    token,
    user: publicUser(user),
    redirect: landingFor(user.accessType),
  });
});

app.post("/api/password/forgot", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  const user = findUserByEmail(email);
  if (!user) {
    return res.json({
      ok: true,
      message: "If an account exists for this email, a verification code has been sent.",
    });
  }
  try {
    const otp = await issueAndSendOtp(email, "reset");
    pendingResets.set(email, { email, otp });
  } catch (err) {
    return res.status(502).json({ error: mailErrorMessage(err) });
  }
  res.json({
    ok: true,
    message: `A verification code was sent to ${email}. Check your Gmail inbox.`,
  });
});

app.post("/api/password/reset", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const otp = String(req.body.otp || "").trim();
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error:
        "Password must be 8–16 characters and include uppercase, lowercase, a number, and a special character.",
    });
  }

  const pending = pendingResets.get(email);
  const result = verifyOtpRecord(pending?.otp, otp);
  if (!result.ok) return res.status(400).json({ error: result.error });

  const user = findUserByEmail(email);
  if (!user) return res.status(404).json({ error: "Account not found." });

  for (const oldHash of user.passwordHistory || []) {
    if (await bcrypt.compare(password, oldHash)) {
      return res.status(400).json({
        error: "You cannot reuse a previous password. Please choose a new password.",
      });
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.passwordHash = passwordHash;
  user.passwordHistory = [passwordHash, ...(user.passwordHistory || [])].slice(0, HISTORY_LIMIT);
  user.updatedAt = new Date().toISOString();
  saveUser(user);
  pendingResets.delete(email);

  const token = issueSession(user);
  res.json({
    ok: true,
    message: "Password updated. Signing you in.",
    token,
    user: publicUser(user),
    redirect: landingFor(user.accessType),
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/inventory", requireAuth, (_req, res) => {
  res.json({ stocks: getInventory() });
});

app.get("/api/catalog", requireAuth, (_req, res) => {
  res.json({ catalog: getCatalogMap() });
});

app.get("/api/wallet", requireAuth, (req, res) => {
  res.json({ wallet: getWallet(req.user.id) });
});

app.post("/api/inventory/purchase", requireAuth, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) {
    return res.status(400).json({ error: "Your cart is empty." });
  }
  const result = checkoutOrder({
    items,
    buyer: req.body.buyer || {},
    method: String(req.body.method || ""),
    user: req.user,
    paymentProof: req.body.paymentProof || "",
  });
  if (!result.ok) {
    return res.status(400).json({
      error: result.error,
      stocks: result.stocks,
      wallet: result.wallet,
    });
  }
  res.json({
    ok: true,
    stocks: result.stocks,
    catalog: result.catalog,
    order: result.order,
    wallet: result.wallet,
  });
});

app.patch("/api/admin/catalog", requireAuth, requireAdmin, (req, res) => {
  const result = updateCatalogItem({
    id: String(req.body.id || ""),
    price: req.body.price,
    stock: req.body.stock,
    available: req.body.available,
  });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true, catalog: result.catalog });
});

app.get("/api/admin/sales", requireAuth, requireAdmin, (req, res) => {
  const period = String(req.query.period || "monthly");
  const date = req.query.date ? String(req.query.date) : undefined;
  res.json(getSalesReport({ period, date }));
});

app.get("/api/admin/sales/calendar", requireAuth, requireAdmin, (req, res) => {
  res.json(
    getSalesCalendar({
      year: req.query.year,
      month: req.query.month,
    })
  );
});

app.get("/api/admin/users", requireAuth, (req, res) => {
  if (!["Admin", "Super Admin"].includes(req.user.accessType)) {
    return res.status(403).json({ error: "You do not have access to this resource." });
  }
  const users = allUsers().map((u) => publicUser(u));
  res.json({ users });
});

app.post("/api/password/change", requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");

  const match = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!match) return res.status(400).json({ error: "Current password is incorrect." });
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error:
        "Password must be 8–16 characters and include uppercase, lowercase, a number, and a special character.",
    });
  }

  for (const oldHash of req.user.passwordHistory || []) {
    if (await bcrypt.compare(password, oldHash)) {
      return res.status(400).json({
        error: "You cannot reuse a previous password. Please choose a new password.",
      });
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  req.user.passwordHash = passwordHash;
  req.user.passwordHistory = [passwordHash, ...(req.user.passwordHistory || [])].slice(
    0,
    HISTORY_LIMIT
  );
  req.user.updatedAt = new Date().toISOString();
  saveUser(req.user);
  res.json({ ok: true, message: "Password updated successfully." });
});

app.post("/api/logout", requireAuth, (req, res) => {
  sessions.delete(req.sessionToken);
  res.json({ ok: true });
});

app.get(
  ["/", "/login", "/signup", "/forgot", "/verify", "/reset", "/app", "/admin", "/super-admin"],
  (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  }
);

app.get("*", (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api/")) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Cop A Cap running at http://localhost:${PORT}`);
  console.log(isConfigured() ? "Gmail OTP delivery is enabled." : "Gmail OTP delivery is not configured.");
});
