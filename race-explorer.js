/*
  2026 Season Data Explorer (race strategy case study)

  Layer 1  Season: one card per race. Pick a card to open that race.
  Layer 2  Race: headline results, then three tabs (Lap times, Class position,
           Pit stops). Each tab has its own filters, and clicking a lap, stint
           or pit stop fills the details panel under the chart.

  Charts are plain SVG; no libraries. Race files load only when opened.
  Lap rows: [lap, time, elapsed, class position, pit in, flag, driver, s1, s2, s3]
  (driver and sectors are present for our two cars only).
*/
(function () {
  'use strict';

  // ---------- Data store (the data files call RaceData.add / .season) ----------
  var store = { races: {}, season: [], waiting: {} };
  window.RaceData = {
    add: function (race) {
      store.races[race.id] = race;
      (store.waiting[race.id] || []).forEach(function (fn) { fn(race); });
      delete store.waiting[race.id];
    },
    season: function (rows) {
      store.season = rows.slice().sort(function (a, b) { return a.round - b.round; });
    }
  };

  var DATA_DIR = '2026%20Race%20Data/';
  var CAR_COLOR = { '177': '#18453B', '178': '#b8732e' };
  var DRIVER_COLOR = ['#18453B', '#b8732e', '#4a6f8f', '#7a5c99', '#7d7a2e', '#a0485a'];
  var COMPARE_COLOR = '#4a6f8f';
  var RIVAL_COLOR = '#d6d0c4';
  var REPAIR_S = 600; // stops of 10 minutes or more are repairs
  var FLAGS = ['Green flag', 'Code 60', 'Red flag'];
  var SERVICE = { fuel: 'Fuel', tires: 'Tires', driver: 'Driver change' };
  var METRIC_COL = { t: 1, s1: 7, s2: 8, s3: 9 };

  function loadRace(id, done) {
    if (store.races[id]) { done(store.races[id]); return; }
    if (store.waiting[id]) { store.waiting[id].push(done); return; }
    store.waiting[id] = [done];
    var s = document.createElement('script');
    s.src = DATA_DIR + id + '.js?v=3';
    s.onerror = function () { delete store.waiting[id]; };
    document.head.appendChild(s);
  }

  // ---------- Formatting ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function lapTime(s) {
    if (s == null) return '–';
    var m = Math.floor(s / 60), r = (s - m * 60).toFixed(3);
    if (r.length < 6) r = '0' + r;
    return m ? m + ':' + r : (+r).toFixed(3);
  }
  function axisTime(s) {
    var m = Math.floor(s / 60), r = (s - m * 60).toFixed(1);
    if (r.length < 4) r = '0' + r;
    return m ? m + ':' + r : (+r).toFixed(1);
  }
  function duration(s) {
    if (s == null) return '–';
    if (s < 60) return s.toFixed(1) + ' s';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (h) return h + ':' + pad(m) + ':' + pad(Math.floor(r));
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }
  function signed(d) {
    if (d == null || isNaN(d)) return '–';
    var a = Math.abs(d);
    return (d < 0 ? '−' : '+') + (a < 60 ? a.toFixed(3) + ' s' : duration(a));
  }
  function clock(s) { return Math.floor(s / 3600) + ':' + pad(Math.floor((s % 3600) / 60)); }
  function median(a) {
    if (!a.length) return null;
    var b = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
  function minOf(a) { return Math.min.apply(null, a); }
  function maxOf(a) { return Math.max.apply(null, a); }
  function driverColor(name) {
    var i = parseInt(String(name).replace(/\D/g, ''), 10) - 1;
    return DRIVER_COLOR[(i >= 0 ? i : 0) % DRIVER_COLOR.length];
  }
  function raceName(r) { return r.event + ' ' + r.label; }

  // ---------- Race preparation (done once per race) ----------
  function isClean(car, l) {
    var prev = car.byLap[l[0] - 1];
    return l[0] > 1 && l[1] != null && !l[4] && !l[5] && !(prev && prev[4]);
  }
  function stintsFor(car) {
    var ends = {};
    (car.stops || []).forEach(function (s) { ends[s.lap] = s; });
    var groups = [], cur = [];
    car.laps.forEach(function (l) {
      cur.push(l);
      if (ends[l[0]]) { groups.push(cur); cur = []; }
    });
    if (cur.length) groups.push(cur);
    return groups.map(function (laps, i) {
      var count = {};
      laps.forEach(function (l) { count[l[6]] = (count[l[6]] || 0) + 1; });
      var driver = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
      var clean = laps.filter(function (l) { return isClean(car, l); });
      var med = median(clean.map(function (l) { return l[1]; }));
      clean = clean.filter(function (l) { return l[1] <= med * 1.07; });
      var times = clean.map(function (l) { return l[1]; });
      // Fall-off: straight-line fit of clean lap time against lap number
      var slope = null;
      if (clean.length >= 6) {
        var n = clean.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
        clean.forEach(function (l) { sx += l[0]; sy += l[1]; sxx += l[0] * l[0]; sxy += l[0] * l[1]; });
        var den = n * sxx - sx * sx;
        if (den) slope = (n * sxy - sx * sy) / den;
      }
      var last = laps[laps.length - 1];
      return {
        n: i + 1, from: laps[0][0], to: last[0], laps: laps.length, driver: driver,
        median: median(times), best: times.length ? minOf(times) : null, slope: slope,
        posStart: laps[0][3], posEnd: last[3], endStop: ends[last[0]] || null
      };
    });
  }
  function prep(race) {
    if (race.ready) return;
    race.leader = {};
    Object.keys(race.classes).forEach(function (cls) {
      var lead = {};
      race.classes[cls].forEach(function (n) {
        race.cars[n].laps.forEach(function (l) {
          if (lead[l[0]] == null || l[2] < lead[l[0]]) lead[l[0]] = l[2];
        });
      });
      race.leader[cls] = lead;
    });
    Object.keys(race.cars).forEach(function (n) {
      var c = race.cars[n];
      c.byLap = {};
      c.laps.forEach(function (l) { c.byLap[l[0]] = l; });
      if (c.team) c.stints = stintsFor(c);
    });
    Object.keys(race.classes).forEach(function (cls) {
      var meds = race.classes[cls].map(function (n) {
        var c = race.cars[n];
        return c.medianStop != null && c.medianStop < REPAIR_S ? c.medianStop : null;
      }).filter(function (v) { return v != null; });
      race.classInfo[cls].typicalStop = median(meds);
    });
    race.ready = true;
  }
  function gapToLeader(race, car, l) { return l[2] - race.leader[car.class][l[0]]; }

  // ---------- DOM and SVG helpers ----------
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
  function button(parent, cls, text, onClick) {
    var b = el('button', cls, text, parent);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function dot(parent, color) { var d = el('span', 'rx-dot', null, parent); d.style.background = color; return d; }
  function chip(parent, label, pressed, onClick, color) {
    var b = button(parent, 'rx-chip', null, onClick);
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    if (color) dot(b, color);
    el('span', null, label, b);
    return b;
  }
  function group(parent, label) {
    var g = el('div', 'rx-group', null, parent);
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    el('span', 'rx-group-label', label, g);
    return g;
  }
  function selectBox(parent, label, options, value, onChange) {
    var w = el('label', 'rx-field', null, parent);
    el('span', null, label, w);
    var s = el('select', null, null, w);
    options.forEach(function (o) { var op = el('option', null, o[1], s); op.value = o[0]; });
    s.value = value;
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }
  // An image that shows a text label until the image file exists
  function iconOrText(src, label, cls, parent, extra) {
    var wrap = el('span', cls, null, parent);
    var img = el('img', null, null, wrap);
    img.alt = label;
    img.src = src;
    var x = extra ? el('span', 'icon-extra', extra, wrap) : null;
    img.addEventListener('error', function () {
      wrap.removeChild(img);
      if (x) wrap.removeChild(x);
      el('span', 'icon-text', label + (extra ? ' ' + extra : ''), wrap);
    });
    return wrap;
  }
  function scale(d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0); }; }
  function niceStep(span, count) {
    var raw = span / count || 1, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }
  function ticks(a, b, count, whole) {
    var s = niceStep(b - a, count), out = [];
    if (whole) s = Math.max(1, Math.round(s));
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
  function frame(box, o) {
    box.innerHTML = '';
    var W = Math.max(box.clientWidth, 280), H = o.height;
    var m = { t: 12, r: 14, b: 36, l: o.left || 58 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': o.label });
    box.appendChild(svg);
    return { svg: svg, W: W, H: H, m: m, x: scale(o.x[0], o.x[1], m.l, W - m.r), y: scale(o.y[0], o.y[1], H - m.b, m.t),
      xInv: function (px) { return o.x[0] + (px - m.l) / (W - m.r - m.l) * (o.x[1] - o.x[0]); } };
  }
  function axes(f, xT, yT, xFmt, yFmt, xTitle, noGrid) {
    var g = svgEl('g', { 'class': 'axis' }, f.svg);
    yT.forEach(function (v) {
      var y = f.y(v);
      if (!noGrid) svgEl('line', { x1: f.m.l, x2: f.W - f.m.r, y1: y, y2: y, 'class': 'grid' }, g);
      svgEl('text', { x: f.m.l - 8, y: y + 4, 'text-anchor': 'end' }, g).textContent = yFmt(v);
    });
    xT.forEach(function (v) {
      svgEl('text', { x: f.x(v), y: f.H - f.m.b + 18, 'text-anchor': 'middle' }, g).textContent = xFmt(v);
    });
    if (xTitle) svgEl('text', { x: f.W - f.m.r, y: f.H - 4, 'text-anchor': 'end', 'class': 'axis-title' }, g).textContent = xTitle;
  }
  function bands(f, car, x0, x1) {
    car.laps.forEach(function (l) {
      if (!l[5] || l[0] < x0 || l[0] > x1) return;
      svgEl('rect', { x: f.x(l[0] - 0.5), y: f.m.t, width: Math.max(f.x(1) - f.x(0), 1),
        height: f.H - f.m.b - f.m.t, 'class': l[5] === 2 ? 'band-red' : 'band-yellow' }, f.svg);
    });
  }

  var tip;
  function showTip(box, x, y, html) {
    if (!tip) { tip = el('div', 'chart-tip'); tip.setAttribute('aria-hidden', 'true'); }
    if (tip.parentNode !== box) box.appendChild(tip);
    tip.innerHTML = html;
    tip.hidden = false;
    var left = Math.min(x + 14, box.clientWidth - tip.offsetWidth - 4);
    tip.style.left = Math.max(left, 4) + 'px';
    tip.style.top = Math.max(y - 10, 0) + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  // Invisible layer over the plot area: hover shows a tooltip, click picks a lap or bar
  function interact(f, box, pick, tipHtml, onPick) {
    var hit = svgEl('rect', { x: f.m.l, y: f.m.t, width: f.W - f.m.l - f.m.r, height: f.H - f.m.t - f.m.b,
      fill: 'transparent', 'class': 'hit' }, f.svg);
    function at(e) {
      var r = f.svg.getBoundingClientRect();
      return { v: pick(f.xInv((e.clientX - r.left) * (f.W / r.width))), x: (e.clientX - r.left), y: e.clientY - r.top };
    }
    hit.addEventListener('mousemove', function (e) {
      var p = at(e);
      if (p.v == null) { hideTip(); return; }
      showTip(box, p.x, p.y, tipHtml(p.v));
    });
    hit.addEventListener('mouseleave', hideTip);
    hit.addEventListener('click', function (e) { var p = at(e); if (p.v != null) { hideTip(); onPick(p.v); } });
  }
  function nearest(list, v) {
    var best = null, d = Infinity;
    list.forEach(function (x) { var dd = Math.abs(x - v); if (dd < d) { d = dd; best = x; } });
    return best;
  }

  // =====================================================================
  function init() {
    var root = document.getElementById('race-explorer');
    if (!root || !store.season.length) return;
    function $(id) { return document.getElementById(id); }

    var V = { season: $('rx-season'), race: $('rx-race') };
    var TOOL = $('rx-toolbar'), CHART = $('rx-chart'), STRIP = $('rx-strip'), DETAIL = $('rx-detail'), EXTRA = $('rx-extra');
    var TABS = { laps: $('rx-tab-laps'), position: $('rx-tab-position'), pits: $('rx-tab-pits') };
    var TAB_ORDER = ['laps', 'position', 'pits'];

    var S = {
      seasonCar: 'all', race: null, car: null, tab: 'laps', compare: undefined, zoom: null, sel: null,
      hidden: {}, green: false, yellow: true, pits: true, metric: 't',
      posMetric: 'pos', rivals: true, svc: 'all', hideRepairs: false
    };

    function seasonRow(id) {
      for (var i = 0; i < store.season.length; i++) if (store.season[i].id === id) return store.season[i];
    }
    function cur() { var race = store.races[S.race]; return { race: race, car: race.cars[S.car] }; }

    // ---------------- Season ----------------
    function renderSeason() {
      V.season.hidden = false;
      V.race.hidden = true;
      var laps = 0, stops = 0, wins = 0, miles = 0, tracks = {};
      store.season.forEach(function (r) {
        tracks[r.track] = 1;
        r.entries.forEach(function (e) { laps += e.laps; miles += e.miles; stops += e.stops; if (e.finish === 1) wins++; });
      });
      var k = $('rx-season-kpis');
      k.innerHTML = '';
      [[store.season.length, 'races'], [Object.keys(tracks).length, 'tracks'], [Math.round(miles).toLocaleString('en-US'), 'race miles'],
       [stops, 'pit stops'], [wins, 'class wins']].forEach(function (x) {
        var d = el('div', null, null, k);
        el('strong', null, x[0], d);
        el('span', null, x[1], d);
      });

      var f = $('rx-season-filter');
      f.innerHTML = '';
      var g = group(f, 'Show');
      [['all', 'Both cars'], ['177', '#177'], ['178', '#178']].forEach(function (o) {
        chip(g, o[1], S.seasonCar === o[0], function () { S.seasonCar = o[0]; renderSeason(); }, CAR_COLOR[o[0]]);
      });

      var list = $('rx-cards');
      list.innerHTML = '';
      store.season.forEach(function (r) {
        var shown = r.entries.filter(function (e) { return S.seasonCar === 'all' || e.number === S.seasonCar; });
        var li = el('li', null, null, list);
        var b = button(li, 'rx-card' + (shown.length ? '' : ' is-dim'), null, function () {
          openRace(r.id, (shown[0] || r.entries[0]).number, true);
        });
        el('span', 'rx-card-round', 'Round ' + r.round, b);
        el('strong', 'rx-card-event', r.event, b);
        el('span', 'rx-card-meta', r.label + ' · ' + r.durationHrs + ' h', b);
        var res = el('span', 'rx-card-results', null, b);
        if (!shown.length) el('span', 'rx-card-none', '#' + S.seasonCar + ' did not race', res);
        shown.forEach(function (e) {
          var row = el('span', 'rx-card-row' + (e.finish === 1 ? ' is-win' : ''), null, res);
          dot(row, CAR_COLOR[e.number]);
          el('span', 'rx-card-car', '#' + e.number + ' ' + e.class, row);
          el('strong', null, 'P' + e.finish, row);
          el('span', 'rx-card-of', 'of ' + e.starters, row);
        });
        b.setAttribute('aria-label', 'Round ' + r.round + ', ' + raceName(r) + ': ' + r.entries.map(function (e) {
          return 'car ' + e.number + ' finished P' + e.finish + ' of ' + e.starters + ' in ' + e.class;
        }).join(', ') + '. Open race.');
      });
    }

    // ---------------- Race ----------------
    function openRace(id, car, scroll) {
      S.race = id; S.car = car; S.compare = undefined; S.zoom = null; S.sel = null; S.hidden = {};
      if (scroll) S.tab = 'laps';
      V.season.hidden = true;
      V.race.hidden = false;
      V.race.setAttribute('aria-busy', 'true');
      loadRace(id, function (race) {
        if (race.id !== S.race) return;
        V.race.removeAttribute('aria-busy');
        prep(race);
        if (!race.cars[S.car] || !race.cars[S.car].team) S.car = seasonRow(id).entries[0].number;
        renderRace();
        if (scroll) { root.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('rx-race-title').focus(); }
      });
    }

    function renderRace() {
      var c = cur(), race = c.race, car = c.car, row = seasonRow(S.race), info = race.classInfo[car.class];
      var i = store.season.indexOf(row);
      $('rx-race-title').textContent = raceName(row);
      $('rx-race-meta').textContent = row.track + ' · Round ' + row.round + ' of ' + store.season.length + ' · ' + row.durationHrs + ' hours';
      var prev = store.season[i - 1], next = store.season[i + 1];
      var pb = $('rx-prev'), nb = $('rx-next');
      pb.disabled = !prev; nb.disabled = !next;
      pb.textContent = prev ? '← ' + raceName(prev) : '';
      nb.textContent = next ? raceName(next) + ' →' : '';
      pb.hidden = !prev; nb.hidden = !next;

      // Car picker
      var cars = $('rx-cars');
      cars.innerHTML = '';
      row.entries.forEach(function (e) {
        var b = button(cars, 'rx-car', null, function () {
          if (S.car === e.number) return;
          S.car = e.number; S.compare = undefined; S.zoom = null; S.sel = null; S.hidden = {};
          renderRace();
        });
        b.setAttribute('aria-pressed', e.number === S.car ? 'true' : 'false');
        iconOrText('pictures/car-' + e.number + '.png', '#' + e.number, 'rx-car-img', b);
        var t = el('span', 'rx-car-label', null, b);
        el('strong', null, '#' + e.number, t);
        el('span', null, e.class + ' · P' + e.finish + ' of ' + e.starters, t);
      });

      if (S.compare === undefined) {
        var cls = race.classes[car.class];
        S.compare = cls[0] !== car.number ? cls[0] : (cls[1] || '');
      }

      // Headline numbers
      var h = $('rx-headline');
      h.innerHTML = '';
      var fuel = car.stops.filter(function (s) { return s.fuel != null; });
      [['P' + car.finish, 'class finish', 'of ' + info.starters + ' in ' + car.class],
       [Math.round(car.lapCount * race.miles).toLocaleString('en-US') + ' mi', 'distance', car.lapCount + ' laps' + (car.lapCount < info.winnerLaps ? ', ' + (info.winnerLaps - car.lapCount) + ' behind the class winner' : ', full distance')],
       [lapTime(car.best), 'best lap', car.gapPct ? '+' + car.gapPct.toFixed(2) + '% to class best' : 'class best'],
       [car.stopCount, 'pit stops', duration(car.pitTotal) + ' in pit lane'],
       [fuel.length ? Math.round(fuel.reduce(function (a, s) { return a + s.fuel; }, 0)) + ' gal' : '–', 'fuel added',
        fuel.length ? 'from the team track sheet' : 'not logged for this race'],
       [car.stats.passesAll, car.stats.passesAll === 1 ? 'pass made' : 'passes made', 'on track, for position · ' + car.stats.lapsLed + ' lap' + (car.stats.lapsLed === 1 ? '' : 's') + ' led in class']
      ].forEach(function (x) {
        var d = el('div', null, null, h);
        el('strong', null, x[0], d);
        el('span', 'rx-head-label', x[1], d);
        el('span', 'rx-head-sub', x[2], d);
      });
      $('rx-story').textContent = story(race, car);
      setTab(S.tab);
    }

    function story(race, car) {
      var info = race.classInfo[car.class];
      var start = car.laps[0][3], led = car.laps.filter(function (l) { return l[3] === 1; }).length;
      var t = '#' + car.number + ' ran P' + start + ' in ' + car.class + ' after lap 1 and finished P' + car.finish + ' of ' + info.starters + '.';
      if (led) t += ' Led the class for ' + led + ' lap' + (led === 1 ? '' : 's') + '.';
      var repairs = car.stops.filter(function (s) { return s.dur >= REPAIR_S; });
      if (repairs.length) {
        t += ' ' + repairs.length + ' long stop' + (repairs.length === 1 ? '' : 's') + ' for repairs cost ' +
          duration(repairs.reduce(function (a, s) { return a + s.dur; }, 0)) + ' in the pits.';
      }
      return t;
    }

    function setTab(tab) {
      S.tab = tab;
      TAB_ORDER.forEach(function (k) {
        var on = k === tab;
        TABS[k].setAttribute('aria-selected', on ? 'true' : 'false');
        TABS[k].classList.toggle('is-active', on);
        TABS[k].tabIndex = on ? 0 : -1;
      });
      $('rx-panel').setAttribute('aria-labelledby', TABS[tab].id);
      renderTab();
    }

    function renderTab() {
      hideTip();
      TOOL.innerHTML = ''; STRIP.innerHTML = ''; EXTRA.innerHTML = '';
      var c = cur();
      if (S.tab === 'laps') lapsTab(c.race, c.car);
      else if (S.tab === 'position') positionTab(c.race, c.car);
      else pitsTab(c.race, c.car);
      renderDetail(c.race, c.car);
    }
    function toggle(key) { return function () { S[key] = !S[key]; renderTab(); }; }

    function compareSelect(parent, race, car) {
      var opts = race.classes[car.class].filter(function (n) { return n !== car.number; }).map(function (n) {
        var c = race.cars[n];
        return [n, '#' + n + ' ' + c.make + (c.team ? ' (team)' : '') + ' · P' + c.finish];
      });
      opts.push(['', 'No comparison']);
      selectBox(parent, 'Compare with', opts, S.compare, function (v) { S.compare = v; renderTab(); });
    }
    function zoomNote(parent) {
      if (!S.zoom) return;
      var p = el('p', 'rx-zoom', 'Showing laps ' + S.zoom[0] + '–' + S.zoom[1] + '. ', parent);
      button(p, 'rx-link', 'Show whole race', function () {
        S.zoom = null;
        if (S.sel && S.sel.type === 'stint') S.sel = null;
        renderTab();
      });
    }
    function xRange(maxLap) { return S.zoom ? [S.zoom[0], Math.min(S.zoom[1], maxLap)] : [1, maxLap]; }

    // ---------------- Tab: Lap times ----------------
    function lapsTab(race, car) {
      var g1 = group(TOOL, 'Drivers');
      car.drivers.forEach(function (d) {
        chip(g1, d, !S.hidden[d], function () {
          S.hidden[d] = !S.hidden[d];
          if (car.drivers.every(function (x) { return S.hidden[x]; })) S.hidden[d] = false;
          renderTab();
        }, driverColor(d));
      });
      var g2 = group(TOOL, 'Show');
      chip(g2, 'Green-flag laps only', S.green, toggle('green'));
      chip(g2, 'Code 60 periods', S.yellow, toggle('yellow'));
      chip(g2, 'Pit stops', S.pits, toggle('pits'));
      var g3 = el('div', 'rx-selects', null, TOOL);
      var hasSectors = car.laps.some(function (l) { return l[7] != null; });
      if (!hasSectors) S.metric = 't';
      if (hasSectors) {
        selectBox(g3, 'Measure', [['t', 'Lap time'], ['s1', 'Sector 1'], ['s2', 'Sector 2'], ['s3', 'Sector 3']], S.metric,
          function (v) { S.metric = v; renderTab(); });
      }
      compareSelect(g3, race, car);
      zoomNote(TOOL);
      drawLaps(race, car);
      stintStrip(car);
    }

    function lapVisible(car, l, x0, x1, col) {
      return l[0] >= x0 && l[0] <= x1 && l[col] != null && !S.hidden[l[6]] && (!S.green || isClean(car, l));
    }

    function drawLaps(race, car) {
      var col = METRIC_COL[S.metric];
      var cmp = S.compare && col === 1 ? race.cars[S.compare] : null;
      var r = xRange(Math.max(car.lapCount, cmp ? cmp.lapCount : 0)), x0 = r[0], x1 = r[1];
      var pts = car.laps.filter(function (l) { return lapVisible(car, l, x0, x1, col); });
      if (!pts.length) { CHART.innerHTML = ''; el('p', 'rx-empty', 'No laps match these filters.', CHART); return; }
      var vals = pts.map(function (l) { return l[col]; });
      var cmpLaps = cmp ? cmp.laps.filter(function (l) {
        return l[0] >= x0 && l[0] <= x1 && l[1] != null && (!S.green || isClean(cmp, l));
      }) : [];
      var best = minOf(vals.concat(cmpLaps.map(function (l) { return l[1]; })));
      var hi = Math.min(maxOf(vals), Math.max(best * (col === 1 ? 1.1 : 1.2), median(vals) * 1.03));
      if (hi <= best) hi = best * 1.02;
      var lo = best - (hi - best) * 0.08;
      var f = frame(CHART, { height: 300, x: [x0 - 0.5, x1 + 0.5], y: [lo, hi],
        label: (col === 1 ? 'Lap times' : 'Sector ' + (col - 6) + ' times') + ' for car ' + car.number + ', laps ' + x0 + ' to ' + x1 });
      if (S.yellow) bands(f, car, x0, x1);
      axes(f, ticks(x0, x1, 8, true), ticks(lo, hi, 5), String, axisTime, 'Lap');
      var clip = function (v) { return f.y(Math.min(v, hi)); };
      if (cmp) {
        var prevN = null;
        svgEl('path', { d: path(cmpLaps.map(function (l) {
          var p = prevN != null && l[0] - prevN > 1 ? null : [f.x(l[0]), clip(l[1])];
          prevN = l[0];
          return p;
        })), 'class': 'line-compare' }, f.svg);
      }
      var pp = null;
      var line = [];
      pts.forEach(function (l) { if (pp != null && l[0] - pp > 1) line.push(null); line.push([f.x(l[0]), clip(l[col])]); pp = l[0]; });
      svgEl('path', { d: path(line), 'class': 'line-car' }, f.svg);
      pts.forEach(function (l) {
        var off = l[col] > hi;
        svgEl('circle', { cx: f.x(l[0]), cy: clip(l[col]), r: off ? 2.2 : 3, 'class': off ? 'pt-off' : 'pt',
          fill: off ? '#fff' : driverColor(l[6]), stroke: driverColor(l[6]) }, f.svg);
      });
      if (S.pits) {
        car.stops.forEach(function (s) {
          if (s.lap < x0 || s.lap > x1) return;
          svgEl('path', { d: 'M' + f.x(s.lap) + ',' + (f.H - f.m.b - 1) + 'l-4.5,-8h9z', 'class': 'pit-mark' }, f.svg);
        });
      }
      var selLap = S.sel && S.sel.type === 'lap' ? car.byLap[S.sel.n] : null;
      if (selLap && selLap[0] >= x0 && selLap[0] <= x1) {
        svgEl('line', { x1: f.x(selLap[0]), x2: f.x(selLap[0]), y1: f.m.t, y2: f.H - f.m.b, 'class': 'guide' }, f.svg);
        if (selLap[col] != null) svgEl('circle', { cx: f.x(selLap[0]), cy: clip(selLap[col]), r: 7, 'class': 'pt-sel' }, f.svg);
      }
      var lapNums = pts.map(function (l) { return l[0]; });
      interact(f, CHART, function (v) { return nearest(lapNums, v); }, function (n) {
        var a = car.byLap[n], b = cmp && cmp.byLap[n];
        var t = '<strong>Lap ' + n + '</strong><br>#' + car.number + ' ' + lapTime(a[col]) + ' · ' + a[6];
        if (b) t += '<br>#' + cmp.number + ' ' + lapTime(b[1]);
        return t + '<br><em>Click for details</em>';
      }, function (n) { S.sel = { type: 'lap', n: n }; renderTab(); });
    }

    function stintStrip(car) {
      var head = el('div', 'rx-strip-head', null, STRIP);
      el('h4', null, 'Stints', head);
      el('span', null, 'Select a stint to zoom in on it', head);
      var bar = el('div', 'rx-stints', null, STRIP);
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Stints');
      car.stints.forEach(function (s) {
        var on = S.sel && S.sel.type === 'stint' && S.sel.n === s.n;
        var b = button(bar, 'rx-stint' + (on ? ' is-active' : ''), null, function () {
          S.zoom = [s.from, s.to];
          S.sel = { type: 'stint', n: s.n };
          renderTab();
        });
        b.style.flexGrow = s.laps;
        b.style.background = driverColor(s.driver);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', 'Stint ' + s.n + ', ' + s.driver + ', laps ' + s.from + ' to ' + s.to);
        b.title = 'Stint ' + s.n + ': ' + s.driver + ', laps ' + s.from + '–' + s.to;
        if (s.laps / car.lapCount > 0.06) el('span', null, s.driver.replace('Driver ', 'D'), b);
      });
    }

    // ---------------- Tab: Class position ----------------
    function positionTab(race, car) {
      var g3 = el('div', 'rx-selects', null, TOOL);
      selectBox(g3, 'Measure', [['pos', 'Class position'], ['gap', 'Gap to class leader']], S.posMetric,
        function (v) { S.posMetric = v; renderTab(); });
      compareSelect(g3, race, car);
      var g2 = group(TOOL, 'Show');
      chip(g2, 'Other class cars', S.rivals, toggle('rivals'));
      chip(g2, 'Code 60 periods', S.yellow, toggle('yellow'));
      zoomNote(TOOL);

      var cls = race.classes[car.class], n = cls.length, info = race.classInfo[car.class];
      var r = xRange(info.winnerLaps), x0 = r[0], x1 = r[1];
      var cmp = S.compare ? race.cars[S.compare] : null;
      var gapMode = S.posMetric === 'gap';
      var inRange = function (c) { return c.laps.filter(function (l) { return l[0] >= x0 && l[0] <= x1; }); };
      var f, val;
      if (gapMode) {
        var mx = 1;
        [car, cmp].forEach(function (c) { if (c) inRange(c).forEach(function (l) { mx = Math.max(mx, gapToLeader(race, c, l)); }); });
        mx *= 1.08;
        f = frame(CHART, { height: 280, x: [x0 - 0.5, x1 + 0.5], y: [mx, 0], left: 62,
          label: 'Gap to the ' + car.class + ' class leader by lap for car ' + car.number });
        if (S.yellow) bands(f, car, x0, x1);
        axes(f, ticks(x0, x1, 8, true), ticks(0, mx, 4), String, function (v) { return v ? duration(v) : 'Leader'; }, 'Lap');
        val = function (c, l) { return f.y(Math.min(gapToLeader(race, c, l), mx)); };
      } else {
        f = frame(CHART, { height: 260, x: [x0 - 0.5, x1 + 0.5], y: [n + 0.5, 0.5], left: 44,
          label: 'Class position by lap for car ' + car.number + ' in ' + car.class });
        if (S.yellow) bands(f, car, x0, x1);
        axes(f, ticks(x0, x1, 8, true), posTicks(n), String, function (v) { return 'P' + v; }, 'Lap', true);
        val = function (c, l) { return f.y(l[3]); };
      }
      var order = cls.filter(function (x) { return x !== car.number && (!cmp || x !== cmp.number); });
      if (!S.rivals) order = [];
      if (cmp) order.push(cmp.number);
      order.push(car.number);
      order.forEach(function (num) {
        var c = race.cars[num];
        var cl = num === car.number ? 'line-focus' : (cmp && num === cmp.number) ? 'line-compare-solid' : 'line-rival';
        var p = svgEl('path', { d: path(inRange(c).map(function (l) { return [f.x(l[0]), val(c, l)]; })), 'class': cl }, f.svg);
        if (num === car.number) p.setAttribute('stroke', CAR_COLOR[num] || '#18453B');
      });
      var selLap = S.sel && S.sel.type === 'lap' ? S.sel.n : null;
      if (selLap && selLap >= x0 && selLap <= x1) {
        svgEl('line', { x1: f.x(selLap), x2: f.x(selLap), y1: f.m.t, y2: f.H - f.m.b, 'class': 'guide' }, f.svg);
        var sl = car.byLap[selLap];
        if (sl) svgEl('circle', { cx: f.x(selLap), cy: val(car, sl), r: 6, 'class': 'pt-sel' }, f.svg);
      }
      interact(f, CHART, function (v) { var k = Math.round(v); return k >= x0 && k <= x1 ? k : null; }, function (k) {
        var l = car.byLap[k];
        var t = '<strong>Lap ' + k + '</strong>';
        if (l) t += '<br>#' + car.number + ' P' + l[3] + (gapMode ? ' · ' + (l[3] === 1 ? 'leader' : '+' + duration(gapToLeader(race, car, l))) : '');
        var b = cmp && cmp.byLap[k];
        if (b) t += '<br>#' + cmp.number + ' P' + b[3];
        return t + '<br><em>Click for class order</em>';
      }, function (k) { S.sel = { type: 'lap', n: k }; renderTab(); });

      var lg = el('div', 'rx-legend', null, STRIP);
      var k1 = el('span', 'rx-key', '#' + car.number, lg); k1.style.setProperty('--key', CAR_COLOR[car.number]);
      if (cmp) { var k2 = el('span', 'rx-key', '#' + cmp.number + ' (comparison)', lg); k2.style.setProperty('--key', COMPARE_COLOR); }
      if (S.rivals) { var k3 = el('span', 'rx-key', 'Other ' + car.class + ' cars', lg); k3.style.setProperty('--key', RIVAL_COLOR); }
      if (S.yellow) el('span', 'rx-key rx-key-band', 'Code 60', lg);
    }

    // ---------------- Tab: Pit stops ----------------
    function stopMatches(s) {
      if (S.svc === 'all') return true;
      if (S.svc === 'fuel') return s.fuel > 0;
      if (S.svc === 'tires') return !!s.tires;
      if (S.svc === 'driver') return !!s.swap;
      if (S.svc === 'notes') return !!s.note;
      if (S.svc === 'c60') return s.cond > 0;
      return true;
    }
    function shownStops(car) {
      return car.stops.filter(function (s) { return !(S.hideRepairs && s.dur >= REPAIR_S); });
    }
    function services(s) {
      var list = [];
      if (s.fuel > 0) list.push(['fuel', s.fuel + ' gal']);
      if (s.tires) list.push(['tires']);
      if (s.swap) list.push(['driver']);
      return list;
    }


    var COND = ['Green', 'Code 60', 'Red flag'];
    function stopImage(car, s) {
      var k = s.fuel > 0 && s.tires ? 'fuel and tires' : s.fuel > 0 ? 'fuel' : s.tires ? 'tires' : 'regular';
      return encodeURI('pictures/pit/' + car.number + ' ' + k + '.png');
    }
    function stopAlt(car, s) {
      var w = [];
      if (s.fuel > 0) w.push('fuel');
      if (s.tires) w.push('tires');
      return 'Car ' + car.number + (w.length ? ', ' + w.join(' and ') + ' highlighted' : ', no fuel or tires');
    }
    function fuelText(s) { return s.fuel > 0 ? s.fuel + ' gal' : s.fuel === 0 ? 'None' : 'Not logged'; }
    function tireText(s) { return s.tires ? 'Changed' : s.logged === false ? 'Not logged' : 'Not changed'; }
    function gauge(parent, s, tank) {
      var g = el('span', 'rx-gauge', null, parent);
      var f = el('span', 'rx-gauge-fill', null, g);
      f.style.width = (s.fuel > 0 && tank ? Math.min(100, s.fuel / tank * 100) : 0) + '%';
      g.title = s.fuel > 0 && tank ? Math.round(s.fuel / tank * 100) + '% of a ' + tank + ' gal tank' : '';
      return g;
    }
    function condPill(parent, s) {
      return el('span', 'rx-cond rx-cond-' + (s.cond || 0), COND[s.cond || 0], parent);
    }
    function selectStop(n) { S.sel = { type: 'stop', n: n }; renderTab(); }

    function pitBoard(race, car, stops) {
      var list = stops.filter(stopMatches);
      var head = el('div', 'rx-strip-head', null, STRIP);
      el('h4', null, 'Pit board', head);
      el('span', null, list.length + ' of ' + car.stops.length + ' stops · select a card for the full breakdown', head);
      if (!list.length) { el('p', 'rx-empty', 'No stops match this filter.', STRIP); return; }
      var board = el('ol', 'rx-pitboard', null, STRIP);
      board.setAttribute('aria-label', 'Pit stops for car ' + car.number);
      list.forEach(function (s) {
        var on = S.sel && S.sel.type === 'stop' && S.sel.n === s.n;
        var li = el('li', null, null, board);
        var b = button(li, 'rx-pitcard' + (on ? ' is-sel' : '') + (s.dur >= REPAIR_S ? ' is-repair' : ''), null, function () { selectStop(s.n); });
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        var top = el('span', 'rx-pc-top', null, b);
        el('span', 'rx-pc-n', 'Stop ' + s.n, top);
        el('span', 'rx-pc-lap', 'Lap ' + s.lap, top);
        condPill(top, s);
        var img = el('img', 'rx-pc-img', null, b);
        img.src = stopImage(car, s); img.alt = stopAlt(car, s); img.loading = 'lazy'; img.width = 480; img.height = 162;
        img.addEventListener('error', function () { img.remove(); });
        var t = el('span', 'rx-pc-time', null, b);
        el('strong', null, duration(s.dur), t);
        el('span', null, s.dur >= REPAIR_S ? 'in pit lane · repair' : 'in pit lane', t);
        var facts = el('span', 'rx-pc-facts', null, b);
        var f1 = el('span', 'rx-pc-fact rx-pc-fuel' + (s.fuel > 0 ? ' is-on' : ''), null, facts);
        el('span', 'rx-pc-k', 'Fuel', f1); el('span', 'rx-pc-v', fuelText(s), f1); gauge(f1, s, car.tank);
        var f2 = el('span', 'rx-pc-fact rx-pc-tires' + (s.tires ? ' is-on' : ''), null, facts);
        el('span', 'rx-pc-k', 'Tires', f2); el('span', 'rx-pc-v', tireText(s), f2);
        var f3 = el('span', 'rx-pc-fact rx-pc-driver' + (s.swap ? ' is-on' : ''), null, facts);
        el('span', 'rx-pc-k', 'Driver in', f3);
        el('span', 'rx-pc-v', s.driverOut, f3);
        el('span', 'rx-pc-sub', s.swap ? 'Swap from ' + s.driverIn : 'No swap', f3);
        var f4 = el('span', 'rx-pc-fact', null, facts);
        el('span', 'rx-pc-k', 'Class pos.', f4);
        el('span', 'rx-pc-v', 'P' + s.posBefore + ' → P' + s.posAfter, f4);
        if (s.note) el('span', 'rx-pc-note', s.note, b);
        b.setAttribute('aria-label', 'Stop ' + s.n + ', lap ' + s.lap + ', ' + duration(s.dur) + ' in pit lane, fuel ' + fuelText(s) +
          ', tires ' + tireText(s) + ', ' + (s.swap ? s.driverIn + ' handed over to ' + s.driverOut : s.driverOut + ' stayed in') +
          ', ' + COND[s.cond || 0] + '.');
      });
    }

    function pitsTab(race, car) {
      var g1 = group(TOOL, 'Show');
      [['all', 'All stops'], ['fuel', 'Fuel'], ['tires', 'Tires'], ['driver', 'Driver swap'], ['c60', 'Under Code 60'], ['notes', 'Issues & notes']].forEach(function (o) {
        chip(g1, o[1], S.svc === o[0], function () { S.svc = o[0]; renderTab(); });
      });
      var g2 = group(TOOL, 'Filter');
      chip(g2, 'Hide repair stops (10 min+)', S.hideRepairs, toggle('hideRepairs'));

      var stops = shownStops(car);
      if (!stops.length) { CHART.innerHTML = ''; el('p', 'rx-empty', 'No pit stops to show.', CHART); }
      else drawPitBars(race, car, stops);

      // Pit board: one card per stop
      pitBoard(race, car, stops);

      // Pit summary
      var routine = car.stops.filter(function (x) { return x.dur < REPAIR_S; });
      var sum = el('div', 'rx-pitsum', null, EXTRA);
      [[car.stops.filter(function (x) { return x.fuel > 0; }).length, 'fuel stops'],
       [car.stops.filter(function (x) { return x.swap; }).length, 'driver swaps'],
       [car.stops.filter(function (x) { return x.tires; }).length, 'tire changes (only when needed)'],
       [car.stops.filter(function (x) { return x.cond > 0; }).length, 'stops under Code 60'],
       [routine.length ? duration(median(routine.map(function (x) { return x.dur; }))) : '–', 'typical routine stop']
      ].forEach(function (x) { var d = el('div', null, null, sum); el('strong', null, x[0], d); el('span', null, x[1], d); });

      // Class comparison
      var info = race.classInfo[car.class];
      el('h4', null, 'Typical stop across ' + car.class, EXTRA);
      el('p', 'rx-hint', 'Median time in pit lane per car, leaving out repair stops.', EXTRA);
      var bars = el('div', 'rx-hbars', null, EXTRA);
      var rows = race.classes[car.class].map(function (n) { return race.cars[n]; })
        .filter(function (c) { return c.medianStop != null && c.medianStop < REPAIR_S; })
        .sort(function (a, b) { return a.medianStop - b.medianStop; });
      var top = maxOf(rows.map(function (c) { return c.medianStop; }).concat([60]));
      rows.forEach(function (c) {
        var row = el('div', 'rx-hbar' + (c.number === car.number ? ' is-team' : c.team ? ' is-mate' : ''), null, bars);
        el('span', 'rx-hbar-label', '#' + c.number + ' ' + c.make, row);
        var track = el('span', 'rx-hbar-track', null, row);
        el('span', 'rx-hbar-fill', null, track).style.width = (c.medianStop / top * 100) + '%';
        el('span', 'rx-hbar-value', duration(c.medianStop), row);
      });
      if (info.typicalStop) el('p', 'rx-hint', 'Class typical stop: ' + duration(info.typicalStop) + '.', EXTRA);
    }

    function drawPitBars(race, car, stops) {
      var routine = stops.filter(function (s) { return s.dur < REPAIR_S; }).map(function (s) { return s.dur; });
      var cap = Math.max(180, Math.min(REPAIR_S, (routine.length ? maxOf(routine) : 120) * 1.15));
      var f = frame(CHART, { height: 260, x: [0.5, stops.length + 0.5], y: [0, cap * 1.12], left: 52,
        label: 'Time in pit lane for each stop by car ' + car.number });
      var step = cap > 360 ? 120 : 60, yt = [];
      for (var t = 0; t <= cap; t += step) yt.push(t);
      axes(f, stops.map(function (s, i) { return i + 1; }), yt, function (i) { return stops[i - 1].n; },
        function (v) { return Math.floor(v / 60) + ':' + pad(v % 60); }, 'Stop');
      var bw = Math.min(34, (f.W - f.m.l - f.m.r) / stops.length * 0.62);
      stops.forEach(function (s, i) {
        var y = f.y(Math.min(s.dur, cap));
        var on = S.sel && S.sel.type === 'stop' && S.sel.n === s.n;
        var cl = 'bar' + (s.swap ? ' bar-swap' : '') + (stopMatches(s) ? '' : ' is-dim') + (on ? ' is-sel' : '');
        svgEl('rect', { x: f.x(i + 1) - bw / 2, y: y, width: bw, height: f.H - f.m.b - y, 'class': cl }, f.svg);
        if (s.dur > cap) {
          svgEl('path', { d: 'M' + (f.x(i + 1) - bw / 2 - 2) + ',' + (y + 12) + 'l' + (bw + 4) + ',-6', 'class': 'bar-break' }, f.svg);
          svgEl('text', { x: f.x(i + 1), y: y - 5, 'text-anchor': 'middle', 'class': 'bar-label' }, f.svg).textContent = duration(s.dur);
        }
      });
      interact(f, CHART, function (v) { var k = Math.round(v); return k >= 1 && k <= stops.length ? k : null; }, function (k) {
        var s = stops[k - 1];
        return '<strong>Stop ' + s.n + '</strong> · lap ' + s.lap + ' · ' + COND[s.cond || 0] + '<br>' + duration(s.dur) +
          (services(s).length ? '<br>' + services(s).map(function (x) { return SERVICE[x[0]] + (x[1] ? ' ' + x[1] : ''); }).join(', ') : '') +
          '<br><em>Click for details</em>';
      }, function (k) { S.sel = { type: 'stop', n: stops[k - 1].n }; renderTab(); });
      var lg = el('div', 'rx-legend', null, CHART);
      el('span', 'rx-key rx-key-swap', 'Driver change', lg);
      el('span', 'rx-key rx-key-noswap', 'Same driver', lg);
    }

    // ---------------- Details panel ----------------
    function detail(title, rows, nav) {
      DETAIL.innerHTML = '';
      DETAIL.classList.toggle('is-empty', false);
      el('h4', null, title, DETAIL);
      var dl = el('dl', 'rx-facts', null, DETAIL);
      rows.forEach(function (r) {
        if (!r) return;
        var d = el('div', null, null, dl);
        el('dt', null, r[0], d);
        var dd = el('dd', null, null, d);
        if (typeof r[1] === 'function') r[1](dd); else dd.textContent = r[1];
      });
      if (nav) {
        var n = el('div', 'rx-detail-nav', null, DETAIL);
        nav.forEach(function (b) {
          if (!b) return;
          var btn = button(n, 'rx-link', b[0], b[1] || null);
          btn.disabled = !b[1];
        });
      }
    }
    function hint(text) {
      DETAIL.innerHTML = '';
      DETAIL.classList.toggle('is-empty', true);
      el('p', null, text, DETAIL);
    }

    function renderDetail(race, car) {
      var sel = S.sel;
      if (!sel) {
        hint(S.tab === 'pits' ? 'Select a bar or a pit board card to see the car, fuel, tires, driver, track condition and positions for that stop.'
          : S.tab === 'position' ? 'Select any lap on the chart to see the full class order and gaps at that point.'
          : 'Select a lap on the chart, or a stint below it, to see the details. Use the arrow keys to step through laps.');
        return;
      }
      if (sel.type === 'stop') return stopDetail(race, car, sel.n);
      if (sel.type === 'stint') return stintDetail(car, sel.n);
      if (S.tab === 'position') return orderDetail(race, car, sel.n);
      return lapDetail(race, car, sel.n);
    }

    function stepLap(car, n, d) {
      var laps = car.laps.map(function (l) { return l[0]; });
      var i = laps.indexOf(n) + d;
      return laps[i];
    }
    function selectLap(n) { S.sel = { type: 'lap', n: n }; renderTab(); }

    function lapDetail(race, car, n) {
      var l = car.byLap[n];
      if (!l) { hint('#' + car.number + ' did not complete lap ' + n + '.'); return; }
      var prev = car.byLap[n - 1];
      var st = car.stints.filter(function (s) { return n >= s.from && n <= s.to; })[0];
      var stopHere = car.stops.filter(function (s) { return s.lap === n; })[0];
      var pitInfo = stopHere ? 'In-lap for stop ' + stopHere.n : (prev && prev[4]) ? 'Out-lap (includes time in pit lane)' : null;
      var posTxt = 'P' + l[3];
      if (prev && prev[3] !== l[3]) posTxt += prev[3] > l[3] ? ' (gained ' + (prev[3] - l[3]) + ')' : ' (lost ' + (l[3] - prev[3]) + ')';
      var bestS = [7, 8, 9].map(function (k) { return minOf(car.laps.map(function (x) { return x[k]; }).filter(function (v) { return v != null; })); });
      var p = stepLap(car, n, -1), q = stepLap(car, n, 1);
      detail('Lap ' + n + ' · ' + l[6], [
        ['Lap time', lapTime(l[1])],
        ['Change from lap before', prev ? signed(l[1] - prev[1]) : '–'],
        ['Against stint typical', st && st.median && isClean(car, l) ? signed(l[1] - st.median) : '–'],
        ['Class position', posTxt],
        ['Gap to class leader', l[3] === 1 ? 'Leading' : duration(gapToLeader(race, car, l))],
        l[7] != null ? ['Sectors', function (dd) {
          [7, 8, 9].forEach(function (k, i) {
            var s = el('span', 'rx-sector' + (l[k] === bestS[i] ? ' is-best' : ''), 'S' + (i + 1) + ' ' + lapTime(l[k]), dd);
            if (l[k] === bestS[i]) s.title = 'Best of the race for this car';
          });
        }] : null,
        ['Track', FLAGS[l[5]]],
        pitInfo ? ['Pit lane', pitInfo] : null,
        st ? ['Stint', 'Stint ' + st.n + ' (laps ' + st.from + '–' + st.to + ')'] : null
      ], [p ? ['← Lap ' + p, function () { selectLap(p); }] : ['← Previous lap'],
          q ? ['Lap ' + q + ' →', function () { selectLap(q); }] : ['Next lap →']]);
    }

    function stintDetail(car, n) {
      var s = car.stints[n - 1];
      if (!s) { hint('Stint not found.'); return; }
      var fall = s.slope == null ? 'Not enough clean laps'
        : (s.slope >= 0 ? '+' : '−') + Math.abs(s.slope * 10).toFixed(2) + ' s per 10 laps';
      var end = s.endStop ? 'Stop ' + s.endStop.n + ' on lap ' + s.endStop.lap + ' (' + duration(s.endStop.dur) + ')' +
        (s.endStop.fuel > 0 ? ', ' + s.endStop.fuel + ' gal' : '') : 'Chequered flag';
      var go = function (k) { var t = car.stints[k - 1]; S.zoom = [t.from, t.to]; S.sel = { type: 'stint', n: k }; renderTab(); };
      detail('Stint ' + n + ' · ' + s.driver, [
        ['Laps', s.from + '–' + s.to + ' (' + s.laps + ' laps)'],
        ['Typical green lap', lapTime(s.median)],
        ['Best green lap', lapTime(s.best)],
        ['Lap time trend', fall],
        ['Class position', 'P' + s.posStart + ' → P' + s.posEnd],
        ['Ended with', end]
      ], [n > 1 ? ['← Stint ' + (n - 1), function () { go(n - 1); }] : ['← Previous stint'],
          n < car.stints.length ? ['Stint ' + (n + 1) + ' →', function () { go(n + 1); }] : ['Next stint →']]);
    }

    function orderDetail(race, car, n) {
      var rows = race.classes[car.class].map(function (num) {
        var c = race.cars[num], l = c.byLap[n];
        return l ? { c: c, l: l } : null;
      }).filter(Boolean).sort(function (a, b) { return a.l[3] - b.l[3]; });
      var max = race.classInfo[car.class].winnerLaps;
      detail('Lap ' + n + ' · ' + car.class + ' class order', [
        ['Running', function (dd) {
          var ol = el('ol', 'rx-order', null, dd);
          rows.forEach(function (r) {
            var li = el('li', r.c.number === car.number ? 'is-team' : r.c.team ? 'is-mate' : null, null, ol);
            el('span', 'rx-order-pos', 'P' + r.l[3], li);
            el('span', 'rx-order-car', '#' + r.c.number + ' ' + r.c.make, li);
            el('span', 'rx-order-gap', r.l[3] === 1 ? 'Leader' : '+' + duration(gapToLeader(race, r.c, r.l)), li);
          });
          if (!rows.length) el('p', null, 'No cars completed this lap.', dd);
        }],
        ['Cars that completed this lap', rows.length + ' of ' + race.classes[car.class].length]
      ], [n > 1 ? ['← Lap ' + (n - 1), function () { selectLap(n - 1); }] : ['← Previous lap'],
          n < max ? ['Lap ' + (n + 1) + ' →', function () { selectLap(n + 1); }] : ['Next lap →']]);
    }

    function stopDetail(race, car, n) {
      var list = shownStops(car), s = car.stops.filter(function (x) { return x.n === n; })[0];
      if (!s) { hint('Stop not found.'); return; }
      var i = list.indexOf(s);
      var typical = race.classInfo[car.class].typicalStop;
      var go = function (x) { selectStop(x.n); };
      DETAIL.innerHTML = '';
      DETAIL.classList.toggle('is-empty', false);
      var card = el('div', 'rx-stopdetail', null, DETAIL);
      var side = el('div', 'rx-sd-visual', null, card);
      var img = el('img', null, null, side);
      img.src = stopImage(car, s); img.alt = stopAlt(car, s); img.width = 480; img.height = 162;
      img.addEventListener('error', function () { img.remove(); });
      var big = el('div', 'rx-sd-time', null, side);
      el('strong', null, duration(s.dur), big);
      el('span', null, 'in pit lane' + (s.dur >= REPAIR_S ? ' (repair)' : ''), big);
      var tags = el('div', 'rx-sd-tags', null, side);
      condPill(tags, s);
      if (s.fuel > 0) el('span', 'rx-tag rx-tag-fuel', 'Fuel', tags);
      if (s.tires) el('span', 'rx-tag rx-tag-tires', 'Tires', tags);
      if (s.swap) el('span', 'rx-tag rx-tag-driver', 'Driver swap', tags);
      if (s.dur >= REPAIR_S) el('span', 'rx-tag rx-tag-repair', 'Repair', tags);

      var body = el('div', 'rx-sd-body', null, card);
      el('h4', null, 'Stop ' + s.n + ' · lap ' + s.lap + ' · #' + car.number, body);
      var dl = el('dl', 'rx-facts', null, body);
      function row(k, v, extra) {
        var d = el('div', null, null, dl);
        el('dt', null, k, d);
        var dd = el('dd', null, v, d);
        if (extra) extra(dd);
      }
      if (s.dur < REPAIR_S && typical) {
        var dv = s.dur - typical;
        row('Against class typical', Math.abs(dv) < 0.05 ? 'Same as the class typical stop'
          : duration(Math.abs(dv)) + (dv < 0 ? ' quicker' : ' slower') + ' than the ' + car.class + ' typical stop (' + duration(typical) + ')');
      }
      row('Fuel added', fuelText(s) + (s.fuel > 0 && car.tank ? ' of a ' + car.tank + ' gal tank' : ''), function (dd) { if (s.fuel > 0) gauge(dd, s, car.tank); });
      if (s.fuel > 0 && s.burnLaps) {
        var rate = s.fuel / s.burnLaps;
        if (rate > 0.2 && rate < 1.5) row('Fuel use', '≈ ' + rate.toFixed(2) + ' gal per lap over the ' + s.burnLaps + ' laps since the last fuel');
      }
      row('Tires', tireText(s) + (s.tireSet ? ' · set ' + s.tireSet + ' after the stop' : ''));
      row('Driver in', s.driverOut + (s.swap ? ' (swap: ' + s.driverIn + ' got out)' : ' (no swap, stayed in)'));
      row('Track during pit cycle', s.cond === 1 ? 'Code 60 (full-course slow zone)' : s.cond === 2 ? 'Red flag' : 'Green flag');
      row('Class position', 'P' + s.posBefore + ' before → P' + s.posAfter + ' after' +
        (s.posAfter > s.posBefore ? ' (lost ' + (s.posAfter - s.posBefore) + ')' : s.posAfter < s.posBefore ? ' (gained ' + (s.posBefore - s.posAfter) + ')' : ' (held)'));
      row('Stint before', s.stint + ' lap' + (s.stint === 1 ? '' : 's') + ' since ' + (s.n > 1 ? 'the last stop' : 'the start'));
      row('When', clock(s.raceTime) + ' into the race' + (s.clock ? ' · ' + s.clock.slice(0, 5) + ' local' : ''));
      if (s.issue) row('Issue', s.issue);
      if (s.remark) row('Team notes', s.remark);
      if (!s.logged) row('Track sheet', 'No matching entry in the team pit log');
      var nav = el('div', 'rx-detail-nav', null, body);
      var pb = button(nav, 'rx-link', i > 0 ? '← Stop ' + list[i - 1].n : '← Previous stop', i > 0 ? function () { go(list[i - 1]); } : null);
      pb.disabled = !(i > 0);
      var nb = button(nav, 'rx-link', i >= 0 && i < list.length - 1 ? 'Stop ' + list[i + 1].n + ' →' : 'Next stop →',
        i >= 0 && i < list.length - 1 ? function () { go(list[i + 1]); } : null);
      nb.disabled = !(i >= 0 && i < list.length - 1);
    }

    // ---------------- Wiring ----------------
    $('rx-back').addEventListener('click', function () { S.race = null; renderSeason(); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('rx-prev').addEventListener('click', function () { var i = store.season.indexOf(seasonRow(S.race)); if (i > 0) openRace(store.season[i - 1].id, S.car, false); });
    $('rx-next').addEventListener('click', function () { var i = store.season.indexOf(seasonRow(S.race)); if (i < store.season.length - 1) openRace(store.season[i + 1].id, S.car, false); });

    TAB_ORDER.forEach(function (k, i) {
      TABS[k].addEventListener('click', function () { if (S.sel && S.sel.type !== 'lap') S.sel = null; setTab(k); });
      TABS[k].addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var nk = TAB_ORDER[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
        S.sel = null; setTab(nk); TABS[nk].focus();
      });
    });

    // Arrow keys on the chart step through laps or stops
    CHART.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var d = e.key === 'ArrowRight' ? 1 : -1, c = cur(), car = c.car;
      if (S.tab === 'pits') {
        var list = shownStops(car);
        if (!list.length) return;
        var at = S.sel && S.sel.type === 'stop' ? list.map(function (s) { return s.n; }).indexOf(S.sel.n) : -1;
        var ni = at < 0 ? 0 : Math.max(0, Math.min(list.length - 1, at + d));
        S.sel = { type: 'stop', n: list[ni].n };
      } else {
        var max = S.tab === 'position' ? c.race.classInfo[car.class].winnerLaps : car.lapCount;
        var r = xRange(max);
        var n = S.sel && S.sel.type === 'lap' ? S.sel.n + d : (d > 0 ? r[0] : r[1]);
        S.sel = { type: 'lap', n: Math.max(r[0], Math.min(r[1], n)) };
      }
      renderTab();
    });

    var lastW = root.clientWidth, timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (root.clientWidth === lastW) return;
        lastW = root.clientWidth;
        if (S.race && store.races[S.race]) renderTab();
      }, 150);
    });

    root.classList.add('is-ready');
    renderSeason();
  }

  // Wait until the deferred data file (season.js) has run as well
  document.addEventListener('DOMContentLoaded', init);
})();
