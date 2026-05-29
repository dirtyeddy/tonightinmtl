# Tonight in MTL

Daily scraper for small-capacity (under 250) live music venues in Montréal.  
Deployed as a static site on Neocities, updated via GitHub Actions.

---

## Architecture

```
run.mjs                  ← orchestrator: runs scrapers, merges, writes site/events.json
scrapers/
  utils.mjs              ← shared helpers (date parsing, slug, sleep)
  ritz.mjs               ← Bar le Ritz PDB
  casa.mjs               ← Casa del Popolo network (5 venues)
site/
  index.html             ← static frontend (deployed to Neocities)
  events.json            ← generated output (also deployed)
.github/workflows/
  scrape-deploy.yml      ← runs daily, deploys to Neocities
```

---

## Local setup

```bash
npm install
npm run scrape           # scrape all venues → site/events.json
npm run scrape:ritz      # test a single scraper
npm run scrape:casa
```

You can also pass custom date ranges:

```bash
node run.mjs --start 2026-06-01 --end 2026-08-31
```

---

## Neocities deployment

1. Create a [Neocities](https://neocities.org) site.
2. Get your API key from **neocities.org/settings**.
3. In your GitHub repo: **Settings → Secrets → Actions → New secret**  
   Name: `NEOCITIES_API_KEY`, value: your key.
4. Push to `main` — GitHub Actions will scrape and deploy automatically at 06:00 UTC daily.  
   You can also trigger it manually from the **Actions** tab.

The `site/` folder is what gets published. It must contain at minimum `index.html` and `events.json`.

---

## Adding a new venue

1. Create `scrapers/<venuename>.mjs` — export a single `scrape({ rangeStart, rangeEnd, userAgent })` function that returns an array of event objects.

2. Each event object should follow this shape:

```js
{
  id:           "2026-06-15_band-name",   // slug(title, date)
  title:        "Band Name",
  date:         "2026-06-15",             // ISO YYYY-MM-DD
  start:        "20:00",                  // 24h HH:MM, or ""
  end:          "22:00",                  // or ""
  venue:        "Venue Name",
  neighborhood: "Plateau",
  cost:         "free" | "paid" | "",
  allAges:      false,
  tags:         ["live"],
  url:          "https://...",
  source:       "venuename",
}
```

3. Register it in `run.mjs`:

```js
import { scrape as scrapeNewVenue } from "./scrapers/newvenue.mjs";

const SCRAPERS = [
  ...
  { key: "newvenue", label: "New Venue Name", fn: scrapeNewVenue },
];
```

That's it — the orchestrator handles merging, deduplication, and output.

---

## Venues covered

| Venue | Capacity | Neighbourhood | Scraper |
|---|---|---|---|
| Bar le Ritz PDB | ~200 | Mile End | `ritz.mjs` |
| Casa del Popolo | ~100 | Mile End | `casa.mjs` |
| La Sala Rossa | ~200 | Mile End | `casa.mjs` |
| La Sotterenea | ~150 | Mile End | `casa.mjs` |
| P'tit Ours | ~75 | Mile End | `casa.mjs` |
| La Toscadura | ~80 | Mile End | `casa.mjs` |

### Suggested next venues
- Les Foufs (Quartier Latin)
- Divan Orange (Mile End)
- L'Escogriffe Bar (Plateau)
- Quai des Brumes (Plateau)
- Brasserie Beaubien (Rosemont)
- Bar le Verre Bouteille (Mile End)
