# Travel Concierge — Bangkok & Chiang Rai 🛕

An interactive visual planner for an 8-day trip (**14–21 November 2026**).
Static site, zero build step, works offline except for the map tiles, fonts & images.

## Run it

```bash
./run.sh          # serves on http://localhost:8099 and opens your browser
./run.sh 3000     # custom port
```

Or just open `index.html` directly in a browser.

## What's inside

- **Dashboard ("My Journeys")** — a trip selector landing page with cover-image
  cards. Bangkok & Chiang Rai opens the full concierge; a Taiwan Escape card is a
  "coming soon" placeholder. Back button returns to the dashboard (hash-routed).
- **Hero** — cover image behind the title, live countdown to departure, trip stats.
- **Day-by-day itinerary** (8 tabs) — each day has its own hero image and a stop
  timeline. Every stop shows an **estimated time**, a description, a concierge tip,
  a *Show on map* button, a *Mark visited* toggle (saved on device), and an
  **Explore → Instagram** hashtag link.
- **Interactive Leaflet map** with a **Map / Satellite toggle** (free, keyless:
  CARTO streets + Esri imagery) — color-coded pins by category, per-day route lines,
  category filters, "view whole trip", and Google Maps deep-links in each popup.
- **Don't-miss eats** guide and a **Concierge Notes** panel (weather, temple dress
  code, transport, the Chiang Rai flight hop, money, connectivity, timing).
- **Packing checklist** with progress bar, persisted in `localStorage`.

## Structure

```
index.html        markup + CDN links (Leaflet, Google Fonts)
css/styles.css    dark "concierge" theme (gold + jade)
js/data.js        the trip model — edit this to change the trip
js/app.js         rendering, dashboard/routing, map, interactivity, persistence
img/              day1–day8 hero images + bangkok / taiwan covers
vercel.json       static deploy config (no build step)
run.sh            local dev server
```

## Editing the trip

Everything lives in `js/data.js`:
- `TRIP` — trip meta + cover image.
- `OTHER_TRIPS` — extra dashboard cards (e.g. the Taiwan placeholder).
- `DAYS[]` — ordered days, each with ordered `stops`
  (`name, cat, time, lat, lng, desc, tip`) and a per-day hero at `img/dayN.png`.
- `CATS` — category colors + emoji markers.
- `FOOD_HIGHLIGHTS`, `TIPS`, `PACKING` — the supporting sections.

Stops flagged `approx: true` render with a dashed pin and a "confirm before you go"
note — used for a few spots whose exact coordinates weren't certain.
