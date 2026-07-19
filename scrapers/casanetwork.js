/* scrapers/casaNetwork.js */
import * as cheerio from 'cheerio';

const TARGET_URL = "https://casadelpopolo.com/";

export async function scrapeCasaNetwork({ rangeStart, rangeEnd }) {
  try {
    const res = await fetch(TARGET_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const parsedEvents = [];

    // Targets structural data boundaries on the main schedule sheet
    $('br').each((_, element) => {
      // Walk text block trees dynamically to prevent missing items due to DOM changes
      const blockText = $(element).parent().text() || "";
      if (blockText.includes("St-Laurent")) {
        const line = $(element).parent();
        const fullText = line.text().trim();
        
        // Find adjacent structural hooks
        const links = line.find('a');
        const titleAnchor = links.first();
        const title = titleAnchor.text().trim();
        
        if (!title) return;

        // Trace backward for the date signature header block
        let dateStr = new Date().toISOString().split('T')[0];
        let prev = line.prev();
        for (let i = 0; i < 5; i++) {
          if (!prev.length) break;
          const prevText = prev.text().trim();
          if (prevText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i)) {
            const dateParsed = new Date(prevText);
            if (!isNaN(dateParsed.getTime())) {
              dateStr = dateParsed.toISOString().split('T')[0];
            }
            break;
          }
          prev = prev.prev();
        }

        let rawVenue = "Casa del Popolo";
        const textLower = fullText.toLowerCase();
        if (textLower.includes("sala rossa")) rawVenue = "La Sala Rossa";
        if (textLower.includes("sotterenea")) rawVenue = "La Sotterenea";
        if (textLower.includes("toscadura")) rawVenue = "La Toscadura";

        let timeStr = "20:00";
        const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*(?:PM|AM|EDT|EST))/i);
        if (timeMatch) timeStr = timeMatch[1].trim();

        let costType = "paid";
        if (textLower.includes("free") || textLower.includes("gratuit")) costType = "free";

        let eventUrl = titleAnchor.attr('href') || TARGET_URL;
        if (!eventUrl.startsWith('http')) {
          eventUrl = `https://casadelpopolo.com${eventUrl.startsWith('/') ? '' : '/'}${eventUrl}`;
        }

        parsedEvents.push({
          id: `${dateStr}-${rawVenue.toLowerCase().replace(/ /g, '-')}-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`.substring(0, 80),
          title: title,
          date: dateStr,
          start: timeStr,
          end: "",
          venue: rawVenue,
          neighborhood: "Mile End",
          cost: costType,
          allAges: false,
          tags: ["live"],
          url: eventUrl,
          source: "casa"
        });
      }
    });

    return parsedEvents.filter(e => e.date >= rangeStart && e.date <= rangeEnd);
  } catch (err) {
    console.error("❌ Failed scraping Casa structural node:", err.message);
    return [];
  }
}
