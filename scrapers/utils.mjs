/**
 * Shared utilities for all TonightInMTL scrapers
 */

// ── date helpers ─────────────────────────────────────────────────────────

const MONTH_MAP = {
  JANVIER: "01", JANUARY: "01",
  FÉVRIER: "02", FEVRIER: "02", FEBRUARY: "02",
  MARS: "03",    MARCH: "03",
  AVRIL: "04",   APRIL: "04",
  MAI: "05",     MAY: "05",
  JUIN: "06",    JUNE: "06",
  JUILLET: "07", JULY: "07",
  AOÛT: "08",    AOUT: "08",   AUGUST: "08",
  SEPTEMBRE: "09", SEPTEMBER: "09",
  OCTOBRE: "10",   OCTOBER: "10",
  NOVEMBRE: "11",  NOVEMBER: "11",
  DÉCEMBRE: "12",  DECEMBRE: "12", DECEMBER: "12",
};

export function monthToNumber(fr) {
  return MONTH_MAP[fr.toUpperCase()] ?? "";
}

// ── time normalisation ───────────────────────────────────────────────────
// Accepts hour (string/number), minute (string/number|null), meridiem (string|null)
// Returns "HH:MM" in 24h, or "" if invalid.
export function normalizeTime(h, min, meridiem) {
  let hour = parseInt(h, 10);
  let m    = min ? parseInt(min, 10) : 0;
  const mer = (meridiem ?? "").toLowerCase();

  if (isNaN(hour) || isNaN(m)) return "";

  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  // If no meridiem and hour < 8, assume PM (most shows are evening)
  if (!mer && hour > 0 && hour < 8) hour += 12;

  if (hour > 23 || m > 59) return "";

  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── slug ─────────────────────────────────────────────────────────────────

export function slug(title, date) {
  return `${date}_${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

// ── async sleep ──────────────────────────────────────────────────────────

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── date range helpers ───────────────────────────────────────────────────

/** Returns ISO date string for N days from today */
export function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today as ISO date string */
export function today() {
  return new Date().toISOString().slice(0, 10);
}
