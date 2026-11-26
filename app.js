/* =========================================================
   SBB — redesign demo
   Fahrplan- und Tafellogik. Alle Daten sind Beispielwerte,
   deterministisch aus Bahnhof, Strecke und Zeit berechnet.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Bahnhöfe ---------- */
  const STATIONS = [
    { name: "Zürich HB", lat: 47.3782, lon: 8.5403 },
    { name: "Zürich Flughafen", lat: 47.4508, lon: 8.5620 },
    { name: "Bern", lat: 46.9489, lon: 7.4391 },
    { name: "Basel SBB", lat: 47.5476, lon: 7.5897 },
    { name: "Basel Bad Bf", lat: 47.5673, lon: 7.6071 },
    { name: "Genève", lat: 46.2102, lon: 6.1424 },
    { name: "Genève-Aéroport", lat: 46.2381, lon: 6.1092 },
    { name: "Lausanne", lat: 46.5168, lon: 6.6291 },
    { name: "Luzern", lat: 47.0502, lon: 8.3093 },
    { name: "Winterthur", lat: 47.5003, lon: 8.7237 },
    { name: "St. Gallen", lat: 47.4231, lon: 9.3699 },
    { name: "Chur", lat: 46.8531, lon: 9.5297 },
    { name: "Lugano", lat: 46.0050, lon: 8.9511 },
    { name: "Bellinzona", lat: 46.1956, lon: 9.0244 },
    { name: "Locarno", lat: 46.1716, lon: 8.8018 },
    { name: "Brig", lat: 46.3194, lon: 7.9881 },
    { name: "Visp", lat: 46.2940, lon: 7.8815 },
    { name: "Zermatt", lat: 46.0244, lon: 7.7486 },
    { name: "Interlaken Ost", lat: 46.6905, lon: 7.8690 },
    { name: "Spiez", lat: 46.6863, lon: 7.6803 },
    { name: "Thun", lat: 46.7546, lon: 7.6295 },
    { name: "Fribourg", lat: 46.8032, lon: 7.1512 },
    { name: "Neuchâtel", lat: 46.9964, lon: 6.9356 },
    { name: "Biel/Bienne", lat: 47.1329, lon: 7.2426 },
    { name: "Olten", lat: 47.3519, lon: 7.9077 },
    { name: "Aarau", lat: 47.3914, lon: 8.0511 },
    { name: "Zug", lat: 47.1737, lon: 8.5155 },
    { name: "Schaffhausen", lat: 47.6981, lon: 8.6325 },
    { name: "Sion", lat: 46.2275, lon: 7.3594 },
    { name: "Montreux", lat: 46.4330, lon: 6.9107 },
    { name: "Vevey", lat: 46.4628, lon: 6.8431 },
    { name: "Yverdon-les-Bains", lat: 46.7817, lon: 6.6407 },
    { name: "Solothurn", lat: 47.2042, lon: 7.5326 },
    { name: "Burgdorf", lat: 47.0565, lon: 7.6210 },
    { name: "Baden", lat: 47.4764, lon: 8.3078 },
    { name: "Frauenfeld", lat: 47.5565, lon: 8.8963 },
    { name: "Wil SG", lat: 47.4623, lon: 9.0410 },
    { name: "Romanshorn", lat: 47.5653, lon: 9.3793 },
    { name: "Kreuzlingen", lat: 47.6476, lon: 9.1724 },
    { name: "Davos Platz", lat: 46.7930, lon: 9.8227 },
    { name: "St. Moritz", lat: 46.4981, lon: 9.8393 },
    { name: "Andermatt", lat: 46.6355, lon: 8.5942 },
    { name: "Airolo", lat: 46.5277, lon: 8.6090 },
    { name: "Einsiedeln", lat: 47.1285, lon: 8.7444 },
    { name: "Rapperswil", lat: 47.2257, lon: 8.8167 }
  ];

  const HUBS = ["Zürich HB", "Bern", "Basel SBB", "Olten", "Lausanne", "Luzern", "Winterthur", "Biel/Bienne"];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ---------- Zufall mit Seed ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = (seed) => mulberry32(hash(String(seed)));

  /* ---------- Geo ---------- */
  function haversine(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * 6371 * Math.asin(Math.sqrt(s));
  }
  const railKm = (a, b) => haversine(a, b) * 1.28;
  const stationByName = (name) => STATIONS.find((s) => s.name === name) || null;

  const norm = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  function resolveStation(value) {
    const q = norm(value);
    if (!q) return null;
    return (
      STATIONS.find((s) => norm(s.name) === q) ||
      STATIONS.find((s) => norm(s.name).startsWith(q)) ||
      STATIONS.find((s) => norm(s.name).indexOf(q) > -1) ||
      null
    );
  }

  /* ---------- Formatierung ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const fmtTime = (d) => pad(d.getHours()) + ":" + pad(d.getMinutes());
  const fmtDur = (min) => {
    const m = Math.max(1, Math.round(min));
    return m >= 60 ? Math.floor(m / 60) + " h " + pad(m % 60) : m + " min";
  };
  const chf = (v) => "CHF " + v.toFixed(2).replace(".", "’");
  const roundPrice = (v) => Math.max(2.6, Math.round(v / 0.2) * 0.2);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const OCC_LABEL = ["", "wenig ausgelastet", "mässig ausgelastet", "gut ausgelastet", "stark ausgelastet"];
  const occBars = (n) =>
    '<span class="occ" aria-label="' + OCC_LABEL[n] + '">' +
    [1, 2, 3].map((i) => '<i class="' + (i <= n ? "on" : "") + '"></i>').join("") +
    "</span>";

  /* ---------- Verbindungen ---------- */
  function lineFor(km, seed) {
    const r = rand("line" + seed);
    const type = km > 150 ? "IC" : km > 70 ? "IR" : km > 25 ? "RE" : "S";
    return type + " " + (1 + Math.floor(r() * 9));
  }

  function buildLegs(from, to, changes, dep, dur, seed) {
    const r = rand("legs" + seed);
    const stops = [from];

    if (changes > 0) {
      const candidates = HUBS
        .filter((name) => name !== from.name && name !== to.name)
        .map(stationByName)
        .filter(Boolean)
        .sort((a, b) => railKm(from, a) + railKm(a, to) - (railKm(from, b) + railKm(b, to)));
      const picked = candidates.slice(0, changes).sort((a, b) => railKm(from, a) - railKm(from, b));
      stops.push.apply(stops, picked);
    }
    stops.push(to);

    const segments = [];
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const d = railKm(stops[i], stops[i + 1]);
      segments.push(d);
      total += d;
    }

    const legs = [];
    let t = dep.getTime();
    const rideTime = Math.max(3, dur - changes * 5);
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const legMin = Math.max(3, Math.round(rideTime * (segments[i] / total)));
      const arr = new Date(t + legMin * 60000);
      legs.push({
        from: a,
        to: b,
        dep: new Date(t),
        arr: arr,
        line: lineFor(segments[i], a.name + b.name + i + seed),
        platform: 1 + Math.floor(r() * 12),
        km: Math.max(1, Math.round(segments[i]))
      });
      t = arr.getTime() + 5 * 60000;
    }
    return legs;
  }

  function buildConnections(from, to, when, directOnly) {
    const km = railKm(from, to);
    const baseDur = Math.max(4, Math.round(km / 1.45) + 5);
    const headway = km > 120 ? 30 : km > 50 ? 15 : 10;
    const seedKey = from.name + "→" + to.name;
    const step = headway * 60000;
    const firstDep = new Date(Math.ceil((when.getTime() + 120000) / step) * step);

    const hubCount = (HUBS.indexOf(from.name) > -1 ? 1 : 0) + (HUBS.indexOf(to.name) > -1 ? 1 : 0);
    const out = [];

    for (let i = 0; i < 5; i++) {
      const r = rand(seedKey + "#" + i);
      let changes;
      if (hubCount === 2) changes = km > 200 && r() < 0.4 ? 1 : 0;
      else if (hubCount === 1) changes = km < 70 ? 0 : 1;
      else changes = km < 60 ? 1 : r() < 0.5 ? 1 : 2;
      if (directOnly) changes = 0;

      const dur = Math.max(4, Math.round(baseDur + changes * 6 + (r() * 6 - 3)));
      const dep = new Date(firstDep.getTime() + i * step);
      const arr = new Date(dep.getTime() + dur * 60000);
      const priceFull = roundPrice(km * 0.52 + 1.6 + r() * 2);

      out.push({
        dep: dep,
        arr: arr,
        dur: dur,
        changes: changes,
        priceFull: priceFull,
        line: lineFor(km, seedKey + i),
        platform: 1 + Math.floor(r() * 12),
        occ: 1 + Math.floor(r() * 4),
        legs: buildLegs(from, to, changes, dep, dur, seedKey + "#" + i)
      });
    }
    return out;
  }

  /* ---------- Planner ---------- */
  const form = $("#planner-form");
  const fromInput = $("#from");
  const toInput = $("#to");
  const dateInput = $("#date");
  const timeInput = $("#time");
  const directInput = $("#direct");
  const halbtaxInput = $("#halbtax");
  const results = $("#results");

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function departureDate() {
    const d = dateInput.value || todayISO();
    const t = timeInput.value || "12:00";
    const parts = d.split("-").map(Number);
    const hm = t.split(":").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], hm[0] || 0, hm[1] || 0, 0, 0);
  }

  function legRow(leg) {
    return (
      '<li class="leg">' +
      '<span class="leg__time">' + fmtTime(leg.dep) + "</span>" +
      '<span class="leg__dot" aria-hidden="true"></span>' +
      '<span class="leg__body"><strong>' + esc(leg.from.name) + "</strong> → " + esc(leg.to.name) +
      ' <span class="badge badge--sm">' + esc(leg.line) + "</span>" +
      ' <span class="leg__meta">' + leg.km + " km · Gleis " + leg.platform + "</span></span>" +
      '<span class="leg__time">' + fmtTime(leg.arr) + "</span>" +
      "</li>"
    );
  }

  function connCard(c, from, to) {
    const half = halbtaxInput.checked;
    const price = half ? roundPrice(c.priceFull / 2) : c.priceFull;
    const changesLabel = c.changes === 0 ? "direkt" : c.changes + (c.changes === 1 ? " Umstieg" : " Umstiege");

    return (
      '<article class="conn">' +
        '<div class="conn__main">' +
          '<div class="conn__times"><span class="t">' + fmtTime(c.dep) + '</span>' +
            '<span class="conn__dash" aria-hidden="true"></span>' +
            '<span class="t">' + fmtTime(c.arr) + "</span></div>" +
          '<div class="conn__route">' +
            '<p class="conn__stations">' + esc(from.name) + ' <span aria-hidden="true">→</span> ' + esc(to.name) + "</p>" +
            '<p class="conn__meta"><span class="badge">' + esc(c.line) + "</span>" +
              "<span>" + fmtDur(c.dur) + "</span><span>·</span>" +
              "<span>" + changesLabel + "</span><span>·</span>" +
              "<span>Gleis " + c.platform + "</span><span>·</span>" +
              "<span>" + OCC_LABEL[c.occ] + "</span></p>" +
          "</div>" +
          '<div class="conn__price"><span class="conn__price-label">' +
            (half ? "mit Halbtax" : "2. Klasse") + "</span><strong>" + chf(price) + "</strong></div>" +
          '<a class="btn btn--ghost conn__cta" href="#billette">Billett</a>' +
        "</div>" +
        '<details class="conn__details">' +
          "<summary>Fahrtdetails · Sparbillette ab " + chf(roundPrice(price * 0.55)) + "</summary>" +
          '<ol class="legs">' + c.legs.map(legRow).join("") + "</ol>" +
        "</details>" +
      "</article>"
    );
  }

  function renderResults() {
    const from = resolveStation(fromInput.value);
    const to = resolveStation(toInput.value);

    if (!from || !to) {
      results.innerHTML =
        '<p class="results__error" role="alert">Bahnhof nicht gefunden. Bitte aus der Vorschlagsliste wählen — zum Beispiel «Zürich HB» oder «Bern».</p>';
      return;
    }
    if (from.name === to.name) {
      results.innerHTML =
        '<p class="results__error" role="alert">Start und Ziel sind derselbe Bahnhof. Bitte zwei verschiedene Orte wählen.</p>';
      return;
    }

    const when = departureDate();
    const conns = buildConnections(from, to, when, directInput.checked);
    const dateLabel = when.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "long" });

    results.innerHTML =
      '<div class="results__head"><strong>' + esc(from.name) + " → " + esc(to.name) + "</strong>" +
        "<span>" + conns.length + " Verbindungen · " + dateLabel + " · ab " + fmtTime(when) + "</span></div>" +
      conns.map((c) => connCard(c, from, to)).join("");
  }

  /* ---------- Abfahrtstafel ---------- */
  const boardRows = $("#board-rows");
  let boardStation = "Zürich HB";
  let rows = [];

  function newBoardRow(station, slot, depTime) {
    const r = rand(station + "|" + slot + "|" + Math.floor(depTime / 60000));
    const others = STATIONS.filter((s) => s.name !== station);
    const dest = others[Math.floor(r() * others.length)];
    const km = railKm(stationByName(station), dest);
    const type = km > 150 ? "IC" : km > 70 ? "IR" : km > 25 ? "RE" : "S";
    return {
      dest: dest.name,
      line: type + " " + (1 + Math.floor(r() * 9)),
      dep: depTime,
      platform: 1 + Math.floor(r() * 12),
      occ: 1 + Math.floor(r() * 4)
    };
  }

  function boardRowHTML(row) {
    return (
      '<div class="board__row">' +
        '<span class="board__time">' + fmtTime(new Date(row.dep)) + "</span>" +
        '<span class="board__line"><span class="badge">' + esc(row.line) + "</span></span>" +
        '<span class="board__dest">' + esc(row.dest) + "</span>" +
        '<span class="board__plat">Gleis ' + row.platform + "</span>" +
        '<span class="board__occ">' + occBars(row.occ) + "</span>" +
        '<span class="board__cd" data-dep="' + row.dep + '"></span>' +
      "</div>"
    );
  }

  function seedBoard(station) {
    boardStation = station;
    const now = Date.now();
    rows = [];
    for (let i = 0; i < 6; i++) {
      rows.push(newBoardRow(station, i, now + (i * 3 + 1) * 60000));
    }
    boardRows.innerHTML = rows.map(boardRowHTML).join("");
    updateCountdowns();
  }

  function updateCountdowns() {
    const now = Date.now();
    $$(".board__cd", boardRows).forEach((el, i) => {
      const dep = Number(el.dataset.dep);
      const diff = dep - now;
      el.textContent = diff <= 30000 ? "jetzt" : "in " + Math.max(1, Math.round(diff / 60000)) + " min";
      el.classList.toggle("is-now", diff <= 60000);

      if (diff < -45000) {
        const next = newBoardRow(boardStation, i, now + (14 + i * 3) * 60000);
        rows[i] = next;
        const rowEl = el.parentNode;
        $(".board__time", rowEl).textContent = fmtTime(new Date(next.dep));
        $(".badge", rowEl).textContent = next.line;
        $(".board__dest", rowEl).textContent = next.dest;
        $(".board__plat", rowEl).textContent = "Gleis " + next.platform;
        $(".board__occ", rowEl).innerHTML = occBars(next.occ);
        el.dataset.dep = String(next.dep);
        el.textContent = "in " + Math.max(1, Math.round((next.dep - now) / 60000)) + " min";
      }
    });
  }

  /* ---------- Aufbau ---------- */
  function init() {
    $("#stations").innerHTML = STATIONS.map((s) => '<option value="' + esc(s.name) + '"></option>').join("");

    dateInput.value = todayISO();
    const soon = new Date(Date.now() + 15 * 60000);
    soon.setMinutes(Math.ceil(soon.getMinutes() / 5) * 5, 0, 0);
    timeInput.value = pad(soon.getHours()) + ":" + pad(soon.getMinutes());

    fromInput.value = "Zürich HB";
    toInput.value = "Bern";
    renderResults();
    seedBoard("Zürich HB");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      renderResults();
    });

    [directInput, halbtaxInput].forEach((el) => el.addEventListener("change", renderResults));

    $("#swap").addEventListener("click", function () {
      const a = fromInput.value;
      fromInput.value = toInput.value;
      toInput.value = a;
      renderResults();
    });

    $$(".chip, .deal [data-from]").forEach((btn) => {
      btn.addEventListener("click", function () {
        fromInput.value = btn.dataset.from;
        toInput.value = btn.dataset.to;
        renderResults();
        $("#planner").scrollIntoView({ behavior: "smooth", block: "start" });
        fromInput.focus({ preventScroll: true });
      });
    });

    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", function () {
        $$(".tab").forEach((t) => {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        seedBoard(tab.dataset.station);
      });
    });

    setInterval(updateCountdowns, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
