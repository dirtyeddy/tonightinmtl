/* orchestrator.js */
import fs from 'fs/promises';
import { scrapeRitz } from './scrapers/ritz.js';
import { scrapeCasaNetwork } from './scrapers/casaNetwork.js';

async function runPipeline() {
  const today = new Date();
  const rangeStart = today.toISOString().split('T')[0];
  
  // Scrapes exactly 6 months ahead automatically
  const futureEnd = new Date();
  futureEnd.setMonth(today.getMonth() + 6);
  const rangeEnd = futureEnd.toISOString().split('T')[0];

  console.log(`⏱️ Launching Luxury Suite Engine [${rangeStart} ➔ ${rangeEnd}]`);

  const [ritzEvents, casaNetworkEvents] = await Promise.all([
    scrapeRitz({ rangeStart, rangeEnd }),
    scrapeCasaNetwork({ rangeStart, rangeEnd })
  ]);

  const rawCombined = [...ritzEvents, ...casaNetworkEvents];

  // Enforces data deduplication across shared network platforms
  const uniqueMap = new Map();
  rawCombined.forEach(event => {
    const uniqueKey = `${event.date}_${event.venue.toLowerCase()}_${event.title.toLowerCase().substring(0,12)}`;
    if (!uniqueMap.has(uniqueKey)) {
      uniqueMap.set(uniqueKey, event);
    }
  });

  const finalEventsList = Array.from(uniqueMap.values());

  const outputData = {
    generated: new Date().toISOString(),
    rangeStart,
    rangeEnd,
    count: finalEventsList.length,
    events: finalEventsList.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  };

  await fs.writeFile('./events.json', JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`💎 Compiled directory. Saved ${outputData.count} valid live entries successfully.`);
}

runPipeline();
