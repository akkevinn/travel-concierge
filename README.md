# Travel Concierge — Bangkok & Chiang Rai 🛕

An interactive visual planner for an 8-day trip (**14–21 November 2026**).
Static site, zero build step, works offline except for the map tiles & web fonts.

## Run it

```bash
./run.sh          # serves on http://localhost:8099 and opens your browser
./run.sh 3000     # custom port
```

Or just open `index.html` directly in a browser.

## What's inside

- **Hero + live countdown** to departure, with trip stats.
- **Day-by-day itinerary** (8 tabs) — each stop has a description, a concierge tip,
  a *Show on map* button and a *Mark visited* toggle (saved on your device).
- **Interactive Leaflet map** — color-coded pins by category, per-day route lines,
  category filters, "view whole trip", and Google Maps deep-links in each popup.
- **Don't-miss eats** guide and a **Concierge Notes** panel (weather, temple dress
  code, transport, the Chiang Rai flight hop, money, connectivity, timing).
- **Packing checklist** with progress bar, persisted in `localStorage`.

## Structure

```
index.html        markup + CDN links (Leaflet, Google Fonts)
css/styles.css    dark "concierge" theme (gold + jade)
js/data.js        the itinerary model — edit this to change the trip
js/app.js         rendering, map, interactivity, persistence
run.sh            local dev server
```

## Editing the trip

Everything lives in `js/data.js`:
- `DAYS[]` — ordered days, each with ordered `stops` (`name, cat, lat, lng, desc, tip`).
- `CATS` — category colors + emoji markers.
- `FOOD_HIGHLIGHTS`, `TIPS`, `PACKING` — the supporting sections.

Stops flagged `approx: true` render with a dashed pin and a "confirm before you go"
note — used for a few spots whose exact coordinates weren't certain
(e.g. Kanom Siam, Wat Welunaram, the Chiang Rai hotel).
