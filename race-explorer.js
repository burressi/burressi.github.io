/*
  Season data explorer for the race strategy case study.
  Three views: Season, Race (lap times, positions, stints) and Pit Stops.
  Charts are drawn as plain SVG. Race files load only when a race is opened.
*/
(function () {
  'use strict';

  // ---- Data store (data files call RaceData.add / .season / .service) ----
  var store = { races: {}, season: [], waiting: {} };
  window.RaceData = {
    add: function (race) {
      store.races[race.id] = race;
      (store.waiting[race.id] || []).forEach(function (fn) { fn(race); });
      delete store.waiting[race.id];
    },
    season: function (rows) { store.season = rows; }
  };

  var DATA_DIR = '2026%20Race%20Data/';
  var CAR_COLOR = { '177': '#18453B', '178': '#b8732e' };
  var DRIVER_COLOR = ['#18453B', '#b8732e', '#4a6f8f', '#7a5c99', '#7d7a2e', '#a0485a'];
  var COMPARE_COLOR = '#4a6f8f';
  var RIVAL_COLOR = '#c4bdb0';
  var SERVICE_LABEL = { fuel: 'Fuel', tires: 'Tires', driver: 'Driver change' };

  function loadRace(id, done) {
    if (store.races[id]) { done(store.races[id]); return; }
    if (store.waiting[id]) { store.waiting[id].push(done); return; }
    store.waiting[id] = [done];
    var s = document.createElement('script');
    s.src = DATA_DIR + id + '.js';
    s.onerror = function () { delete store.waiting[id]; };
    document.head.appendChild(s);
  }

  // ---- Formatting ----
  function lapTime(s) {
    if (s == null) return '–';
    var m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }
  function duration(s) {
    if (s == null) return '–';
    if (s < 60) return s.toFixed(1) + ' s';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (h) return h + ':' + pad(m) + ':' + pad(Math.round(r));
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }
  function clock(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h + ':' + pad(m);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function driverColor(name) {
    var i = parseInt(String(name).replace(/\D/g, ''), 10) - 1;
    return DRIVER_COLOR[(i >= 0 ? i : 0) % DRIVER_COLOR.length];
  }
  function median(a) {
    if (!a.length) return null;
    var b = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
  function lapOf(car, n) {
    if (!car.byLap) { car.byLap = {}; car.laps.forEach(function (l) { car.byLap[l[0]] = l; }); }
    return car.byLap[n];
  }
  function raceName(r) { return r.event + ' ' + r.label; }

  // ---- Small DOM / SVG helpers ----
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function el(tag, cls, text, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function scale(d0, d1, r0, r1) {
    return function (v) { return r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0); };
  }
  // An image that falls back to a text label until the file exists
  function iconOrText(src, label, cls, parent, extra) {
    var wrap = el('span', cls, null, parent);
    var img = el('img', null, null, wrap);
    img.alt = label;
    img.src = src;
    img.addEventListener('error', function () {
      wrap.removeChild(img);
      el('span', 'icon-text', label + (extra ? ' ' + extra : ''), wrap);
    });
    if (extra) {
      var x = el('span', 'icon-extra', extra, wrap);
      img.addEventListener('error', function () { if (x.parentNode) wrap.removeChild(x); });
    }
    return wrap;
  }

  // Chart frame: returns svg plus x/y helpers
  function frame(box, opts) {
    box.innerHTML = '';
    var W = Math.max(box.clientWidth, 300), H = opts.height;
    var m = { t: 14, r: 16, b: 34, l: opts.left || 56 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': opts.label });
    box.appendChild(svg);
    return { svg: svg, W: W, H: H, m: m,
      x: scale(opts.x[0], opts.x[1], m.l, W - m.r),
      y: scale(opts.y[0], opts.y[1], H - m.b, m.t) };
  }
  function axes(f, xTicks, yTicks, xFmt, yFmt, xTitle, noGrid) {
    var g = svgEl('g', { 'class': 'axis' }, f.svg);
    yTicks.forEach(function (v) {
      var y = f.y(v);
      if (!noGrid) svgEl('line', { x1: f.m.l, x2: f.W - f.m.r, y1: y, y2: y, 'class': 'grid' }, g);
      svgEl('text', { x: f.m.l - 8, y: y + 4, 'text-anchor': 'end' }, g).textContent = yFmt(v);
    });
    xTicks.forEach(function (v) {
      svgEl('text', { x: f.x(v), y: f.H - f.m.b + 18, 'text-anchor': 'middle' }, g).textContent = xFmt(v);
    });
    if (xTitle) svgEl('text', { x: f.W - f.m.r, y: f.H - 2, 'text-anchor': 'end', 'class': 'axis-title' }, g).textContent = xTitle;
  }
  function niceStep(span, count) {
    var raw = span / count, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }
  function ticks(a, b, count) {
    var s = niceStep(b - a, count), out = [];
    for (var v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) out.push(+v.toFixed(6));
    return out;
  }
  function posTicks(n) {
    var step = Math.max(1, Math.ceil(n / 6)), out = [];
    for (var v = 1; v <= n; v += step) out.push(v);
    return out;
  }
  function path(points) {
    var d = '', pen = false;
    points.forEach(function (p) {
      if (!p) { pen = false; return; }
      d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
      pen = true;
    });
    return d;
  }

  // Tooltip shared by all charts
  var tip;
  function showTip(box, x, y, html) {
    if (!tip) { tip = el('div', 'chart-tip'); tip.setAttribute('role', 'presentation'); }
    if (tip.parentNode !== box) box.appendChild(tip);
    tip.innerHTML = html;
    tip.hidden = false;
    var left = Math.min(x + 14, box.clientWidth - tip.offsetWidth - 4);
    tip.style.left = Math.max(left, 4) + 'px';
    tip.style.top = Math.max(y - 10, 0) + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  // ---- Explorer (starts once the data files have run) ----
  document.addEventListener('DOMContentLoaded', init);

  function init() {
  var root = document.getElementById('race-explorer');
  if (!root || !store.season.length) return;

  var state = { view: 'season', race: null, car: '177', compare: null };
  var q = function (sel) { return root.querySelector(sel); };
  var panels = { season: q('#rx-season'), race: q('#rx-race'), pits: q('#rx-pits') };
  var controls = q('.rx-controls');
  var raceSelect = q('#rx-race-select');
  var carPicker = q('.rx-cars');

  // Tabs
  var tabs = root.querySelectorAll('[role="tab"]');
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener('click', function () { setView(t.getAttribute('data-view')); });
    t.addEventListener('keydown', function (e) {
      var i = Array.prototype.indexOf.call(tabs, t);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        n.focus(); setView(n.getAttribute('data-view'));
      }
    });
  });

  function setView(v) {
    state.view = v;
    Array.prototype.forEach.call(tabs, function (t) {
      var on = t.getAttribute('data-view') === v;
      t.setAttribute('aria-selected', on);
      t.classList.toggle('is-active', on);
      t.tabIndex = on ? 0 : -1;
    });
    for (var k in panels) panels[k].hidden = k !== v;
    controls.hidden = v === 'season';
    render();
  }

  // Race select
  store.season.slice().sort(function (a, b) { return a.round - b.round; }).forEach(function (r) {
    var o = el('option', null, raceName(r), raceSelect);
    o.value = r.id;
  });
  raceSelect.addEventListener('change', function () { state.race = raceSelect.value; state.compare = null; render(); });

  function seasonRow(id) {
    for (var i = 0; i < store.season.length; i++) if (store.season[i].id === id) return store.season[i];
  }

  // Car picker, rebuilt for each race (some races had one car)
  function buildCarPicker(row) {
    carPicker.innerHTML = '';
    var numbers = row.entries.map(function (e) { return e.number; });
    if (numbers.indexOf(state.car) < 0) state.car = numbers[0];
    row.entries.forEach(function (e) {
      var b = el('button', 'rx-car', null, carPicker);
      b.type = 'button';
      b.setAttribute('aria-pressed', e.number === state.car);
      iconOrText('pictures/car-' + e.number + '.png', '#' + e.number, 'rx-car-img', b);
      var t = el('span', 'rx-car-label', null, b);
      el('strong', null, '#' + e.number, t);
      el('span', null, e.class + ' class', t);
      b.addEventListener('click', function () { state.car = e.number; state.compare = null; render(); });
    });
  }

  function render() {
    hideTip();
    if (state.view === 'season') { renderSeason(); return; }
    if (!state.race) state.race = store.season[0].id;
    raceSelect.value = state.race;
    buildCarPicker(seasonRow(state.race));
    var panel = panels[state.view];
    panel.setAttribute('aria-busy', 'true');
    loadRace(state.race, function (race) {
      panel.removeAttribute('aria-busy');
      if (race.id !== state.race) return;
      if (state.view === 'race') renderRace(race);
      if (state.view === 'pits') renderPits(race);
    });
  }

  // ---------------- Season view ----------------
  function renderSeason() {
    var rows = store.season.slice().sort(function (a, b) { return a.round - b.round; });
    var p = panels.season;
    var laps = 0, stops = 0, tracks = {};
    rows.forEach(function (r) {
      tracks[r.track] = true;
      r.entries.forEach(function (e) { laps += e.laps; stops += e.stops; });
    });
    var kpis = q('#rx-season-kpis');
    kpis.innerHTML = '';
    [[rows.length, 'races'], [laps.toLocaleString(), 'laps run'], [stops, 'pit stops'], [Object.keys(tracks).length, 'tracks']]
      .forEach(function (k) {
        var d = el('div', null, null, kpis);
        el('span', 'stat-num', k[0], d);
        el('span', 'stat-label', k[1], d);
      });

    // Finishing position by round
    var box = q('#rx-season-chart');
    var maxPos = 1;
    rows.forEach(function (r) { r.entries.forEach(function (e) { maxPos = Math.max(maxPos, e.starters); }); });
    var f = frame(box, { height: 280, x: [0.5, rows.length + 0.5], y: [maxPos + 0.5, 0.5], left: 40,
      label: 'Class finishing position by race for cars 177 and 178' });
    f.m.b = 52;
    f.y = scale(maxPos + 0.5, 0.5, f.H - f.m.b, f.m.t);
    axes(f, [], posTicks(maxPos), String, function (v) { return 'P' + v; });
    var g = svgEl('g', { 'class': 'axis' }, f.svg);
    rows.forEach(function (r, i) {
      var t = svgEl('text', { x: f.x(i + 1), y: f.H - f.m.b + 18, 'text-anchor': 'middle' }, g);
      t.textContent = r.event.replace('Road America', 'Road Am.').replace('Watkins Glen', 'Watkins').replace('Homestead-Miami', 'Homestead');
      var t2 = svgEl('text', { x: f.x(i + 1), y: f.H - f.m.b + 33, 'text-anchor': 'middle', 'class': 'axis-sub' }, g);
      t2.textContent = r.label;
    });
    ['177', '178'].forEach(function (n) {
      var pts = rows.map(function (r, i) {
        var e = r.entries.filter(function (x) { return x.number === n; })[0];
        return e ? [f.x(i + 1), f.y(e.finish), e, r] : null;
      });
      svgEl('path', { d: path(pts), fill: 'none', stroke: CAR_COLOR[n], 'stroke-width': 2 }, f.svg);
      pts.forEach(function (p) {
        if (!p) return;
        var c = svgEl('circle', { cx: p[0], cy: p[1], r: 6, fill: CAR_COLOR[n], 'class': 'rx-point', tabindex: 0 }, f.svg);
        var lbl = raceName(p[3]) + ', #' + n + ': P' + p[2].finish + ' of ' + p[2].starters + ' in ' + p[2].class;
        svgEl('title', {}, c).textContent = lbl;
        c.addEventListener('click', function () { openRace(p[3].id, n); });
        c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') openRace(p[3].id, n); });
      });
    });
    var legend = q('#rx-season-legend');
    legend.innerHTML = '';
    ['177', '178'].forEach(function (n) {
      var s = el('span', 'rx-key', '#' + n, legend);
      s.style.setProperty('--key', CAR_COLOR[n]);
    });

    // Results table
    var tb = q('#rx-season-table tbody');
    tb.innerHTML = '';
    rows.forEach(function (r) {
      r.entries.forEach(function (e, j) {
        var tr = el('tr', null, null, tb);
        el(j ? 'td' : 'th', null, j ? '' : raceName(r), tr).scope = 'row';
        el('td', null, '#' + e.number + ' · ' + e.class, tr);
        el('td', 'num', 'P' + e.finish + ' / ' + e.starters, tr);
        el('td', 'num', e.laps + (e.laps < e.winnerLaps ? ' (−' + (e.winnerLaps - e.laps) + ')' : ''), tr);
        el('td', 'num', lapTime(e.best), tr);
        el('td', 'num', e.gapPct === 0 ? 'Class best' : '+' + e.gapPct.toFixed(2) + '%', tr);
        el('td', 'num', e.stops, tr);
        el('td', 'num', duration(e.pitTotal), tr);
        var td = el('td', null, null, tr);
        var b = el('button', 'rx-link', 'Open →', td);
        b.type = 'button';
        b.setAttribute('aria-label', 'Open ' + raceName(r) + ' for car ' + e.number);
        b.addEventListener('click', function () { openRace(r.id, e.number); });
      });
    });
  }

  function openRace(id, car) {
    state.race = id; state.car = car; state.compare = null;
    setView('race');
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------- Race view ----------------
  function stintsFor(car) {
    var cuts = (car.stops || []).map(function (s) { return s.lap; });
    var stints = [], cur = [];
    car.laps.forEach(function (l) {
      cur.push(l);
      if (cuts.indexOf(l[0]) >= 0) { stints.push(cur); cur = []; }
    });
    if (cur.length) stints.push(cur);
    return stints.map(function (laps, i) {
      var count = {};
      laps.forEach(function (l) { count[l[6]] = (count[l[6]] || 0) + 1; });
      var driver = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
      var times = laps.filter(function (l, k) { return l[5] === 0 && !l[4] && k > 0 && l[1]; }).map(function (l) { return l[1]; });
      var cut = (median(times) || 0) * 1.07;
      var clean = times.filter(function (t) { return t <= cut; });
      return { n: i + 1, from: laps[0][0], to: laps[laps.length - 1][0], laps: laps.length, driver: driver,
        median: median(clean), best: clean.length ? Math.min.apply(null, clean) : null };
    });
  }

  function renderRace(race) {
    var car = race.cars[state.car];
    var cls = race.classes[car.class];
    var info = race.classInfo[car.class];
    if (!state.compare || !race.cars[state.compare]) {
      state.compare = cls[0] !== car.number ? cls[0] : (cls[1] || null);
    }
    var cmp = state.compare ? race.cars[state.compare] : null;

    q('#rx-race-summary').textContent = '#' + car.number + ' finished P' + car.finish + ' of ' + info.starters +
      ' in ' + car.class + ' at the ' + raceName(race) + ', completing ' + car.lapCount + ' of ' + info.winnerLaps +
      ' laps. Best lap ' + lapTime(car.best) + (car.gapPct ? ' (+' + car.gapPct.toFixed(2) + '% to the class best).' : ' (class best).');

    // Compare select
    var sel = q('#rx-compare');
    sel.innerHTML = '';
    cls.forEach(function (n) {
      if (n === car.number) return;
      var c = race.cars[n];
      var o = el('option', null, '#' + n + ' ' + c.make + (c.team ? ' (team)' : '') + ' · P' + c.finish, sel);
      o.value = n;
    });
    el('option', null, 'No comparison', sel).value = '';
    sel.value = state.compare || '';
    sel.onchange = function () { state.compare = sel.value || null; renderRace(race); };

    // Driver legend
    var legend = q('#rx-race-legend');
    legend.innerHTML = '';
    car.drivers.forEach(function (d) {
      var s = el('span', 'rx-key', d, legend);
      s.style.setProperty('--key', driverColor(d));
    });
    if (cmp) {
      var s = el('span', 'rx-key rx-key-line', '#' + cmp.number + ' (comparison)', legend);
      s.style.setProperty('--key', COMPARE_COLOR);
    }
    el('span', 'rx-key rx-key-band', 'Full-course yellow', legend);

    drawLapChart(race, car, cmp);
    drawPositionChart(race, car, cmp);
    drawStints(car);
  }

  function drawLapChart(race, car, cmp) {
    var box = q('#rx-lap-chart');
    var maxLap = Math.max(car.lapCount, cmp ? cmp.lapCount : 0);
    var base = Math.min(car.best, cmp ? cmp.best : Infinity);
    var lo = base * 0.99, hi = base * 1.12;
    var f = frame(box, { height: 300, x: [0.5, maxLap + 0.5], y: [lo, hi],
      label: 'Lap times for car ' + car.number + (cmp ? ' compared with car ' + cmp.number : '') });
    // yellow-flag bands from the team car's laps
    car.laps.forEach(function (l) {
      if (l[5]) svgEl('rect', { x: f.x(l[0] - 0.5), y: f.m.t, width: Math.max(f.x(1.5) - f.x(0.5), 1), height: f.H - f.m.b - f.m.t, 'class': 'band-yellow' }, f.svg);
    });
    axes(f, ticks(1, maxLap, 8), ticks(lo, hi, 5), String, lapTime, 'Lap');
    var clip = function (t) { return t == null ? null : f.y(Math.min(t, hi)); };
    if (cmp) {
      svgEl('path', { d: path(cmp.laps.map(function (l) { return l[1] ? [f.x(l[0]), clip(l[1])] : null; })),
        fill: 'none', stroke: COMPARE_COLOR, 'stroke-width': 1.25, 'stroke-dasharray': '4 3', opacity: 0.8 }, f.svg);
    }
    svgEl('path', { d: path(car.laps.map(function (l) { return l[1] ? [f.x(l[0]), clip(l[1])] : null; })),
      fill: 'none', stroke: '#9aa7a2', 'stroke-width': 1 }, f.svg);
    car.laps.forEach(function (l) {
      if (!l[1]) return;
      var off = l[1] > hi;
      svgEl('circle', { cx: f.x(l[0]), cy: clip(l[1]), r: off ? 2 : 2.6, fill: off ? '#fff' : driverColor(l[6]),
        stroke: driverColor(l[6]), 'stroke-width': off ? 1 : 0 }, f.svg);
    });
    // pit markers along the bottom
    (car.stops || []).forEach(function (s) {
      svgEl('path', { d: 'M' + f.x(s.lap) + ',' + (f.H - f.m.b - 1) + 'l-4,-7h8z', 'class': 'pit-mark' }, f.svg);
    });
    hover(box, f, maxLap, function (lap) {
      var a = lapOf(car, lap), b = cmp && lapOf(cmp, lap);
      var h = '<strong>Lap ' + lap + '</strong>';
      if (a) h += '<br>#' + car.number + ': ' + lapTime(a[1]) + ' · ' + a[6] + ' · P' + a[3] + (a[4] ? ' · pit in' : '') + (a[5] ? ' · yellow' : '');
      if (b) h += '<br>#' + cmp.number + ': ' + lapTime(b[1]) + ' · P' + b[3];
      return h;
    });
  }

  function drawPositionChart(race, car, cmp) {
    var box = q('#rx-pos-chart');
    var cls = race.classes[car.class], n = cls.length;
    var maxLap = race.classInfo[car.class].winnerLaps;
    var f = frame(box, { height: 240, x: [0.5, maxLap + 0.5], y: [n + 0.5, 0.5], left: 44,
      label: 'Class position by lap for ' + car.class + ', car ' + car.number + ' highlighted' });
    axes(f, ticks(1, maxLap, 8), posTicks(n), String, function (v) { return 'P' + v; }, 'Lap', true);
    var order = cls.filter(function (x) { return x !== car.number && x !== (cmp && cmp.number); });
    if (cmp) order.push(cmp.number);
    order.push(car.number);
    order.forEach(function (num) {
      var c = race.cars[num];
      var color = num === car.number ? CAR_COLOR[num] || '#18453B' : (cmp && num === cmp.number) ? COMPARE_COLOR : RIVAL_COLOR;
      svgEl('path', { d: path(c.laps.map(function (l) { return [f.x(l[0]), f.y(l[3])]; })), fill: 'none', stroke: color,
        'stroke-width': num === car.number ? 2.5 : 1.25 }, f.svg);
    });
    hover(box, f, maxLap, function (lap) {
      var rows = cls.map(function (num) { var l = lapOf(race.cars[num], lap); return l ? [l[3], num] : null; })
        .filter(Boolean).sort(function (a, b) { return a[0] - b[0]; });
      return '<strong>Lap ' + lap + '</strong><br>' + rows.slice(0, 8).map(function (r) {
        var s = 'P' + r[0] + ' #' + r[1];
        return r[1] === car.number ? '<b>' + s + '</b>' : s;
      }).join('<br>');
    });
  }

  function hover(box, f, maxLap, html) {
    var guide = svgEl('line', { y1: f.m.t, y2: f.H - f.m.b, 'class': 'guide', visibility: 'hidden' }, f.svg);
    var hit = svgEl('rect', { x: f.m.l, y: f.m.t, width: f.W - f.m.l - f.m.r, height: f.H - f.m.t - f.m.b, fill: 'transparent' }, f.svg);
    function move(clientX, clientY) {
      var r = f.svg.getBoundingClientRect();
      var px = (clientX - r.left) * (f.W / r.width);
      var lap = Math.round(0.5 + (px - f.m.l) / (f.W - f.m.l - f.m.r) * maxLap);
      lap = Math.max(1, Math.min(maxLap, lap));
      guide.setAttribute('x1', f.x(lap)); guide.setAttribute('x2', f.x(lap));
      guide.setAttribute('visibility', 'visible');
      showTip(box, f.x(lap) * r.width / f.W, clientY - r.top, html(lap));
    }
    hit.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
    hit.addEventListener('touchstart', function (e) { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    hit.addEventListener('touchmove', function (e) { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    hit.addEventListener('mouseleave', function () { guide.setAttribute('visibility', 'hidden'); hideTip(); });
  }

  function drawStints(car) {
    var stints = stintsFor(car);
    var bar = q('#rx-stint-bar');
    bar.innerHTML = '';
    stints.forEach(function (s) {
      var seg = el('div', 'rx-stint', null, bar);
      seg.style.flexGrow = s.laps;
      seg.style.background = driverColor(s.driver);
      seg.title = 'Stint ' + s.n + ': ' + s.driver + ', laps ' + s.from + '–' + s.to;
      if (s.laps / car.lapCount > 0.07) el('span', null, s.driver.replace('Driver ', 'D'), seg);
    });
    var tb = q('#rx-stint-table tbody');
    tb.innerHTML = '';
    stints.forEach(function (s) {
      var tr = el('tr', null, null, tb);
      el('th', null, s.n, tr).scope = 'row';
      var td = el('td', null, null, tr);
      var k = el('span', 'rx-key', s.driver, td);
      k.style.setProperty('--key', driverColor(s.driver));
      el('td', 'num', s.from + '–' + s.to, tr);
      el('td', 'num', s.laps, tr);
      el('td', 'num', lapTime(s.median), tr);
      el('td', 'num', lapTime(s.best), tr);
    });
  }

  // ---------------- Pit stop view ----------------
  // Service comes from the team's track sheet Pit Stop Log; driver changes from official timing
  function servicesFor(stop) {
    var list = [];
    if (stop.fuel > 0) list.push(['fuel', stop.fuel + ' gal']);
    if (stop.tires) list.push(['tires']);
    if (stop.swap) list.push(['driver']);
    return list;
  }

  function fuelTotal(stops) {
    var logged = stops.filter(function (s) { return s.fuel != null; });
    if (!logged.length) return '–';
    return Math.round(logged.reduce(function (a, s) { return a + s.fuel; }, 0)) + ' gal';
  }

  function renderPits(race) {
    var car = race.cars[state.car];
    var stops = car.stops || [];
    var LONG = 600; // stops over 10 minutes are treated as repairs
    var normal = stops.filter(function (s) { return s.dur < LONG; });
    var kpis = q('#rx-pit-kpis');
    kpis.innerHTML = '';
    [[stops.length, 'stops'], [duration(car.pitTotal), 'total time in pit'],
     [duration(median(normal.map(function (s) { return s.dur; }))), 'median stop'],
     [stops.filter(function (s) { return s.swap; }).length, 'driver changes'],
     [fuelTotal(stops), 'fuel added']].forEach(function (k) {
      var d = el('div', null, null, kpis);
      el('span', 'stat-num', k[0], d);
      el('span', 'stat-label', k[1], d);
    });

    // Bar chart of each stop
    var box = q('#rx-pit-chart');
    var cap = Math.max(240, Math.min(LONG, Math.max.apply(null, normal.map(function (s) { return s.dur; }).concat([60])) * 1.15));
    var f = frame(box, { height: 250, x: [0.5, Math.max(stops.length, 1) + 0.5], y: [0, cap * 1.12], left: 52,
      label: 'Time in pit lane for each stop by car ' + car.number });
    var yt = [], step = cap > 360 ? 120 : 60;
    for (var t = 0; t <= cap; t += step) yt.push(t);
    axes(f, stops.map(function (s) { return s.n; }), yt, String, function (v) { return Math.floor(v / 60) + ':' + pad(v % 60); }, 'Stop');
    var bw = Math.min(36, (f.W - f.m.l - f.m.r) / Math.max(stops.length, 1) * 0.6);
    stops.forEach(function (s) {
      var long = s.dur > cap;
      var y = f.y(Math.min(s.dur, cap));
      var r = svgEl('rect', { x: f.x(s.n) - bw / 2, y: y, width: bw, height: f.H - f.m.b - y,
        fill: s.swap ? '#18453B' : '#8fb3a5' }, f.svg);
      svgEl('title', {}, r).textContent = 'Stop ' + s.n + ', lap ' + s.lap + ': ' + duration(s.dur) + (s.swap ? ', driver change' : '');
      if (long) {
        svgEl('path', { d: 'M' + (f.x(s.n) - bw / 2 - 2) + ',' + (y + 12) + 'l' + (bw + 4) + ',-6', stroke: '#ffffff', 'stroke-width': 4 }, f.svg);
        svgEl('text', { x: f.x(s.n), y: y - 6, 'text-anchor': 'middle', 'class': 'bar-label' }, f.svg).textContent = duration(s.dur);
      }
    });
    if (!stops.length) svgEl('text', { x: f.W / 2, y: f.H / 2, 'text-anchor': 'middle', 'class': 'chart-note' }, f.svg).textContent = 'No pit stops recorded';

    // Stop table
    var tb = q('#rx-pit-table tbody');
    tb.innerHTML = '';
    stops.forEach(function (s) {
      var tr = el('tr', s.dur >= LONG ? 'is-long' : null, null, tb);
      el('th', null, s.n, tr).scope = 'row';
      el('td', 'num', s.lap, tr);
      el('td', 'num', clock(s.raceTime), tr);
      el('td', 'num', duration(s.dur) + (s.dur >= LONG ? ' (repair)' : ''), tr);
      el('td', null, s.swap ? s.driverIn + ' → ' + s.driverOut : s.driverIn + ' stays in', tr);
      var td = el('td', 'rx-service', null, tr);
      var list = servicesFor(s);
      if (!list.length) el('span', 'muted', s.fuel == null && !s.tires ? 'Not on track sheet' : 'No service', td);
      list.forEach(function (k) { iconOrText('icons/pit-' + k[0] + '.png', SERVICE_LABEL[k[0]], 'rx-service-item', td, k[1]); });
      el('td', 'rx-note', s.note || '', tr);
    });

    // Class comparison: median routine stop for every car in the class
    var cbox = q('#rx-pit-compare');
    var cls = race.classes[car.class].map(function (n) { return race.cars[n]; })
      .filter(function (c) { return c.medianStop != null; })
      .sort(function (a, b) { return a.medianStop - b.medianStop; });
    var top = Math.max.apply(null, cls.map(function (c) { return Math.min(c.medianStop, LONG); }).concat([60]));
    cbox.innerHTML = '';
    cls.forEach(function (c) {
      var row = el('div', 'rx-hbar' + (c.number === car.number ? ' is-team' : '') + (c.team && c.number !== car.number ? ' is-mate' : ''), null, cbox);
      el('span', 'rx-hbar-label', '#' + c.number + ' ' + c.make, row);
      var track = el('span', 'rx-hbar-track', null, row);
      var fill = el('span', 'rx-hbar-fill', null, track);
      fill.style.width = Math.min(c.medianStop / top, 1) * 100 + '%';
      el('span', 'rx-hbar-value', duration(c.medianStop) + ' · ' + c.stopCount + ' stops', row);
    });
    q('#rx-pit-class').textContent = car.class;
  }

  // Re-draw charts when the width changes
  var lastW = root.clientWidth, timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { if (root.clientWidth !== lastW) { lastW = root.clientWidth; render(); } }, 150);
  });

  root.classList.add('is-ready');
  setView('season');
  }
})();
