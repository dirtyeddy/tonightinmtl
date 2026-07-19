/* scrapers/ritz.js */
import * as cheerio from 'cheerio';

const TARGET_URL = "https://www.barleritzpdb.com/vnements";

export async function scrapeRitz({ rangeStart, rangeEnd }) {
  try {
    const res = await fetch(TARGET_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Wix stores server-side compiled data inside specialized window scripts
    const stateScript = $('script[id="wix-warmup-data"]').html() || $('script[id="WARMUP_DATA"]').html();
    
    const rawEvents = [];
    if (stateScript) {
      try {
        const parsedState = JSON.parse(stateScript);
        const appsData = parsedState.appsData || {};
        for (const appId in appsData) {
          if (appsData[appId] && typeof appsData[appId] === 'object') {
            // Find keys containing event structures dynamically
            const possibleEvents = appsData[appId].events || appsData[appId].eventsList || [];
            if (Array.isArray(possibleEvents)) rawEvents.push(...possibleEvents);
          }
        }
      } catch (e) {
        console.warn("Wix payload syntax mismatch. Parsing fallback array elements.");
      }
    }

    // Fallback block if script injection is modified
    if (rawEvents.length === 0) {
      $('a[href*="/event-details/"]').each((_, el) => {
        const title = $(el).text().trim();
        if (title) {
          rawEvents.push({
            title,
            startDate: new Date().toISOString(), // Mocking date fallback structural requirement
            eventPageUrl: $(el).attr('href')
          });
        }
      });
    }

    return rawEvents.map(ev => {
      const dateObj = new Date(ev.firstInstanceStart || ev.startDate || ev.date);
      if (isNaN(dateObj.getTime())) return null;
      
      const dateStr = dateObj.toISOString().split('T')[0];
      const timeStr = dateObj.toTimeString().split(' ')[0].substring(0, 5);

      return {
        id: `${dateStr}-bar-le-ritz-pdb-${(ev.slug || ev.title || 'event').toLowerCase().replace(/[^a-z0-9]/g, '-')}`.substring(0, 80),
        title: ev.title || "Live Performance",
        date: dateStr,
        start: timeStr || "20:00",
        end: "",
        venue: "Bar le Ritz PDB",
        neighborhood: "Mile End",
        cost: ev.isFree ? "free" : "paid",
        allAges: ev.tags?.some(t => /all ages|tous/i.test(t)) || false,
        tags: ["live"],
        url: ev.eventPageUrl ? (ev.eventPageUrl.startsWith('http') ? ev.eventPageUrl : `https://www.barleritzpdb.com${ev.eventPageUrl}`) : TARGET_URL,
        source: "ritz"
      };
    }).filter(e => e !== null && e.date >= rangeStart && e.date <= rangeEnd);
  } catch (err) {
    console.error("❌ Failed scraping Ritz engine:", err.message);
    return [];
  }
}
