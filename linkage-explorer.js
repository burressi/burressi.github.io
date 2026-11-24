/* ==========================================================
   Linkage explorer (case study pages)
   Plain JavaScript, no libraries. Runs the offset slider-crank model
   from our ME 470 spreadsheets live in the browser:
   - a clock that turns the crank (play / pause / speed, optional dwell
     at the retracted end so a can can be loaded)
   - a crank-angle slider and preset buttons
   - live readouts
   - a 2D linkage diagram you can drag by the crank pin
   - four charts with a cursor you can click or drag
   Used by case-slider-crank.html (diagram + charts) and by
   case-can-crusher.html, where can-crusher-3d.js also listens to the
   same clock to move the 3D model.

   Geometry: crank pivot at the origin, x to the right, y up, crank
   angle theta measured counter-clockwise from +x. The slider runs on
   the line y = -c (offset c below the pivot), so d is the slider
   position along x.
   ========================================================== */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var NS = 'http://www.w3.org/2000/svg';

  function norm360(a) { a = a % 360; return a < 0 ? a + 360 : a; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function fix(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }

  // ---------- kinematics ----------
  function model(L) {
    var a = L.a, b = L.b, c = L.c || 0;
    var dmax = Math.sqrt((a + b) * (a + b) - c * c);
    var dmin = Math.sqrt((b - a) * (b - a) - c * c);
    var thExt = norm360(Math.atan2(-c, dmax) / DEG);    // ram fully out (top dead center)
    var thFold = norm360(Math.atan2(c, -dmin) / DEG);   // ram fully back (bottom dead center)
    function at(thDeg) {
      var t = thDeg * DEG, s = Math.sin(t), co = Math.cos(t);
      var h = c + a * s;
      var root = Math.sqrt(Math.max(b * b - h * h, 1e-12));
      var d = a * co + root;
      var vr = -a * (s + h * co / root);                 // dd/dtheta, in per rad
      var phi = Math.atan2(-h, d - a * co);              // rod direction, crank pin -> wrist pin
      var mu = 90 - Math.abs(phi / DEG);                 // transmission angle
      var ma = Math.abs(vr) < 1e-9 ? Infinity : (L.gear || 1) * L.rIn / Math.abs(vr);
      return {
        theta: norm360(thDeg), d: d, travel: d - dmin, vr: vr, ddot: vr * L.omega, mu: mu,
        phi: phi / DEG, theta3: norm360(phi / DEG + 180), ma: ma,
        hand: L.load ? L.load / ma : null,
        ax: a * co, ay: a * s, bx: d, by: -c
      };
    }
    return {
      at: at, a: a, b: b, c: c, dmax: dmax, dmin: dmin, stroke: dmax - dmin,
      thExt: thExt, thFold: thFold, outStroke: norm360(thExt - thFold)
    };
  }

  // ---------- readout formats ----------
  var READOUTS = {
    theta: function (k) { return { v: Math.round(k.theta) + '&deg;', s: '' }; },
    d: function (k) { return { v: fix(k.d, 2), s: 'in' }; },
    travel: function (k, M) { return { v: fix(k.travel, 2), s: 'of ' + fix(M.stroke, 2) + ' in' }; },
    ddot: function (k) { return { v: fix(Math.abs(k.ddot), 2), s: 'in/s ' + (Math.abs(k.ddot) < 0.005 ? '' : k.ddot > 0 ? '&rarr; out' : '&larr; back') }; },
    mu: function (k) { return { v: fix(k.mu, 1) + '&deg;', s: '' }; },
    ma: function (k) { return { v: !isFinite(k.ma) || k.ma >= 100 ? '100+' : fix(k.ma, 1), s: ': 1' }; },
    hand: function (k) { return { v: k.hand === null ? '&ndash;' : fix(k.hand, 1), s: 'lbf' }; },
    theta3: function (k) { return { v: fix(k.theta3, 1) + '&deg;', s: '' }; }
  };

  // ---------- charts ----------
  var CHART_KEYS = {
    d: function (k) { return k.d; },
    ddot: function (k) { return k.ddot; },
    mu: function (k) { return k.mu; },
    ma: function (k) { return k.ma; },
    travel: function (k) { return k.travel; }
  };

  function niceTicks(lo, hi, n) {
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log(span / n) / Math.LN10));
    var err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], v = Math.ceil(lo / step - 1e-9) * step;
    for (; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < 1e-12 ? 0 : v);
    return out;
  }

  // ==========================================================
  function create(cfg) {
    var M = model(cfg.linkage);
    var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var listeners = [];
    var period = cfg.period || 4;              // seconds per crank turn at 1x
    var dwell = cfg.dwell || 0;                // seconds paused at the retracted end (0 = none)
    var state = {
      theta: norm360(cfg.start === undefined ? M.thFold : cfg.start),
      playing: cfg.autoplay !== false && !REDUCE,
      speed: 1,
      dwellLeft: 0,
      dwellT: null,
      source: 'init'
    };
    if (dwell && cfg.startInDwell && state.playing) { state.theta = M.thFold; state.dwellLeft = dwell; state.dwellT = 0; }

    var visible = 0, raf = 0, last = 0, ui = { transports: [], readouts: [], schematics: [], charts: [] };
    var contact = cfg.contact || null;         // function(kin, psi) -> bool, shades the charts

    function psiOf(th) { return norm360(th - M.thFold); }   // 0 at the retracted end, out-stroke first

    // ----- clock -----
    function step(dt) {
      if (!state.playing) return false;
      if (state.dwellLeft > 0) {
        state.dwellLeft -= dt * state.speed;
        state.dwellT = clamp(1 - state.dwellLeft / dwell, 0, 1);
        if (state.dwellLeft <= 0) { state.dwellLeft = 0; state.dwellT = null; }
        return true;
      }
      var prevPsi = psiOf(state.theta);
      state.theta = norm360(state.theta + 360 * dt * state.speed / period);
      if (dwell && psiOf(state.theta) < prevPsi) {            // just passed the retracted end
        state.theta = M.thFold; state.dwellLeft = dwell; state.dwellT = 0;
      }
      return true;
    }
    function loop(now) {
      raf = 0;
      var dt = last ? Math.min((now - last) / 1000, 0.25) : 0;
      last = now;
      if (step(dt)) { state.source = 'clock'; emit(); }
      if (state.playing && visible > 0) raf = requestAnimationFrame(loop);
      else last = 0;
    }
    function kick() { if (!raf && state.playing && visible > 0) { last = 0; raf = requestAnimationFrame(loop); } }

    function setPlaying(p) {
      state.playing = !!p;
      if (!p) { state.dwellLeft = 0; state.dwellT = null; }
      updateTransport();
      kick();
      emit();
    }
    function setTheta(th, source) {
      state.theta = norm360(th);
      state.dwellLeft = 0; state.dwellT = null;
      state.source = source || 'user';
      if (state.playing && source !== 'preset-keep') setPlaying(false); else emit();
    }
    function setSpeed(s) { state.speed = s; updateTransport(); }

    function snapshot() {
      var k = M.at(state.theta);
      return { theta: state.theta, psi: psiOf(state.theta), kin: k, model: M, playing: state.playing,
               dwellT: state.dwellT, source: state.source };
    }
    function emit() {
      var s = snapshot();
      updateViews(s);
      for (var i = 0; i < listeners.length; i++) listeners[i](s);
    }

    // ----- visibility: only run the clock while something is on screen -----
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var was = e.target.__mxVis || false;
        if (e.isIntersecting !== was) { e.target.__mxVis = e.isIntersecting; visible += e.isIntersecting ? 1 : -1; }
      });
      kick();
    }, { rootMargin: '120px' }) : null;
    function watch(node) { if (io) io.observe(node); else { visible++; kick(); } }

    // ----- transport -----
    function mountTransport(host, opts) {
      opts = opts || {};
      var presets = (cfg.presets || []).map(function (p, i) {
        return '<button type="button" class="mx-chip" data-preset="' + i + '">' + esc(p.label) + '</button>';
      }).join('');
      host.innerHTML =
        '<div class="mx-transport' + (opts.compact ? ' is-compact' : '') + '">' +
          '<button type="button" class="mx-play" aria-pressed="false"><span class="mx-play-icon" aria-hidden="true"></span><span class="mx-play-text">Play</span></button>' +
          '<label class="mx-angle"><span class="mx-angle-label">' + esc(cfg.angleLabel || 'Crank angle') + '</span>' +
            '<input type="range" min="0" max="359" step="1" value="0" aria-label="' + esc(cfg.angleLabel || 'Crank angle') + ' in degrees" />' +
            '<output class="mx-angle-out">0&deg;</output></label>' +
          (opts.compact ? '' :
            '<div class="mx-speed" role="group" aria-label="Animation speed">' +
              '<button type="button" class="mx-chip" data-speed="0.5" aria-pressed="false">0.5&times;</button>' +
              '<button type="button" class="mx-chip" data-speed="1" aria-pressed="true">1&times;</button>' +
              '<button type="button" class="mx-chip" data-speed="2" aria-pressed="false">2&times;</button>' +
            '</div>') +
          (presets && !opts.compact ? '<div class="mx-presets">' + presets + '</div>' : '') +
        '</div>';
      var t = {
        play: host.querySelector('.mx-play'),
        text: host.querySelector('.mx-play-text'),
        range: host.querySelector('input[type=range]'),
        out: host.querySelector('.mx-angle-out'),
        speeds: host.querySelectorAll('[data-speed]')
      };
      t.play.addEventListener('click', function () { setPlaying(!state.playing); });
      t.range.addEventListener('input', function () { setTheta(+t.range.value, 'slider'); });
      Array.prototype.forEach.call(t.speeds, function (b) {
        b.addEventListener('click', function () { setSpeed(+b.getAttribute('data-speed')); if (!state.playing) setPlaying(true); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-preset]'), function (b) {
        b.addEventListener('click', function () { setTheta(cfg.presets[+b.getAttribute('data-preset')].theta, 'preset'); });
      });
      ui.transports.push(t);
      watch(host);
      updateTransport();
    }
    function updateTransport() {
      ui.transports.forEach(function (t) {
        t.play.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
        t.play.classList.toggle('is-playing', state.playing);
        t.text.textContent = state.playing ? 'Pause' : 'Play';
        Array.prototype.forEach.call(t.speeds, function (b) {
          b.setAttribute('aria-pressed', +b.getAttribute('data-speed') === state.speed ? 'true' : 'false');
        });
      });
    }

    // ----- readouts -----
    function mountReadouts(host) {
      var items = cfg.readouts || [];
      host.innerHTML = '<dl class="mx-readouts">' + items.map(function (r) {
        return '<div><dt>' + esc(r.label) + (r.sym ? ' <span class="mx-sym">' + esc(r.sym) + '</span>' : '') + (r.note ? ' <span class="mx-note">' + esc(r.note) + '</span>' : '') +
          '</dt><dd><strong data-k="' + r.key + '"></strong> <span data-s="' + r.key + '"></span></dd></div>';
      }).join('') + '</dl>';
      ui.readouts.push({ host: host, items: items });
      watch(host);
    }

    // ----- schematic -----
    function mountSchematic(host) {
      var a = M.a, c = M.c, pad = 0.55;
      var x0 = -a - pad, x1 = M.dmax + 0.75 + pad, y0 = Math.min(-a, -c - 0.45) - pad, y1 = a + pad;
      var W = 640, s = W / (x1 - x0), H = Math.round((y1 - y0) * s);
      function X(x) { return (x - x0) * s; }
      function Y(y) { return (y1 - y) * s; }
      var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'mx-schematic-svg', role: 'img',
        'aria-label': 'Linkage diagram: crank a, connecting rod b' + (c ? ', offset c' : '') + ' and slider. Drag the crank pin to turn it.' });
      var g = {};
      // ground: slider rail and its hatching
      var railY = Y(-c) + 0.3 * s;
      el('line', { x1: X(M.dmin - 0.8), y1: railY, x2: X(M.dmax + 1.0), y2: railY, class: 'mx-ground' }, svg);
      for (var hx = M.dmin - 0.7; hx < M.dmax + 1.0; hx += 0.28) {
        el('line', { x1: X(hx), y1: railY, x2: X(hx - 0.18), y2: railY + 0.18 * s, class: 'mx-hatch' }, svg);
      }
      // stroke dimension
      var dimY = railY + 0.42 * s;
      el('line', { x1: X(M.dmin), y1: railY + 0.08 * s, x2: X(M.dmin), y2: dimY + 0.08 * s, class: 'mx-dim' }, svg);
      el('line', { x1: X(M.dmax), y1: railY + 0.08 * s, x2: X(M.dmax), y2: dimY + 0.08 * s, class: 'mx-dim' }, svg);
      el('line', { x1: X(M.dmin), y1: dimY, x2: X(M.dmax), y2: dimY, class: 'mx-dim mx-dim-arrow' }, svg);
      var st = el('text', { x: (X(M.dmin) + X(M.dmax)) / 2, y: dimY - 6, class: 'mx-dim-text', 'text-anchor': 'middle' }, svg);
      st.textContent = 'stroke ' + fix(M.stroke, 2) + ' in';
      // crank circle
      el('circle', { cx: X(0), cy: Y(0), r: a * s, class: 'mx-path' }, svg);
      // offset dimension
      if (c > 0) {
        el('line', { x1: X(0), y1: Y(0), x2: X(0), y2: Y(-c), class: 'mx-offset' }, svg);
        el('line', { x1: X(0) - 6, y1: Y(-c), x2: X(M.dmin - 0.8), y2: Y(-c), class: 'mx-offset' }, svg);
        var ct = el('text', { x: X(0) - 8, y: Y(-c) + 16, class: 'mx-label mx-label-c', 'text-anchor': 'end' }, svg);
        ct.textContent = 'c = ' + fix(c, 2);
      }
      // theta arc + mu arc + normal line
      g.thArc = el('path', { class: 'mx-arc' }, svg);
      g.thTxt = el('text', { class: 'mx-label mx-label-th' }, svg);
      g.thTxt.innerHTML = '&#952;<tspan baseline-shift="sub" font-size="70%">2</tspan>';
      g.normal = el('line', { class: 'mx-normal' }, svg);
      g.ext = el('line', { class: 'mx-normal' }, svg);
      g.muArc = el('path', { class: 'mx-arc mx-arc-mu' }, svg);
      g.muTxt = el('text', { class: 'mx-label mx-label-mu' }, svg);
      g.muTxt.textContent = '\u03bc';
      el('line', { x1: X(0), y1: Y(0), x2: X(a * 1.35), y2: Y(0), class: 'mx-ref' }, svg);
      // links
      g.rod = el('line', { class: 'mx-rod' }, svg);
      g.crank = el('line', { class: 'mx-crank' }, svg);
      g.slider = el('rect', { width: 0.95 * s, height: 0.6 * s, rx: 3, class: 'mx-slider' }, svg);
      g.bTxt = el('text', { class: 'mx-label mx-label-b', 'text-anchor': 'middle' }, svg);
      g.bTxt.textContent = 'b = ' + fix(M.b, 2);
      g.aTxt = el('text', { class: 'mx-label mx-label-a', 'text-anchor': 'middle' }, svg);
      g.aTxt.textContent = 'a = ' + fix(a, 2);
      // pivots
      el('path', { d: 'M' + X(0) + ' ' + Y(0) + ' l-12 20 h24 z', class: 'mx-pivot-base' }, svg);
      el('line', { x1: X(0) - 18, y1: Y(0) + 20, x2: X(0) + 18, y2: Y(0) + 20, class: 'mx-ground' }, svg);
      el('circle', { cx: X(0), cy: Y(0), r: 6, class: 'mx-pin' }, svg);
      var o2 = el('text', { x: X(0) - 12, y: Y(0) - 10, class: 'mx-label', 'text-anchor': 'end' }, svg);
      o2.innerHTML = 'O<tspan baseline-shift="sub" font-size="70%">2</tspan>';
      g.pinB = el('circle', { r: 5, class: 'mx-pin' }, svg);
      g.pinA = el('circle', { r: 7, class: 'mx-pin mx-pin-drag' }, svg);
      g.grab = el('circle', { r: 22, class: 'mx-grab' }, svg);
      host.innerHTML = '';
      host.appendChild(svg);
      var cap = document.createElement('p');
      cap.className = 'mx-caption';
      cap.innerHTML = 'Inches. Drag the orange crank pin to turn the crank.';
      host.appendChild(cap);

      // drag the crank pin
      var dragging = false;
      function angleFromEvent(e) {
        var r = svg.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H;
        return Math.atan2(-(py - Y(0)), px - X(0)) / DEG;
      }
      svg.addEventListener('pointerdown', function (e) {
        var r = svg.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H;
        var dist = Math.sqrt(Math.pow(px - X(0), 2) + Math.pow(py - Y(0), 2));
        if (dist > a * s * 1.8) return;                  // only near the crank circle
        dragging = true; svg.setPointerCapture(e.pointerId); svg.classList.add('is-dragging');
        setTheta(angleFromEvent(e), 'schematic'); e.preventDefault();
      });
      svg.addEventListener('pointermove', function (e) { if (dragging) setTheta(angleFromEvent(e), 'schematic'); });
      function end() { dragging = false; svg.classList.remove('is-dragging'); }
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);

      ui.schematics.push({ g: g, X: X, Y: Y, s: s });
      watch(host);
    }
    function arcPath(cx, cy, r, a0, a1) {     // screen coords, angles in math degrees (ccw), draws ccw from a0 to a1
      var p0x = cx + r * Math.cos(a0 * DEG), p0y = cy - r * Math.sin(a0 * DEG);
      var p1x = cx + r * Math.cos(a1 * DEG), p1y = cy - r * Math.sin(a1 * DEG);
      var sweep = norm360(a1 - a0);
      return 'M' + p0x + ' ' + p0y + ' A' + r + ' ' + r + ' 0 ' + (sweep > 180 ? 1 : 0) + ' 0 ' + p1x + ' ' + p1y;
    }
    function drawSchematic(sc, k) {
      var g = sc.g, X = sc.X, Y = sc.Y, s = sc.s;
      var ax = X(k.ax), ay = Y(k.ay), bx = X(k.bx), by = Y(k.by);
      g.crank.setAttribute('x1', X(0)); g.crank.setAttribute('y1', Y(0)); g.crank.setAttribute('x2', ax); g.crank.setAttribute('y2', ay);
      g.rod.setAttribute('x1', ax); g.rod.setAttribute('y1', ay); g.rod.setAttribute('x2', bx); g.rod.setAttribute('y2', by);
      g.slider.setAttribute('x', bx - 0.475 * s); g.slider.setAttribute('y', by - 0.3 * s);
      g.pinA.setAttribute('cx', ax); g.pinA.setAttribute('cy', ay);
      g.grab.setAttribute('cx', ax); g.grab.setAttribute('cy', ay);
      g.pinB.setAttribute('cx', bx); g.pinB.setAttribute('cy', by);
      // labels at link midpoints, pushed off the line on the open side
      function side(x0, y0, x1, y1, awayX, awayY, gap) {
        var dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / l, ny = dx / l, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        if ((awayX - mx) * nx + (awayY - my) * ny > 0) { nx = -nx; ny = -ny; }
        return [mx + nx * gap, my + ny * gap + 4];
      }
      var pb = side(ax, ay, bx, by, X(0), Y(0), 15);
      g.bTxt.setAttribute('x', pb[0]); g.bTxt.setAttribute('y', pb[1]);
      var pa = side(X(0), Y(0), ax, ay, bx, by, 17);
      g.aTxt.setAttribute('x', pa[0]); g.aTxt.setAttribute('y', pa[1]);
      // theta arc from +x to the crank
      var rTh = M.a * s * 0.42;
      g.thArc.setAttribute('d', arcPath(X(0), Y(0), rTh, 0, k.theta));
      var mid = k.theta / 2;
      g.thTxt.setAttribute('x', X(0) + (rTh + 14) * Math.cos(mid * DEG) - 6);
      g.thTxt.setAttribute('y', Y(0) - (rTh + 14) * Math.sin(mid * DEG) + 5);
      // mu: angle between the rod line and the normal to the slider path, drawn above the slider
      var rodDir = norm360(k.phi + 180);                       // from wrist pin back to crank pin
      var useExt = rodDir > 180;                               // rod comes up from below: use its extension past the pin
      var dir = useExt ? rodDir - 180 : rodDir;
      g.normal.setAttribute('x1', bx); g.normal.setAttribute('y1', by);
      g.normal.setAttribute('x2', bx); g.normal.setAttribute('y2', by - 0.8 * s);
      g.ext.setAttribute('x1', bx); g.ext.setAttribute('y1', by);
      g.ext.setAttribute('x2', bx + (useExt ? 0.8 * s * Math.cos(dir * DEG) : 0));
      g.ext.setAttribute('y2', by - (useExt ? 0.8 * s * Math.sin(dir * DEG) : 0));
      var rMu = 0.55 * s;
      var aStart = Math.min(dir, 90), aEnd = Math.max(dir, 90);
      g.muArc.setAttribute('d', arcPath(bx, by, rMu, aStart, aEnd));
      var mm = (aStart + aEnd) / 2;
      g.muTxt.setAttribute('x', bx + (rMu + 10) * Math.cos(mm * DEG) - 4);
      g.muTxt.setAttribute('y', by - (rMu + 10) * Math.sin(mm * DEG) + 4);
    }

    // ----- charts -----
    function mountCharts(host) {
      var defs = cfg.charts || [];
      host.innerHTML = '<div class="mx-charts">' + defs.map(function (d, i) {
        return '<figure class="mx-chart" data-i="' + i + '"><figcaption><span class="mx-chart-title">' + esc(d.title) +
          '</span> <span class="mx-chart-val" data-i="' + i + '"></span></figcaption></figure>';
      }).join('') + '</div>' +
        (contact && cfg.contactLabel ? '<p class="mx-legend"><span class="mx-key-band"></span>' + esc(cfg.contactLabel) + '</p>' : '');
      var samples = [];
      for (var t = 0; t <= 360; t += 1) samples.push(M.at(t));
      // contact band ranges
      var bands = [];
      if (contact) {
        var on = null;
        for (var j = 0; j <= 360; j++) {
          var hit = contact(samples[j], psiOf(j));
          if (hit && on === null) on = j;
          if ((!hit || j === 360) && on !== null) { bands.push([on, hit ? 360 : j]); on = null; }
        }
      }
      var charts = [];
      defs.forEach(function (d, i) {
        var fig = host.querySelector('.mx-chart[data-i="' + i + '"]');
        var get = CHART_KEYS[d.key];
        var vals = samples.map(get);
        var finite = vals.filter(function (v) { return isFinite(v); });
        var lo = d.min !== undefined ? d.min : Math.min.apply(null, finite);
        var hi = d.max !== undefined ? d.max : Math.max.apply(null, finite);
        if (d.min === undefined || d.max === undefined) { var padv = (hi - lo) * 0.08 || 1; if (d.min === undefined) lo -= padv; if (d.max === undefined) hi += padv; }
        var W = 360, H = 200, ml = 44, mr = 16, mt = 10, mb = 30;
        var pw = W - ml - mr, ph = H - mt - mb;
        function cx(t) { return ml + t / 360 * pw; }
        function cy(v) { return mt + (1 - (clamp(v, lo, hi) - lo) / (hi - lo)) * ph; }
        var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': d.title + ' against crank angle, 0 to 360 degrees' });
        bands.forEach(function (bd) {
          el('rect', { x: cx(bd[0]), y: mt, width: cx(bd[1]) - cx(bd[0]), height: ph, class: 'mx-band' }, svg);
        });
        var ticks = niceTicks(lo, hi, 4);
        var ax = el('g', { class: 'axis' }, svg);
        ticks.forEach(function (tv) {
          el('line', { x1: ml, x2: W - mr, y1: cy(tv), y2: cy(tv), class: 'grid' }, ax);
          var tx = el('text', { x: ml - 6, y: cy(tv) + 4, 'text-anchor': 'end' }, ax);
          tx.textContent = d.tickFmt ? d.tickFmt(tv) : String(Math.round(tv * 100) / 100);
        });
        [0, 90, 180, 270, 360].forEach(function (tv) {
          el('line', { x1: cx(tv), x2: cx(tv), y1: mt, y2: mt + ph, class: 'grid' }, ax);
          var tx = el('text', { x: cx(tv), y: H - 12, 'text-anchor': 'middle' }, ax);
          tx.textContent = tv + '\u00b0';
        });
        if (lo < 0 && hi > 0) el('line', { x1: ml, x2: W - mr, y1: cy(0), y2: cy(0), class: 'mx-zero' }, svg);
        if (d.guide !== undefined) {
          el('line', { x1: ml, x2: W - mr, y1: cy(d.guide), y2: cy(d.guide), class: 'mx-guide' }, svg);
          var gt = el('text', { x: W - mr - 4, y: cy(d.guide) - 5, 'text-anchor': 'end', class: 'mx-guide-text' }, svg);
          gt.textContent = d.guideLabel || '';
        }
        // curve: clipped to the plot, with a gap where it runs off the top or bottom
        // (mechanical advantage goes to infinity at the dead centers)
        function out(v) { return !isFinite(v) || v > hi || v < lo; }
        var dstr = '', pen = false;
        for (var t2 = 0; t2 <= 360; t2++) {
          var v = vals[t2];
          if (out(v)) {
            if (pen) dstr += 'L' + cx(t2).toFixed(1) + ' ' + cy(isFinite(v) ? v : hi).toFixed(1);
            pen = false;
            continue;
          }
          if (!pen) {
            dstr += 'M';
            if (t2 > 0 && out(vals[t2 - 1])) {
              var pv = vals[t2 - 1];
              dstr += cx(t2 - 1).toFixed(1) + ' ' + cy(isFinite(pv) ? pv : hi).toFixed(1) + 'L';
            }
          } else dstr += 'L';
          dstr += cx(t2).toFixed(1) + ' ' + cy(v).toFixed(1);
          pen = true;
        }
        el('path', { d: dstr, class: 'mx-curve' }, svg);
        var cursor = el('line', { y1: mt, y2: mt + ph, class: 'mx-cursor' }, svg);
        var dot = el('circle', { r: 4.5, class: 'mx-dot' }, svg);
        var hit = el('rect', { x: ml, y: mt, width: pw, height: ph, class: 'mx-hit' }, svg);
        fig.appendChild(svg);
        // click / drag to set the angle
        var drag = false;
        function th(e) { var r = svg.getBoundingClientRect(); return clamp(((e.clientX - r.left) / r.width * W - ml) / pw * 360, 0, 359.9); }
        hit.addEventListener('pointerdown', function (e) { drag = true; hit.setPointerCapture(e.pointerId); setTheta(th(e), 'chart'); e.preventDefault(); });
        hit.addEventListener('pointermove', function (e) { if (drag) setTheta(th(e), 'chart'); });
        hit.addEventListener('pointerup', function () { drag = false; });
        hit.addEventListener('pointercancel', function () { drag = false; });
        charts.push({ d: d, get: get, cx: cx, cy: cy, lo: lo, hi: hi, cursor: cursor, dot: dot,
          val: host.querySelector('.mx-chart-val[data-i="' + i + '"]') });
      });
      ui.charts.push(charts);
      watch(host);
    }

    function updateViews(s) {
      var k = s.kin;
      ui.transports.forEach(function (t) {
        var v = Math.round(k.theta) % 360;
        if (+t.range.value !== v) t.range.value = v;
        t.range.setAttribute('aria-valuetext', v + ' degrees');
        t.out.innerHTML = v + '&deg;';
      });
      ui.readouts.forEach(function (r) {
        r.items.forEach(function (it) {
          var f = (READOUTS[it.key] || READOUTS.theta)(k, M);
          var sv = r.host.querySelector('[data-k="' + it.key + '"]'), ss = r.host.querySelector('[data-s="' + it.key + '"]');
          if (sv) sv.innerHTML = f.v;
          if (ss) ss.innerHTML = it.unit !== undefined ? it.unit : f.s;
        });
      });
      ui.schematics.forEach(function (sc) { drawSchematic(sc, k); });
      ui.charts.forEach(function (charts) {
        charts.forEach(function (c) {
          var v = c.get(k), x = c.cx(k.theta);
          c.cursor.setAttribute('x1', x); c.cursor.setAttribute('x2', x);
          c.dot.setAttribute('cx', x); c.dot.setAttribute('cy', c.cy(isFinite(v) ? v : c.hi));
          c.dot.style.opacity = (!isFinite(v) || v > c.hi || v < c.lo) ? 0 : 1;
          if (c.val) c.val.innerHTML = c.d.fmt ? c.d.fmt(v) : fix(v, 2);
        });
      });
    }

    var mounts = cfg.mounts || {};
    [].concat(mounts.transport || []).forEach(function (h, i) { if (h) mountTransport(h, { compact: i > 0 }); });
    [].concat(mounts.readouts || []).forEach(function (h) { if (h) mountReadouts(h); });
    [].concat(mounts.schematic || []).forEach(function (h) { if (h) mountSchematic(h); });
    [].concat(mounts.charts || []).forEach(function (h) { if (h) mountCharts(h); });
    emit();

    return {
      model: M,
      onFrame: function (fn) { listeners.push(fn); fn(snapshot()); },
      setTheta: setTheta,
      setPlaying: setPlaying,
      snapshot: snapshot,
      watch: watch
    };
  }

  // Pages can also set one up declaratively: <div data-linkage="NAME"></div>,
  // where window.NAME holds the settings (see slider-crank-data.js).
  function autoInit() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-linkage]'), function (host) {
      var cfg = window[host.getAttribute('data-linkage')];
      if (!cfg || host.__mx) return;
      host.__mx = true;
      host.innerHTML = '<div class="mx-schematic"></div><div class="mx-transport-host"></div>' +
        '<div class="mx-readouts-host"></div><div class="mx-charts-host"></div>';
      var c = {};
      for (var k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) c[k] = cfg[k];
      c.mounts = {
        schematic: host.querySelector('.mx-schematic'),
        transport: host.querySelector('.mx-transport-host'),
        readouts: host.querySelector('.mx-readouts-host'),
        charts: host.querySelector('.mx-charts-host')
      };
      host.linkageExplorer = create(c);
    });
  }
  document.addEventListener('DOMContentLoaded', autoInit);
  window.addEventListener('load', autoInit);

  window.LinkageExplorer = { create: create, model: model };
})();
