export const NAME_PATTERN = /^[A-Za-zÀ-ÿÑñ\s.\-]+$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
export const PH_MOBILE_PATTERN = /^(09\d{9}|\+639\d{9})$/;
export const PASSWORD_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function lettersOnlyName(value) {
  return NAME_PATTERN.test(String(value || "").trim());
}

export function isValidEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return false;
  const domain = email.split("@")[1] || "";
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".") && !domain.includes("..");
}

export function isValidPhMobile(value) {
  return PH_MOBILE_PATTERN.test(String(value || "").replace(/\s/g, ""));
}

export function passwordChecks(password) {
  const value = String(password || "");
  return {
    length: value.length >= 8 && value.length <= 16,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /\d/.test(value),
    special: PASSWORD_SPECIAL.test(value),
  };
}

export function passwordStrength(password) {
  const met = Object.values(passwordChecks(password)).filter(Boolean).length;
  if (met === 5) return "strong";
  if (met >= 3) return "average";
  return "weak";
}

export function maxBirthDate(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

export function parseDateOnly(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, day] = value.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== day) return null;
  return date;
}

export function isAtLeast18(value, now = new Date()) {
  const birth = parseDateOnly(value);
  if (!birth) return false;
  const max = maxBirthDate(now);
  return birth.getTime() <= max.getTime();
}

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function toIso(y, m, d) {
  if (!y || !m || !d) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
