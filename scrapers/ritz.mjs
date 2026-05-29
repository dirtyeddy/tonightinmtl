/**
 * scraper: Bar le Ritz PDB
 * https://www.barleritzpdb.com/vnements
 *
 * Uses plain fetch + regex on the rendered text — no Puppeteer.
 * The page is a Wix site that SSR-renders its event list in the HTML,
 * so a single fetch is enough.
 */

import { JSDOM } from "jsdom";
import { slug, monthToNumber, normalizeTime } from "./utils.mjs";

const SOURCE_URL = "https://www.barleritzpdb.com/vnements";
const VENUE      = "Bar le Ritz PDB";
const HOOD       = "Mile End";

// ── date ───────────────────────────────────────────────────────────────
function parseDate(line) {
  const m = line.match(/(\d{1,2})\s+([A-ZÉÛÎÔÀÙ]+)\s+(20\d{2})/i);
  if (!m) return "";
  const mm = monthToNumber(m[2]);
  return mm ? `${m[3]}-${mm}-${String(m[1]).padStart(2, "0")}` : "";
}

// ── time ────────────────────────────────────────────────────────────────
// Ritz format: "Portes: 7:30PM | Spectacle: 8:30PM"
function extractTimes(text) {
  const m = text.match(
    /Portes:\s*(\d{1,2})(?::(\d{2}))?(AM|PM).*?Spectacle:\s*(\d{1,2})(?::(\d{2}))?(AM|PM)/i
  );
  if (!m) return { start: "", end: "" };
  return {
    start: normalizeTime(m[1], m[2], m[3]),
    end:   normalizeTime(m[4], m[5], m[6]),
  };
}

// ── event URL ───────────────────────────────────────────────────────────
// Wix encodes event slugs as data-testid or href anchors; grab any
// /event/ path on the same domain.
function extractEventUrl(doc, title) {
  const anchors = [...doc.querySelectorAll("a[href]")];
  for (const a of anchors) {
    const href = a.href || a.getAttribute("href") || "";
    if (href.includes("/event/") || href.includes("/vnements/")) {
      // best-effort: return first event link near the title text
      if (a.textContent.toLowerCase().includes(title.toLowerCase().slice(0, 8))) {
        return href.startsWith("http") ? href : `https://www.barleritzpdb.com${href}`;
      }
    }
  }
  return SOURCE_URL; // fallback to listing page
}

// ── main ────────────────────────────────────────────────────────────────
export async function scrape({ rangeStart, rangeEnd, userAgent }) {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": userAgent },
  });
  if (!res.ok) throw new Error(`Ritz HTTP ${res.status}`);

  const html = await res.text();
  const doc  = new JSDOM(html).window.document;
  const text = doc.body.innerText ?? doc.body.textContent ?? "";

  const lines  = text.split("\n").map(l => l.trim()).filter(Boolean);
  const events = [];

  let currentDate = "";
  let buffer      = [];

  for (const line of lines) {
    // New date header: "21 MAI 2026"
    if (/^\d{1,2}\s+[A-ZÉÛÎÔÀÙ]/i.test(line)) {
      currentDate = parseDate(line);
      buffer      = [];
      continue;
    }

    if (!currentDate) continue;
    buffer.push(line);

    if (line.includes("View Event")) {
      const title    = buffer[0] ?? "";
      const timeLine = buffer.find(l => /Portes:/i.test(l)) ?? "";
      const { start, end } = extractTimes(timeLine);
      const date = currentDate;

      if (date >= rangeStart && date <= rangeEnd && title) {
        events.push({
          id:           slug(title, date),
          title:        title.trim(),
          date,
          start,
          end,
          venue:        VENUE,
          neighborhood: HOOD,
          cost:         /gratuit|free/i.test(buffer.join(" ")) ? "free" : "paid",
          allAges:      /all ages|tous|toutes/i.test(buffer.join(" ")),
          tags:         ["live"],
          url:          extractEventUrl(doc, title),
          source:       "ritz",
        });
      }

      buffer = [];
    }
  }

  return events;
}
