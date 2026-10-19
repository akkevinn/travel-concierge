/* =====================================================================
   Travel Concierge: app logic
   Vanilla JS. Depends on data.js (TRIP, CATS, DAYS, FOOD_HIGHLIGHTS,
   TIPS, PACKING) and Leaflet (window.L).
   ===================================================================== */
(function () {
  "use strict";

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Instagram-hashtag slug: drop parentheticals, keep alphanumerics only.
  const slug = (s) => String(s).replace(/\([^)]*\)/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const absUrl = (p) => new URL(p, document.baseURI).href;

  /* ----- persistent state (localStorage, gracefully optional) ----- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (_) { return fallback; }
    },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} },
  };
  // v3: the plan now holds every block from the sheet, so positional
  // indices shifted again and old marks would land on the wrong item.
  const VISITED_KEY = "tc_visited_v3";
  const PACK_KEY    = "tc_pack_v1";
  const BRIEF_KEY   = "tc_brief_v1";
  let visited = new Set(store.get(VISITED_KEY, []));
  let briefMode = store.get(BRIEF_KEY, false);
  // Marks are keyed by title, not position, so they survive future re-orders.
  const stopId = (day, item) => `${day}::${item.title}`;

  /* ----- the plan -----
     Every sheet row is an item. Items carrying `desc` are destinations:
     they get a full card, a map pin and a filter chip. The rest (wake-ups,
     walks, rides, flights) are timeline detail. */
  const isMajor = (s) => !!s.desc;
  const isPinned = (s) => typeof s.lat === "number" && typeof s.lng === "number";

  const allItems = DAYS.flatMap((d) => d.plan);
  const majors = allItems.filter(isMajor);
  const count = (fn) => majors.filter(fn).length;
  const cities = [...new Set(DAYS.map((d) => d.city))];

  /* ----- money -----
     Costs in the data are per person. Anything the sheet hasn't priced yet
     is simply absent, so it renders blank instead of a guessed number. */
  const baht   = (n) => "฿" + n.toLocaleString("en-US");
  const rupiah = (n) => "Rp" + n.toLocaleString("de-DE");

  function costLabel(cost) {
    if (!cost) return "";
    const parts = [];
    // A literal 0 in the sheet means no charge, distinct from "not priced yet",
    // which arrives as no `cost` at all and renders blank.
    if (cost.baht === 0) parts.push("Free");
    else if (cost.baht) parts.push(baht(cost.baht) + " / pax");
    if (cost.idr) parts.push(rupiah(cost.idr) + " / pax");
    if (cost.totalIdr) parts.push(rupiah(cost.totalIdr) + " total");
    return parts.join(" · ");
  }

  /* Per-day spend we actually know. Everything the sheet left open simply
     isn't counted, which is why the banner says "known costs". */
  function dayTotals(d) {
    let bahtPax = 0, idrPax = 0, idrTotal = 0;
    d.plan.forEach((s) => {
      if (!s.cost) return;
      if (s.cost.baht) bahtPax += s.cost.baht;
      if (s.cost.idr) idrPax += s.cost.idr;
      if (s.cost.totalIdr) idrTotal += s.cost.totalIdr;
    });
    return { baht: bahtPax, idr: idrPax, idrTotal: idrTotal };
  }

  /* =================================================================
     TRIP CLOCK
     Marks each block as done / happening now / still ahead, live.

     Every time in the sheet is local to the trip, and Jakarta and Bangkok
     are both UTC+7, so block times resolve against that fixed offset
     rather than the viewer's timezone. The schedule then reads correctly
     from any device in any country, and because everything derives from
     Date.now() there is nothing to redeploy once the trip starts.

     Append ?now=2026-11-16T11:00 to preview any moment of the trip.
     ================================================================= */
  const TRIP_UTC_OFFSET = 7;          // hours; Jakarta (WIB) and Bangkok (ICT)
  const AT_RANGE = /^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$/;
  const AT_OPEN  = /^(\d{1,2}):(\d{2})\s*onward$/i;
  const OPEN_TAIL_MS = 3 * 3600 * 1000;  // how long a trailing open block runs

  function wallToEpoch(dateISO, h, m) {
    const [y, mo, d] = dateISO.split("-").map(Number);
    return Date.UTC(y, mo - 1, d, h - TRIP_UTC_OFFSET, m);
  }

  // A frozen clock for previewing, otherwise the real one.
  const previewNow = (() => {
    const q = new URLSearchParams(location.search).get("now");
    const t = q ? Date.parse(/Z|[+-]\d{2}:?\d{2}$/.test(q) ? q : q + "+07:00") : NaN;
    return isNaN(t) ? null : t;
  })();
  const nowMs = () => (previewNow == null ? Date.now() : previewNow);

  /* Resolve every block to an absolute window, once. An open-ended block
     ("23:15 onward") runs until the next block starts. */
  function buildClock() {
    const flat = [];
    DAYS.forEach((d) => d.plan.forEach((it) => {
      const at = (it.at || "").trim();
      let m = AT_RANGE.exec(at);
      if (m) it._t = { start: wallToEpoch(d.dateISO, +m[1], +m[2]), end: wallToEpoch(d.dateISO, +m[3], +m[4]) };
      else if ((m = AT_OPEN.exec(at))) it._t = { start: wallToEpoch(d.dateISO, +m[1], +m[2]), end: null };
      else it._t = null;
      flat.push(it);
    }));
    for (let i = 0; i < flat.length; i++) {
      const t = flat[i]._t;
      if (!t || t.end != null) continue;
      const next = flat.slice(i + 1).find((x) => x._t && x._t.start != null);
      t.end = next ? next._t.start : t.start + OPEN_TAIL_MS;
    }
    DAYS.forEach((d) => {
      const ts = d.plan.map((it) => it._t).filter(Boolean);
      d._t = ts.length ? { start: ts[0].start, end: ts[ts.length - 1].end } : null;
    });
  }

  const blockState = (it, now) => {
    const t = it._t;
    if (!t) return "ahead";
    if (now >= t.end) return "done";
    if (now >= t.start) return "now";
    return "ahead";
  };
  const dayState = (d, now) => {
    if (!d._t) return "ahead";
    if (now >= d._t.end) return "done";
    if (now >= d._t.start) return "today";
    return "ahead";
  };
  const tripPhase = (now) => {
    const first = DAYS[0]._t, last = DAYS[DAYS.length - 1]._t;
    if (!first || !last) return "before";
    if (now < first.start) return "before";
    return now >= last.end ? "after" : "during";
  };
  const currentDay = (now) => (DAYS.find((d) => dayState(d, now) === "today")
    || DAYS.find((d) => d._t && now < d._t.start) || null);

  /* =================================================================
     HERO: subtitle, countdown, stats
     ================================================================= */
  function fmtRange() {
    const opts = { day: "numeric", month: "long" };
    const a = new Date(TRIP.startISO + "T00:00:00");
    const b = new Date(TRIP.endISO + "T00:00:00");
    return `${a.toLocaleDateString("en-GB", opts)} – ${b.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
  }
  $("#hero-sub").textContent = TRIP.subtitle + ".";

  function renderStats() {
    const data = [
      { n: DAYS.length, l: "Days" },
      { n: cities.length, l: "Cities" },
      { n: count((s) => s.cat === "temple"), l: "Temples" },
      { n: count((s) => s.cat === "food" || s.cat === "cafe"), l: "Food stops" },
      { n: count((s) => s.cat === "shopping" || s.cat === "market"), l: "Shopping" },
    ];
    const wrap = $("#stats");
    data.forEach((d) => {
      const s = el("div", "stat", `<b>${d.n}</b><span>${esc(d.l)}</span>`);
      wrap.appendChild(s);
    });
  }

  let cdTimer = null;
  function tickCountdown() {
    const now = nowMs();
    const phase = tripPhase(now);
    if (phase !== "before") {
      if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
      const d = currentDay(now);
      $("#countdown").innerHTML = phase === "during"
        ? `<div class="cd-live"><span class="cd-dot"></span>Day ${d ? d.day : ""} of ${DAYS.length} in progress</div>`
        : '<div class="cd-live">Trip complete 🛬</div>';
      return;
    }
    const target = DAYS[0]._t ? DAYS[0]._t.start : new Date(TRIP.startISO + "T00:00:00").getTime();
    let diff = Math.max(0, target - now);
    const dd = Math.floor(diff / 86400000); diff -= dd * 86400000;
    const hh = Math.floor(diff / 3600000);  diff -= hh * 3600000;
    const mm = Math.floor(diff / 60000);    diff -= mm * 60000;
    const ss = Math.floor(diff / 1000);
    const set = (k, v) => { const n = $(`[data-cd="${k}"]`); if (n) n.textContent = String(v).padStart(2, "0"); };
    set("days", dd); set("hours", hh); set("mins", mm); set("secs", ss);
  }

  /* =================================================================
     MAP (Leaflet)
     ================================================================= */
  let map, markerLayer, routeLayer;
  let baseStreets, baseSatellite, baseLayers, currentBase = "streets";
  const markers = []; // { marker, day, idx, cat }
  let activeCats = new Set(Object.keys(CATS)); // all on

  function pinIcon(cat, approx, num) {
    const c = CATS[cat] || { color: "#ccc", icon: "📍" };
    const numHtml = num != null ? `<span class="pin-num">${num}</span>` : "";
    return L.divIcon({
      className: "",
      html: `<div class="pin ${approx ? "approx" : ""}" style="background:${c.color}"><span>${c.icon}</span>${numHtml}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  // The searchable name of a place: `place` when the row title is an action
  // ("Check in & rest"), otherwise the title itself.
  const placeName = (s) => s.place || s.title;
  // Hashtag for the Explore link: an explicit `tag` wins, else the venue name.
  // Never the raw title, which is descriptive ("Wat Arun: lunch here") and
  // would point at a hashtag nobody uses.
  const tagOf = (s) => s.tag || slug(placeName(s));

  function popupHtml(s) {
    const c = CATS[s.cat] || { label: s.cat };
    const gmaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName(s) + " Thailand")}`;
    return `
      <div class="lp">
        <div class="lp-cat">${esc(c.label)}</div>
        <div class="lp-name">${esc(placeName(s))}</div>
        ${s.at ? `<div class="lp-when">${esc(s.at)}${s.dur ? " · " + esc(s.dur) : ""}</div>` : ""}
        ${s.desc ? `<div class="lp-desc">${esc(s.desc)}</div>` : ""}
        ${s.approx ? '<div class="lp-approx">◦ approximate location, confirm before you go</div>' : ""}
        <a class="lp-link" href="${gmaps}" target="_blank" rel="noopener">Open in Google Maps →</a>
      </div>`;
  }

  function initMap() {
    map = L.map("leaflet", { scrollWheelZoom: false, zoomControl: true })
      .setView([15.5, 100.5], 6);

    // Two free, keyless base layers: a clean street map + satellite (with labels).
    // CARTO's basemaps started requiring an API key and now serve a watermarked
    // placeholder tile to anonymous callers, so both layers come from Esri.
    baseStreets = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: "&copy; Esri, HERE, Garmin, OpenStreetMap contributors", maxZoom: 19,
    });
    baseSatellite = L.layerGroup([
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics", maxZoom: 19,
      }),
      // transparent place labels on top of the imagery (Google-style hybrid look)
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
      }),
    ]);
    baseLayers = { streets: baseStreets, satellite: baseSatellite };
    baseStreets.addTo(map);

    map.on("click", () => map.scrollWheelZoom.enable());

    markerLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);

    DAYS.forEach((d) => {
      // Pins are the day's destinations, numbered in visiting order.
      let n = 0;
      d.plan.forEach((s) => {
        if (!isPinned(s)) return;
        n += 1;
        const m = L.marker([s.lat, s.lng], { icon: pinIcon(s.cat, s.approx, n) })
          .bindPopup(popupHtml(s), { closeButton: true });
        markers.push({ marker: m, day: d.day, key: stopId(d.day, s), cat: s.cat, stop: s });
      });
    });
  }

  /* Show markers for a given day (or all). Applies category filter. */
  function renderMap(dayNum) {
    markerLayer.clearLayers();
    routeLayer.clearLayers();
    const pts = [];

    markers.forEach((mk) => {
      const dayOk = dayNum === "all" || mk.day === dayNum;
      const catOk = activeCats.has(mk.cat);
      if (dayOk && catOk) {
        markerLayer.addLayer(mk.marker);
        pts.push([mk.stop.lat, mk.stop.lng]);
      }
    });

    // route line for a single day (in stop order, respecting filter)
    if (dayNum !== "all") {
      const dayPts = markers
        .filter((mk) => mk.day === dayNum && activeCats.has(mk.cat))
        .map((mk) => [mk.stop.lat, mk.stop.lng]);
      if (dayPts.length > 1) {
        routeLayer.addLayer(L.polyline(dayPts, {
          color: "#e6c06a", weight: 2, opacity: .6, dashArray: "2 7", lineCap: "round",
        }));
      }
    }

    if (pts.length) {
      const b = L.latLngBounds(pts).pad(0.25);
      map.fitBounds(b, { maxZoom: dayNum === "all" ? 7 : 13, animate: true });
    }
  }

  /* =================================================================
     ITINERARY: day rail + detail panel
     ================================================================= */
  let activeDay = DAYS[0].day;

  function renderDayRail() {
    const rail = $("#dayRail");
    DAYS.forEach((d) => {
      const dt = new Date(d.dateISO + "T00:00:00");
      const dateStr = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const pill = el("button", "day-pill",
        `<div class="dp-day">Day ${d.day} · ${esc(d.weekday)}</div>
         <div class="dp-date">${esc(dateStr)}</div>
         <div class="dp-city">${esc(d.city)}</div>
         <div class="dp-state"></div>`);
      pill.setAttribute("role", "tab");
      pill.addEventListener("click", () => selectDay(d.day, true));
      rail.appendChild(pill);
      d._pill = pill;
    });
  }

  function renderDetail(d) {
    const wrap = $("#planDetail");
    wrap.innerHTML = "";

    const dt = new Date(d.dateISO + "T00:00:00");
    const dateStr = dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const heroSrc = d.hero || ("img/day" + d.day + ".png");
    // Absolute URL: a relative url() inside a CSS var resolves against the
    // stylesheet (css/…), not the document, so resolve it here instead.
    const heroAbs = new URL(heroSrc, document.baseURI).href;
    const t = dayTotals(d);
    const money = [
      t.baht ? baht(t.baht) + " / pax" : "",
      t.idr ? rupiah(t.idr) + " / pax" : "",
      t.idrTotal ? rupiah(t.idrTotal) + " total" : "",
    ].filter(Boolean).join(" · ");
    const moneyHtml = money
      ? `<div class="db-cost" title="Fares and entrance fees already priced in the sheet. Meals and shopping are still open.">
           💳 ${esc(money)} <span class="db-cost-note">known costs</span></div>`
      : "";

    const banner = el("div", "day-banner",
      `<div class="db-inner">
         <div class="db-meta"><span>Day ${d.day} of ${DAYS.length}</span><span>·</span>
           <span>${esc(dateStr)}</span><span>·</span>
           <span class="db-city">${esc(d.city)}</span></div>
         <h3>${esc(d.theme)}</h3>
         <p>${esc(d.blurb)}</p>
         ${moneyHtml}
       </div>`);
    banner.style.setProperty("--hero", `url("${heroAbs}")`);
    // warm the browser cache so switching days feels instant
    const pre = new Image(); pre.src = heroSrc;
    wrap.appendChild(banner);

    // Full sheet by default; the toggle collapses a day to its destinations.
    const majorCount = d.plan.filter(isMajor).length;
    const bar = el("div", "plan-bar",
      `<span class="pb-count">${d.plan.length} blocks · ${majorCount} destination${majorCount === 1 ? "" : "s"}</span>
       <span class="pb-actions">
         <button class="pb-toggle jump" id="jumpNow" type="button" hidden>Jump to now</button>
         <button class="pb-toggle${briefMode ? " on" : ""}" type="button">
           ${briefMode ? "Show every block" : "Highlights only"}
         </button>
       </span>`);
    bar.querySelector("#jumpNow").addEventListener("click", () => jumpToNow(true));
    bar.querySelector(".pb-toggle:not(.jump)").addEventListener("click", () => {
      briefMode = !briefMode;
      store.set(BRIEF_KEY, briefMode);
      renderDetail(d);
    });
    wrap.appendChild(bar);

    const shown = briefMode ? d.plan.filter(isMajor) : d.plan;
    const list = el("div", "stop-list" + (briefMode ? " brief" : ""));

    shown.forEach((s) => {
      const c = CATS[s.cat] || { label: s.cat, color: "#ccc", icon: "📍" };
      const cost = costLabel(s.cost);
      const when = `
        <div class="stop-when">
          ${s.at ? `<span class="stop-at">${esc(s.at)}</span>` : ""}
          ${s.dur ? `<span class="stop-time"><span class="clock">🕘</span> ${esc(s.dur)}</span>` : ""}
          ${cost ? `<span class="stop-cost">💳 ${esc(cost)}</span>` : ""}
        </div>`;

      /* ---- timeline detail: a wake-up, a walk, a train, a flight ---- */
      if (!isMajor(s)) {
        const step = el("div", "step");
        step.style.setProperty("--dot", c.color);
        step.innerHTML = `
          <div class="step-emoji">${c.icon}</div>
          <div class="step-main">
            <div class="step-title">${esc(s.title)}</div>
            ${when}
            ${s.note ? `<div class="step-note">${esc(s.note)}</div>` : ""}
          </div>`;
        list.appendChild(step);
        return;
      }

      /* ---- destination: full card, pin, visited state, Instagram ---- */
      const id = stopId(d.day, s);
      const isVisited = visited.has(id);
      const node = el("div", "stop" + (isVisited ? " visited" : ""));
      node.style.setProperty("--dot", c.color);
      const tag = tagOf(s);
      const ig = `https://www.instagram.com/explore/tags/${tag}/`;
      node.innerHTML = `
        <div class="stop-top">
          <div class="stop-emoji">${c.icon}</div>
          <div class="stop-main">
            <div class="stop-name">${esc(s.title)}<span class="stop-cat">${esc(c.label)}</span></div>
            ${s.place ? `<div class="stop-place">📍 ${esc(s.place)}</div>` : ""}
            ${when}
            ${s.note ? `<div class="step-note">${esc(s.note)}</div>` : ""}
            <div class="stop-desc">${esc(s.desc)}</div>
            ${s.tip ? `<div class="stop-tip"><b>Tip ·</b> ${esc(s.tip)}</div>` : ""}
            <div class="stop-actions">
              ${isPinned(s) ? '<button class="stop-btn locate">Show on map</button>' : ""}
              <button class="stop-btn visit ${isVisited ? "on" : ""}">${isVisited ? "✓ Visited" : "Mark visited"}</button>
              <a class="stop-btn ig" href="${ig}" target="_blank" rel="noopener" title="Explore #${tag} on Instagram">📷 Explore</a>
            </div>
          </div>
        </div>`;

      const loc = node.querySelector(".locate");
      if (loc) loc.addEventListener("click", () => {
        document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
        const mk = markers.find((m) => m.day === d.day && m.key === id);
        if (mk) { map.setView([s.lat, s.lng], 14, { animate: true }); mk.marker.openPopup(); }
      });

      const vb = node.querySelector(".visit");
      vb.addEventListener("click", () => {
        if (visited.has(id)) { visited.delete(id); node.classList.remove("visited"); vb.classList.remove("on"); vb.textContent = "Mark visited"; }
        else { visited.add(id); node.classList.add("visited"); vb.classList.add("on"); vb.textContent = "✓ Visited"; }
        store.set(VISITED_KEY, [...visited]);
      });
      list.appendChild(node);
    });

    list._shown = shown;
    wrap.appendChild(list);
    paintProgress();
  }

  /* Repaint done / now marks. Cheap enough to run on a timer, and it
     touches classes only, so it never disturbs scroll position or the map. */
  function paintProgress() {
    const now = nowMs();
    DAYS.forEach((d) => {
      if (!d._pill) return;
      const st = dayState(d, now);
      d._pill.classList.toggle("is-done", st === "done");
      d._pill.classList.toggle("is-today", st === "today");
      const slot = d._pill.querySelector(".dp-state");
      if (!slot) return;
      const done = d.plan.filter((it) => blockState(it, now) === "done").length;
      slot.textContent = st === "today" ? `${done}/${d.plan.length} done`
        : st === "done" ? "done" : "";
    });

    const list = $(".stop-list");
    if (list && list._shown) {
      Array.from(list.children).forEach((row, i) => {
        const it = list._shown[i];
        if (!it) return;
        const st = blockState(it, now);
        row.classList.toggle("is-done", st === "done");
        row.classList.toggle("is-now", st === "now");
        const chip = row.querySelector(".now-chip");
        if (st === "now" && !chip) {
          const when = row.querySelector(".stop-when");
          if (when) when.insertBefore(el("span", "now-chip", "<i></i>NOW"), when.firstChild);
        } else if (st !== "now" && chip) {
          chip.remove();
        }
      });
    }

    const jump = $("#jumpNow");
    if (jump) jump.hidden = tripPhase(now) !== "during";
  }

  /* Open the day that is running and bring the live block into view. */
  function jumpToNow(scroll) {
    const now = nowMs();
    if (tripPhase(now) !== "during") return false;
    const d = currentDay(now);
    if (!d) return false;
    if (activePanel !== "itinerary") showPanel("itinerary", null, false);
    if (activeDay !== d.day) selectDay(d.day, false);
    if (briefMode && !d.plan.filter(isMajor).some((it) => blockState(it, now) === "now")) {
      briefMode = false; store.set(BRIEF_KEY, false); renderDetail(d);
    }
    const row = $(".stop-list .is-now");
    if (row && scroll) scrollToEl(row);
    return !!row;
  }

  function selectDay(dayNum, scroll) {
    activeDay = dayNum;
    DAYS.forEach((d) => d._pill && d._pill.classList.toggle("active", d.day === dayNum));
    const d = DAYS.find((x) => x.day === dayNum);
    renderDetail(d);
    $("#mapTitle").textContent = `Day ${d.day} · ${d.city}`;
    renderMap(dayNum);
    paintProgress();
    if (scroll && window.innerWidth <= 900) {
      $("#planDetail").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* =================================================================
     CATEGORY FILTER CHIPS
     ================================================================= */
  function renderCatFilters() {
    const wrap = $("#catFilters");
    // only categories that actually put a pin on the map
    const present = [...new Set(allItems.filter(isPinned).map((s) => s.cat))];
    present.forEach((cat) => {
      const c = CATS[cat]; if (!c) return;
      const chip = el("span", "cat-chip",
        `<span class="cc-dot" style="background:${c.color}"></span>${esc(c.label)}`);
      chip.addEventListener("click", () => {
        if (activeCats.has(cat)) chip.classList.add("off"), activeCats.delete(cat);
        else chip.classList.remove("off"), activeCats.add(cat);
        renderMap(activeDay);
      });
      wrap.appendChild(chip);
    });
  }

  /* Base-layer toggle: Map (streets) <-> Satellite. Markers/routes live in
     their own panes, so they always stay on top of whichever base is active. */
  function initLayerToggle() {
    const btns = $$(".layer-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-layer");
        if (target === currentBase || !baseLayers[target]) return;
        map.removeLayer(baseLayers[currentBase]);
        baseLayers[target].addTo(map);
        currentBase = target;
        btns.forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
  }

  $("#btnAll").addEventListener("click", () => {
    DAYS.forEach((d) => d._pill && d._pill.classList.remove("active"));
    activeDay = "all";
    $("#mapTitle").textContent = "Whole trip";
    renderMap("all");
    document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* =================================================================
     FOOD + TIPS
     ================================================================= */
  function renderFood() {
    const grid = $("#foodGrid");
    FOOD_HIGHLIGHTS.forEach((f) => {
      grid.appendChild(el("div", "food-card reveal",
        `<div class="food-emoji">${f.emoji}</div>
         <h4>${esc(f.name)}</h4>
         <div class="food-meta"><span class="food-city">${esc(f.city)}</span>
           <span class="food-tag">${esc(f.tag)}</span></div>
         <p class="food-note">${esc(f.note)}</p>`));
    });
  }

  function renderTips() {
    const grid = $("#tipsGrid");
    TIPS.forEach((t) => {
      grid.appendChild(el("div", "tip-card reveal",
        `<div class="tip-icon">${t.icon}</div>
         <h4>${esc(t.title)}</h4>
         <p>${esc(t.body)}</p>`));
    });
  }

  /* =================================================================
     PACKING CHECKLIST
     ================================================================= */
  let packed = new Set(store.get(PACK_KEY, []));
  function updatePackBar() {
    const pct = PACKING.length ? Math.round((packed.size / PACKING.length) * 100) : 0;
    $("#packBar").style.width = pct + "%";
  }
  function renderPacking() {
    const list = $("#packList");
    list.innerHTML = "";
    PACKING.forEach((label, i) => {
      const on = packed.has(i);
      const li = el("li", "pack-item" + (on ? " done" : ""),
        `<span class="pack-box">✓</span><span>${esc(label)}</span>`);
      li.addEventListener("click", () => {
        if (packed.has(i)) { packed.delete(i); li.classList.remove("done"); }
        else { packed.add(i); li.classList.add("done"); }
        store.set(PACK_KEY, [...packed]);
        updatePackBar();
      });
      list.appendChild(li);
    });
    updatePackBar();
  }
  $("#resetPack").addEventListener("click", () => {
    packed = new Set(); store.set(PACK_KEY, []); renderPacking();
  });

  /* =================================================================
     SCROLL REVEAL
     ================================================================= */
  function initReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal").forEach((n) => io.observe(n));
  }

  /* =================================================================
     DASHBOARD ("My Journeys") + view routing
     ================================================================= */
  function fmtTripDates() {
    const a = new Date(TRIP.startISO + "T00:00:00");
    const b = new Date(TRIP.endISO + "T00:00:00");
    return a.getDate() + "–" + b.getDate() + " " +
      b.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  function tripCard(t, disabled) {
    const card = el("article", "trip-card" + (disabled ? " soon" : ""));
    card.innerHTML = `
      <div class="trip-cover"></div>
      <div class="trip-scrim"></div>
      <div class="trip-info">
        <h3>${esc(t.title)}</h3>
        <div class="trip-date">📅 ${esc(t.dateLabel)}</div>
        ${t.subtitle ? `<p class="trip-sub">${esc(t.subtitle)}</p>` : ""}
      </div>
      ${disabled ? '<span class="trip-badge">Coming soon</span>' : '<span class="trip-go">Open →</span>'}`;
    if (t.cover) card.querySelector(".trip-cover").style.backgroundImage = `url("${absUrl(t.cover)}")`;
    return card;
  }

  function renderDashboard() {
    const grid = $("#dashGrid");
    const bkk = tripCard({ title: TRIP.title, dateLabel: fmtTripDates(), subtitle: TRIP.subtitle, cover: TRIP.cover }, false);
    bkk.addEventListener("click", enterTrip);
    grid.appendChild(bkk);
    OTHER_TRIPS.forEach((t) => {
      const card = tripCard(t, !!t.comingSoon);
      if (!t.comingSoon) card.addEventListener("click", enterTrip);
      grid.appendChild(card);
    });
  }

  function showView(v) {
    const trip = v === "trip";
    $("#dashboard").classList.toggle("hidden", trip);
    document.body.classList.toggle("dash-open", !trip);
    window.scrollTo(0, 0);
    if (trip) setTimeout(() => map && map.invalidateSize(), 60);
  }
  function enterTrip() { history.pushState(null, "", "#trip"); showView("trip"); }
  function showDashboard() { history.pushState(null, "", "#"); showView("dashboard"); }

  // Only the dashboard hash (empty / # / #journeys) shows the dashboard; in-page
  // section anchors (#itinerary, #map, …) must keep the open trip visible.
  function viewForHash() {
    const h = location.hash;
    return (!h || h === "#" || h === "#journeys") ? "dashboard" : "trip";
  }

  // Scroll an element to just under the sticky header. Uses a plain instant
  // scroll (reliable everywhere) and asks for a smooth animation where the
  // browser supports it, falling back gracefully if it doesn't.
  /* =================================================================
     SECTION TABS
     The top nav switches between sections rather than scrolling one long
     page, so mobile shows the hero plus one section at a time. "Map" lives
     inside the itinerary, so it opens that tab and scrolls to the map.
     ================================================================= */
  const PANELS = ["itinerary", "food", "tips", "pack"];
  const PANEL_FOR = { itinerary: "itinerary", map: "itinerary", food: "food", tips: "tips", pack: "pack" };
  let activePanel = "itinerary";

  function showPanel(panel, focusId, scroll) {
    activePanel = panel;
    PANELS.forEach((id) => {
      const sec = document.getElementById(id);
      if (sec) sec.hidden = id !== panel;
    });
    const navKey = focusId && PANEL_FOR[focusId] === panel ? focusId : panel;
    $$(".topnav a").forEach((a) => {
      const on = a.getAttribute("href").slice(1) === navKey;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    // Leaflet measures its box on show; a hidden map would render grey tiles.
    if (panel === "itinerary") setTimeout(() => map && map.invalidateSize(), 60);
    if (scroll === false) return;
    const target = document.getElementById(focusId || panel);
    if (target) scrollToEl(target);
  }

  function scrollToEl(target) {
    const OFFSET = 72; // sticky topbar height
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - OFFSET);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
    } catch (_) {
      window.scrollTo(0, top);
    }
    // guarantee arrival even if the smooth animation is a no-op in this engine
    setTimeout(() => { if (Math.abs(window.scrollY - top) > 4) window.scrollTo(0, top); }, 700);
  }

  /* =================================================================
     BOOT
     ================================================================= */
  function boot() {
    // hero cover image (trip cover, faded behind the title)
    const hb = $("#heroBg");
    if (hb && TRIP.cover) hb.style.backgroundImage = `url("${absUrl(TRIP.cover)}")`;

    buildClock();

    renderStats();
    tickCountdown();
    cdTimer = setInterval(tickCountdown, 1000);

    renderDayRail();
    renderCatFilters();
    initMap();
    initLayerToggle();
    // Open whichever day is live (or next up) rather than always day 1.
    const live = currentDay(nowMs());
    selectDay(live ? live.day : DAYS[0].day, false);
    // Marks move on their own; no reload and no redeploy during the trip.
    setInterval(paintProgress, 30000);

    renderFood();
    renderTips();
    renderPacking();

    renderDashboard();
    $("#backBtn").addEventListener("click", showDashboard);

    // In-page anchors (nav + "Plan the journey"): switch to the section's tab
    // instead of changing the hash, which would otherwise flip back to the dashboard.
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        if (PANEL_FOR[id]) { e.preventDefault(); showPanel(PANEL_FOR[id], id); return; }
        const target = id && document.getElementById(id);
        if (target) { e.preventDefault(); scrollToEl(target); }
      });
    });
    showPanel("itinerary", null, false);

    window.addEventListener("popstate", () => showView(viewForHash()));
    showView(viewForHash());

    // map needs a size recalc once visible
    setTimeout(() => map && map.invalidateSize(), 200);
    initReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
