/* =====================================================================
   Travel Concierge — app logic
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
  const VISITED_KEY = "tc_visited_v1";
  const PACK_KEY    = "tc_pack_v1";
  let visited = new Set(store.get(VISITED_KEY, []));
  const stopId = (d, i) => `${d}-${i}`;

  /* ----- derived stats ----- */
  const allStops = DAYS.flatMap((d) => d.stops);
  const count = (fn) => allStops.filter(fn).length;
  const cities = [...new Set(DAYS.map((d) => d.city))];

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
    const target = new Date(TRIP.startISO + "T00:00:00").getTime();
    const now = Date.now();
    let diff = Math.max(0, target - now);
    const dd = Math.floor(diff / 86400000); diff -= dd * 86400000;
    const hh = Math.floor(diff / 3600000);  diff -= hh * 3600000;
    const mm = Math.floor(diff / 60000);    diff -= mm * 60000;
    const ss = Math.floor(diff / 1000);
    const set = (k, v) => { const n = $(`[data-cd="${k}"]`); if (n) n.textContent = String(v).padStart(2, "0"); };
    set("days", dd); set("hours", hh); set("mins", mm); set("secs", ss);
    if (target - now <= 0 && cdTimer) { clearInterval(cdTimer); $("#countdown").innerHTML =
      '<div class="cd-cell" style="min-width:auto;padding:14px 22px"><b style="font-size:22px">Bon voyage! ✈️</b></div>'; }
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

  function popupHtml(s) {
    const c = CATS[s.cat] || { label: s.cat };
    const gmaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + " Thailand")}`;
    return `
      <div class="lp">
        <div class="lp-cat">${esc(c.label)}</div>
        <div class="lp-name">${esc(s.name)}</div>
        <div class="lp-desc">${esc(s.desc)}</div>
        ${s.approx ? '<div class="lp-approx">◦ approximate location — confirm before you go</div>' : ""}
        <a class="lp-link" href="${gmaps}" target="_blank" rel="noopener">Open in Google Maps →</a>
      </div>`;
  }

  function initMap() {
    map = L.map("leaflet", { scrollWheelZoom: false, zoomControl: true })
      .setView([15.5, 100.5], 6);

    // Two free, keyless base layers: a clean street map + satellite (with labels).
    baseStreets = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 20,
    });
    baseSatellite = L.layerGroup([
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics", maxZoom: 19,
      }),
      // transparent place labels on top of the imagery (Google-style hybrid look)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 20,
      }),
    ]);
    baseLayers = { streets: baseStreets, satellite: baseSatellite };
    baseStreets.addTo(map);

    map.on("click", () => map.scrollWheelZoom.enable());

    markerLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);

    DAYS.forEach((d) => {
      d.stops.forEach((s, i) => {
        const m = L.marker([s.lat, s.lng], { icon: pinIcon(s.cat, s.approx, i + 1) })
          .bindPopup(popupHtml(s), { closeButton: true });
        markers.push({ marker: m, day: d.day, idx: i, cat: s.cat, stop: s });
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
         <div class="dp-city">${esc(d.city)}</div>`);
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
    // stylesheet (css/…), not the document — so resolve it here instead.
    const heroAbs = new URL(heroSrc, document.baseURI).href;
    const banner = el("div", "day-banner",
      `<div class="db-inner">
         <div class="db-meta"><span>Day ${d.day} of ${DAYS.length}</span><span>·</span>
           <span>${esc(dateStr)}</span><span>·</span>
           <span class="db-city">${esc(d.city)}</span></div>
         <h3>${esc(d.theme)}</h3>
         <p>${esc(d.blurb)}</p>
       </div>`);
    banner.style.setProperty("--hero", `url("${heroAbs}")`);
    // warm the browser cache so switching days feels instant
    const pre = new Image(); pre.src = heroSrc;
    wrap.appendChild(banner);

    const list = el("div", "stop-list");
    d.stops.forEach((s, i) => {
      const c = CATS[s.cat] || { label: s.cat, color: "#ccc", icon: "📍" };
      const id = stopId(d.day, i);
      const isVisited = visited.has(id);
      const node = el("div", "stop" + (isVisited ? " visited" : ""));
      node.style.setProperty("--dot", c.color);
      const ig = `https://www.instagram.com/explore/tags/${slug(s.name)}/`;
      node.innerHTML = `
        <div class="stop-top">
          <div class="stop-emoji">${c.icon}</div>
          <div class="stop-main">
            <div class="stop-name">${esc(s.name)}<span class="stop-cat">${esc(c.label)}</span></div>
            ${s.time ? `<div class="stop-time"><span class="clock">🕘</span> ${esc(s.time)}</div>` : ""}
            <div class="stop-desc">${esc(s.desc)}</div>
            <div class="stop-tip"><b>Tip ·</b> ${esc(s.tip)}</div>
            <div class="stop-actions">
              <button class="stop-btn locate">Show on map</button>
              <button class="stop-btn visit ${isVisited ? "on" : ""}">${isVisited ? "✓ Visited" : "Mark visited"}</button>
              <a class="stop-btn ig" href="${ig}" target="_blank" rel="noopener" title="Explore #${slug(s.name)} on Instagram">📷 Explore</a>
            </div>
          </div>
        </div>`;
      // locate
      node.querySelector(".locate").addEventListener("click", () => {
        document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
        const mk = markers.find((m) => m.day === d.day && m.idx === i);
        if (mk) { map.setView([s.lat, s.lng], 14, { animate: true }); mk.marker.openPopup(); }
      });
      // visited toggle
      const vb = node.querySelector(".visit");
      vb.addEventListener("click", () => {
        if (visited.has(id)) { visited.delete(id); node.classList.remove("visited"); vb.classList.remove("on"); vb.textContent = "Mark visited"; }
        else { visited.add(id); node.classList.add("visited"); vb.classList.add("on"); vb.textContent = "✓ Visited"; }
        store.set(VISITED_KEY, [...visited]);
      });
      list.appendChild(node);
    });
    wrap.appendChild(list);
  }

  function selectDay(dayNum, scroll) {
    activeDay = dayNum;
    DAYS.forEach((d) => d._pill && d._pill.classList.toggle("active", d.day === dayNum));
    const d = DAYS.find((x) => x.day === dayNum);
    renderDetail(d);
    $("#mapTitle").textContent = `Day ${d.day} · ${d.city}`;
    renderMap(dayNum);
    if (scroll && window.innerWidth <= 900) {
      $("#planDetail").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* =================================================================
     CATEGORY FILTER CHIPS
     ================================================================= */
  function renderCatFilters() {
    const wrap = $("#catFilters");
    // only categories actually present in the trip
    const present = [...new Set(allStops.map((s) => s.cat))];
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

  /* =================================================================
     BOOT
     ================================================================= */
  function boot() {
    // hero cover image (trip cover, faded behind the title)
    const hb = $("#heroBg");
    if (hb && TRIP.cover) hb.style.backgroundImage = `url("${absUrl(TRIP.cover)}")`;

    renderStats();
    tickCountdown();
    cdTimer = setInterval(tickCountdown, 1000);

    renderDayRail();
    renderCatFilters();
    initMap();
    initLayerToggle();
    selectDay(DAYS[0].day, false);

    renderFood();
    renderTips();
    renderPacking();

    renderDashboard();
    $("#backBtn").addEventListener("click", showDashboard);
    window.addEventListener("popstate", () =>
      showView(location.hash === "#trip" ? "trip" : "dashboard"));
    showView(location.hash === "#trip" ? "trip" : "dashboard");

    // map needs a size recalc once visible
    setTimeout(() => map && map.invalidateSize(), 200);
    initReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
