#!/usr/bin/env node
/**
 * TonightInMTL — main scraper runner
 *
 * Usage:
 *   node run.mjs                        # scrape next 180 days
 *   node run.mjs --start 2026-06-01 --end 2026-08-31
 *   node run.mjs --venue ritz           # single scraper (for testing)
 *
 * Output: site/events.json
 */

import fs   from "node:fs/promises";
import path from "node:path";
import { today, daysFromToday } from "./scrapers/utils.mjs";
import { scrape as scrapeRitz } from "./scrapers/ritz.mjs";
import { scrape as scrapeCasa } from "./scrapers/casa.mjs";

// ── CLI args ─────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => a.slice(2).split("="))
    .map(([k, v]) => [k, v])
);

// Support --start / --end or default to today → +180 days
const rangeStart = args.start  ?? today();
const rangeEnd   = args.end    ?? daysFromToday(180);
const venueFilter = args.venue ?? "all";

const UA = "TonightInMTL/1.0 (https://tonightinmtl.neocities.org)";

// ── scrapers registry ─────────────────────────────────────────────────────
// Add new venues here — just implement a scrape() export in scrapers/<name>.mjs

const SCRAPERS = [
  { key: "ritz", label: "Bar le Ritz PDB",        fn: scrapeRitz },
  { key: "casa", label: "Casa del Popolo network", fn: scrapeCasa },
  // { key: "foufs",  label: "Les Foufs",    fn: scrapeFoufs },
  // { key: "divan", label: "Divan Orange",  fn: scrapeDivan },
];

// ── merge + dedupe ────────────────────────────────────────────────────────

function mergeEvents(batches) {
  const all  = batches.flat();
  const seen = new Map();

  for (const ev of all) {
    if (!ev || !ev.id) continue;
    // If same id already seen, keep whichever has more data
    if (seen.has(ev.id)) {
      const existing = seen.get(ev.id);
      // prefer entry with a real URL over one without
      if (!existing.url && ev.url) seen.set(ev.id, ev);
    } else {
      seen.set(ev.id, ev);
    }
  }

  return [...seen.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
  );
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎵 TonightInMTL scraper`);
  console.log(`   Range : ${rangeStart} → ${rangeEnd}`);
  console.log(`   Venues: ${venueFilter === "all" ? SCRAPERS.map(s => s.label).join(", ") : venueFilter}\n`);

  const selected = venueFilter === "all"
    ? SCRAPERS
    : SCRAPERS.filter(s => s.key === venueFilter);

  if (!selected.length) {
    console.error(`Unknown venue key "${venueFilter}". Valid keys: ${SCRAPERS.map(s => s.key).join(", ")}`);
    process.exit(1);
  }

  const ctx = { rangeStart, rangeEnd, userAgent: UA };
  const batches = [];

  for (const scraper of selected) {
    console.log(`→ Scraping: ${scraper.label}`);
    try {
      const events = await scraper.fn(ctx);
      console.log(`  ✓ ${events.length} events`);
      batches.push(events);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      batches.push([]); // don't let one broken scraper kill the whole run
    }
  }

  const merged = mergeEvents(batches);
  console.log(`\n✅ Total after dedup: ${merged.length} events`);

  // Write output
  const outDir  = path.join(import.meta.dirname, "site");
  const outFile = path.join(outDir, "events.json");

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, JSON.stringify({
    generated: new Date().toISOString(),
    rangeStart,
    rangeEnd,
    count: merged.length,
    events: merged,
  }, null, 2));

  console.log(`📄 Written → ${outFile}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
