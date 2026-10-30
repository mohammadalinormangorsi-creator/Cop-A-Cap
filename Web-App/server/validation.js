const NAME_PATTERN = /^[A-Za-zÀ-ÿÑñ\s.\-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const PH_MOBILE_PATTERN = /^(09\d{9}|\+639\d{9})$/;
const PASSWORD_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const ACCESS_TYPES = ["Super Admin", "Admin", "User"];

function lettersOnlyName(value) {
  return NAME_PATTERN.test(String(value || "").trim());
}

function isValidEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return false;
  const domain = email.split("@")[1] || "";
  if (!domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (domain.includes("..")) return false;
  return true;
}

function isValidPhMobile(value) {
  const raw = String(value || "").replace(/\s/g, "");
  return PH_MOBILE_PATTERN.test(raw);
}

function normalizeMobile(value) {
  const raw = String(value || "").replace(/\s/g, "");
  if (raw.startsWith("+639") && raw.length === 13) {
    return "0" + raw.slice(3);
  }
  return raw;
}

function passwordChecks(password) {
  const value = String(password || "");
  return {
    length: value.length >= 8 && value.length <= 16,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /\d/.test(value),
    special: PASSWORD_SPECIAL.test(value),
  };
}

function isStrongPassword(password) {
  const checks = passwordChecks(password);
  return Object.values(checks).every(Boolean);
}

function maxBirthDate(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

function parseDateOnly(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, day] = value.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function isAtLeast18(value, now = new Date()) {
  const birth = parseDateOnly(value);
  if (!birth) return false;
  const max = maxBirthDate(now);
  return birth.getTime() <= max.getTime();
}

function isFutureDate(value, now = new Date()) {
  const date = parseDateOnly(value);
  if (!date) return true;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date.getTime() > today.getTime();
}

function passwordStrength(password) {
  const checks = passwordChecks(password);
  const met = Object.values(checks).filter(Boolean).length;
  if (met === 5) return "strong";
  if (met >= 3) return "average";
  return "weak";
}

function validateSignupPayload(body) {
  const errors = {};
  const fullName = String(body.fullName || "").trim();
  const birthday = String(body.birthday || "").trim();
  const address = String(body.address || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const username = String(body.username || "").trim().toLowerCase();
  const mobile = String(body.mobile || "").replace(/\s/g, "");
  const password = String(body.password || "");
  const confirmPassword = String(body.confirmPassword || "");
  const accessType = String(body.accessType || "");

  if (!fullName) errors.fullName = "Full name is required.";
  else if (!lettersOnlyName(fullName)) {
    errors.fullName =
      "Full name may contain letters, spaces, periods, and dashes only. Numbers are not allowed.";
  }

  if (!birthday) errors.birthday = "Birthday is required.";
  else if (!parseDateOnly(birthday)) errors.birthday = "Enter a valid date.";
  else if (isFutureDate(birthday)) errors.birthday = "Birthday cannot be in the future.";
  else if (!isAtLeast18(birthday)) {
    errors.birthday = "You must be at least 18 years old to create an account.";
  }

  if (!address) errors.address = "Address is required.";
  else if (address.length < 8) errors.address = "Please enter a complete address.";

  if (!email) errors.email = "Email address is required.";
  else if (!isValidEmail(email)) {
    errors.email = "Enter a valid email address, including a valid domain.";
  }

  if (!username) errors.username = "Username is required.";
  else if (username !== email) {
    errors.username = "Username must be the same as your email address.";
  }

  if (!mobile) errors.mobile = "Mobile phone number is required.";
  else if (!isValidPhMobile(mobile)) {
    errors.mobile =
      "Use a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX.";
  }

  if (!password) errors.password = "Password is required.";
  else if (!isStrongPassword(password)) {
    errors.password =
      "Password must be 8–16 characters and include uppercase, lowercase, a number, and a special character.";
  }

  if (!confirmPassword) errors.confirmPassword = "Please confirm your password.";
  else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (!ACCESS_TYPES.includes(accessType)) {
    errors.accessType = "Select a valid access type.";
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0,
    data: {
      fullName,
      birthday,
      address,
      email,
      username: email,
      mobile: normalizeMobile(mobile),
      password,
      accessType,
    },
  };
}

module.exports = {
  ACCESS_TYPES,
  lettersOnlyName,
  isValidEmail,
  isValidPhMobile,
  normalizeMobile,
  passwordChecks,
  isStrongPassword,
  maxBirthDate,
  isAtLeast18,
  passwordStrength,
  validateSignupPayload,
};
