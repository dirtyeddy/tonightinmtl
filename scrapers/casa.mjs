/**
 * scraper: Casa del Popolo network
 * Covers: Casa del Popolo, La Sala Rossa, La Sotterenea, P'tit Ours, La Toscadura
 *
 * Strategy:
 *   1. Fetch listing pages (paginated) for each venue — extract event URLs
 *   2. Fetch each event page concurrently (batched to respect the server)
 *   3. Parse date/title from URL slug, time from page body
 */

import { JSDOM } from "jsdom";
import { slug, sleep, normalizeTime } from "./utils.mjs";

const BASE = "https://casadelpopolo.com";

const VENUES = [
  { name: "Casa del Popolo", path: "/fr/events/casa-del-popolo",  hood: "Mile End" },
  { name: "La Sala Rossa",   path: "/fr/events/la-sala-rossa",    hood: "Mile End" },
  { name: "La Sotterenea",   path: "/fr/events/la-sotterenea",    hood: "Mile End" },
  { name: "P'tit Ours",      path: "/fr/events/ptit-ours",        hood: "Mile End" },
  { name: "La Toscadura",    path: "/fr/events/la-toscadura",     hood: "Mile End" },
];

const MAX_LISTING_PAGES = 15;
const BATCH_SIZE        = 8;   // concurrent event-page fetches
const BATCH_DELAY_MS    = 400; // pause between batches

// ── fetch helpers ────────────────────────────────────────────────────────

async function fetchHTML(url, userAgent) {
  const res = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

// ── URL parsers ──────────────────────────────────────────────────────────

function dateFromUrl(url) {
  const m = url.match(/\/events\/(\d{4}-\d{2}-\d{2})-/);
  return m ? m[1] : "";
}

function titleFromUrl(url) {
  const part = url.split("/events/")[1];
  if (!part) return "";
  return part
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .trim();
}

// ── time parser ──────────────────────────────────────────────────────────

function extractStartTime(html) {
  // Look for common patterns in the page body text
  const text = html.toLowerCase();

  // "Show 8:00 PM", "Doors 7PM", "20h00", "20:00"
  const patterns = [
    /show\s*(?:at|@)?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm)/,
    /spectacle\s*(?:à|a|@)?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm)?/,
    /doors?\s*(?:at|@)?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm)/,
    /portes?\s*(?:à|a|@)?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm)?/,
    /(\d{1,2})[:h](\d{2})\s*(am|pm)/,
    /\b([01]\d|2[0-3]):([0-5]\d)\b/,  // bare 24h time
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const h   = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const mer = m[3] ?? null;

    // validate
    if (h > 23 || min > 59) continue;

    return normalizeTime(String(h), String(min).padStart(2, "0"), mer);
  }

  return "";
}

// ── collect listing links ────────────────────────────────────────────────

async function collectLinks(venuePath, userAgent) {
  const seen  = new Set();
  const links = [];

  for (let page = 0; page <= MAX_LISTING_PAGES; page++) {
    const url = page === 0
      ? `${BASE}${venuePath}`
      : `${BASE}${venuePath}?page=${page}`;

    let html;
    try {
      html = await fetchHTML(url, userAgent);
    } catch {
      break; // 404 means no more pages
    }

    const doc    = new JSDOM(html).window.document;
    const anchors = doc.querySelectorAll("a[href^='/fr/events/'], a[href^='/en/events/']");
    if (!anchors.length) break;

    let added = 0;
    anchors.forEach(a => {
      const href = a.getAttribute("href");
      // skip order/checkout links
      if (href.includes("/orders/") || href.includes("/tickets/")) return;
      // normalise to English path for consistency
      const canonical = BASE + href.replace(/^\/(fr|en)\//, "/en/");
      if (!seen.has(canonical)) {
        seen.add(canonical);
        links.push(canonical);
        added++;
      }
    });

    // if no new links found on this page, we've hit the end
    if (added === 0) break;

    await sleep(300);
  }

  return links;
}

// ── build one event ──────────────────────────────────────────────────────

async function buildEvent(url, venueName, hood, userAgent, rangeStart, rangeEnd) {
  const date  = dateFromUrl(url);
  const title = titleFromUrl(url);

  if (!date || !title)    return null;
  if (date < rangeStart)  return null;
  if (date > rangeEnd)    return null;

  let start = "";
  try {
    const html = await fetchHTML(url, userAgent);
    start = extractStartTime(html);
  } catch {
    // event page unreachable — keep the event, just no time
  }

  return {
    id:           slug(title, date),
    title,
    date,
    start,
    end:          "",
    venue:        venueName,
    neighborhood: hood,
    cost:         "paid",
    allAges:      false,
    tags:         ["live"],
    url,
    source:       "casa",
  };
}

// ── batch concurrent fetch ───────────────────────────────────────────────

async function batchFetch(tasks) {
  const results = [];
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const chunk = tasks.slice(i, i + BATCH_SIZE);
    const batch = await Promise.allSettled(chunk.map(t => t()));
    for (const r of batch) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
    if (i + BATCH_SIZE < tasks.length) await sleep(BATCH_DELAY_MS);
  }
  return results;
}

// ── main ─────────────────────────────────────────────────────────────────

export async function scrape({ rangeStart, rangeEnd, userAgent }) {
  const allLinks = []; // { url, venueName, hood }

  for (const v of VENUES) {
    console.log(`  [casa] collecting links: ${v.name}`);
    const links = await collectLinks(v.path, userAgent);
    links.forEach(url => allLinks.push({ url, venueName: v.name, hood: v.hood }));
  }

  // dedupe across venues (same event can appear on multiple listing pages)
  const deduped = [...new Map(allLinks.map(x => [x.url, x])).values()];
  console.log(`  [casa] ${deduped.length} unique event URLs — fetching pages...`);

  const tasks = deduped.map(
    ({ url, venueName, hood }) =>
      () => buildEvent(url, venueName, hood, userAgent, rangeStart, rangeEnd)
  );

  return batchFetch(tasks);
}
