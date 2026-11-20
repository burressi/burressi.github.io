/* ==========================================================
   E-beam dose profile explorer (case study page)
   Plain JavaScript, no libraries. Shows the PUFFIn+ (PENELOPE) dose
   maps from my thesis runs as a flat cutaway: a slice through the soil
   layer that you slide along (or across) the belt, plus the
   centre-of-layer depth-dose curve and the numbers behind it.
   Settings and run data live in ebeam-dose-data.js; each run's voxels
   are a small binary file in models/dose/ (uint16 dose as a share of
   the run's peak voxel, then uint8 3-sigma uncertainty in percent,
   x fastest, depth slowest).
   ========================================================== */
(function () {
  'use strict';

  var D = window.EBEAM_DOSE;
  var root = document.getElementById('dose-explorer');
  if (!D || !root) return;

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PEN = 0.1;            // a layer counts as fully treated when its least-dosed depth gets >= 10% of the peak
  var SVGNS = 'http://www.w3.org/2000/svg';

  var byKey = {};
  D.runs.forEach(function (r) { byKey[r.E + '_' + r.t] = r; prep(r); });
  function run(E, t) { return byKey[E + '_' + t]; }

  // ---------- per-run numbers (all from the centre-window depth profile) ----------
  function prep(r) {
    var p = r.prof, mx = -1, mn = Infinity, sum = 0, ipk = 0;
    for (var i = 0; i < p.length; i++) {
      if (p[i] > mx) { mx = p[i]; ipk = i; }
      if (p[i] < mn) mn = p[i];
      sum += p[i];
    }
    r.pmax = mx; r.pmin = mn; r.ipk = ipk; r.mean = sum / p.length;
    r.bin = r.t / p.length;
    r.pen = mn / mx >= PEN;
    r.reach = r.t;                         // depth where the dose falls below 10% of the peak
    for (var j = ipk + 1; j < p.length; j++) {
      if (p[j] < PEN * mx) {
        var f = (p[j - 1] - PEN * mx) / (p[j - 1] - p[j]);
        r.reach = r.depth[j - 1] + f * (r.depth[j] - r.depth[j - 1]);
        break;
      }
    }
    r.extent = r.pen ? r.t : Math.min(r.t, Math.max(r.reach * 1.3, 2 * r.bin));
  }

  var state = { E: D.start.E, t: D.start.t, unit: 'rel', compare: 'energy', view: 'x', cutF: 0.5 };

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(v, sig) {
    if (!isFinite(v)) return '–';
    return Number(v).toLocaleString('en-US', { maximumSignificantDigits: sig || 3 });
  }
  function fmtE(E) { return (E < 1 ? E.toFixed(1) : String(E)) + ' MeV'; }
  function fmtT(t) { return t + ' cm'; }
  function isPick(E, t) { return D.thesisPick && D.thesisPick.E === E && D.thesisPick.t === t; }

  // Google's Turbo colour map (polynomial fit), close to the jet map in my MATLAB plots
  function turbo(x) {
    x = Math.max(0, Math.min(1, x));
    var x2 = x * x, x3 = x2 * x, x4 = x3 * x, x5 = x4 * x;
    var r = 0.13572138 + 4.61539260 * x - 42.66032258 * x2 + 132.13108234 * x3 - 152.94239396 * x4 + 59.28637943 * x5;
    var g = 0.09140261 + 2.19418839 * x + 4.84296658 * x2 - 14.18503333 * x3 + 4.27729857 * x4 + 2.82956604 * x5;
    var b = 0.10667330 + 12.64194608 * x - 60.58204836 * x2 + 110.36276771 * x3 - 89.90310912 * x4 + 27.34824973 * x5;
    return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
  }
  function css(c) { return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')'; }

  // unit conversion of a centre-profile dose value
  function conv(r, v, unit) {
    if (unit === 'abs') return v;
    if (unit === 'kgy') return v * D.targetKGy / r.pmin;
    return v / r.pmax * 100;
  }
  var UNIT = {
    rel: { btn: '% of peak', axis: 'Dose (% of peak)', suf: '%' },
    abs: { btn: 'eV/g per electron', axis: 'Dose (eV/g per electron)', suf: ' eV/g' },
    kgy: { btn: 'kGy at ' + fmt(D.targetKGy, 4) + ' kGy min', axis: 'Dose (kGy, least-treated depth = ' + fmt(D.targetKGy, 4) + ')', suf: ' kGy' }
  };

  // ---------- markup ----------
  function seg(cls, label, items) {
    return '<div class="ebd-group"><span class="ebd-lab" id="' + cls + '-lab">' + label + '</span>' +
      '<div class="ebd-seg ' + cls + '" role="group" aria-labelledby="' + cls + '-lab">' + items + '</div></div>';
  }
  var eBtns = D.energies.map(function (E) {
    return '<button type="button" class="ebd-btn" data-e="' + E + '" aria-pressed="false">' + fmtE(E) + '</button>';
  }).join('');
  var tBtns = D.thicknesses.map(function (t) {
    return '<button type="button" class="ebd-btn" data-t="' + t + '" aria-pressed="false">' + fmtT(t) + '</button>';
  }).join('');
  var uBtns = ['rel', 'abs', 'kgy'].map(function (u) {
    return '<button type="button" class="ebd-btn ebd-sm" data-u="' + u + '" aria-pressed="false">' + esc(UNIT[u].btn) + '</button>';
  }).join('');
  var cBtns = [['off', 'This run'], ['energy', 'All energies'], ['thick', 'All thicknesses']].map(function (c) {
    return '<button type="button" class="ebd-btn ebd-sm" data-c="' + c[0] + '" aria-pressed="false">' + c[1] + '</button>';
  }).join('');

  var vBtns = [['x', 'Across the belt'], ['y', 'Along the belt']].map(function (v) {
    return '<button type="button" class="ebd-btn ebd-sm" data-v="' + v[0] + '" aria-pressed="false">' + v[1] + '</button>';
  }).join('');

  root.innerHTML =
    '<div class="ebd-pickers">' + seg('ebd-e', 'Beam energy', eBtns) + seg('ebd-t', 'Soil layer', tBtns) + '</div>' +
    '<div class="ebd-cutbar">' + seg('ebd-v', 'Cut direction', vBtns) +
      '<div class="ebd-group ebd-slide"><label class="ebd-lab" for="ebd-cut">Cut position</label>' +
        '<div class="ebd-slrow"><input id="ebd-cut" type="range" min="0" max="1" step="1" value="0" data-s="cut">' +
        '<button type="button" class="ebd-btn ebd-sm" data-act="centre">Centre</button>' +
        '<button type="button" class="ebd-btn ebd-sm" data-act="sweep" aria-pressed="false">Sweep</button></div>' +
        '<output class="ebd-cutout" for="ebd-cut"></output></div>' +
    '</div>' +
    '<div class="sc3d-stage ebd-stage">' +
      '<canvas class="ebd-cv" role="img" aria-label="Dose cutaway of the soil layer"></canvas>' +
      '<p class="sc3d-status" role="status">The dose map loads when you scroll here&hellip;</p>' +
      '<div class="ebd-tip" hidden></div>' +
    '</div>' +
    '<p class="ebd-hint">Slide the cut through the layer. Hover or tap a cell for its dose. Dashed lines mark the centre window used for the depth curve below.</p>' +
    '<div class="sc3d-panel ebd-panel" aria-live="polite">' +
      '<p class="sc3d-eyebrow">Depth-dose through the centre of the layer</p>' +
      '<h3 class="ebd-title"></h3>' +
      '<p class="ebd-sum"></p>' +
      '<div class="ebd-chartbar">' + seg('ebd-u', 'Units', uBtns) + seg('ebd-c', 'Compare', cBtns) + '</div>' +
      '<p class="ebd-msg" hidden></p>' +
      '<svg class="ebd-chart" viewBox="0 0 640 300" role="img" aria-label="Depth-dose chart"></svg>' +
      '<div class="ebd-key"></div>' +
      '<dl class="sc3d-specs ebd-specs"></dl>' +
    '</div>' +
    (D.setup ? '<p class="sc3d-note">' + esc(D.setup) + '</p>' : '') +
    (D.note ? '<p class="sc3d-note">' + esc(D.note) + '</p>' : '');

  if (!document.getElementById('ebd-css')) {   // kept here so style.css stays unchanged
    var st = document.createElement('style'); st.id = 'ebd-css';
    st.textContent =
      '#dose-explorer{margin-top:20px}' +
      '.ebd-pickers,.ebd-chartbar,.ebd-cutbar{display:flex;flex-wrap:wrap;gap:10px 24px;margin:0 0 12px}' +
      '.ebd-cutbar{align-items:flex-start}' +
      '.ebd-group{display:flex;flex-direction:column;gap:4px}' +
      '.ebd-lab{font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}' +
      '.ebd-seg{display:flex;flex-wrap:wrap}' +
      '.ebd-btn{background:var(--white);border:1px solid #cfcbc2;margin:0 -1px -1px 0;padding:6px 11px;font:600 .88rem var(--sans);color:var(--green);cursor:pointer;position:relative}' +
      '.ebd-btn.ebd-sm{font-size:.8rem;padding:4px 9px}' +
      '.ebd-btn:hover{border-color:var(--green);z-index:1}' +
      '.ebd-btn[aria-pressed="true"]{background:var(--green);border-color:var(--green);color:var(--white);z-index:2}' +
      '.ebd-btn:disabled{color:#b4b0a7;background:#f3f1ec;cursor:not-allowed;text-decoration:line-through}' +
      '.ebd-btn.is-pick::after{content:"";position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;background:#d9822b}' +
      '.ebd-slide{flex:1 1 280px;min-width:0}' +
      '.ebd-slrow{display:flex;align-items:center;gap:8px}.ebd-slrow .ebd-btn{margin:0}' +
      '.ebd-slrow input{flex:1;min-width:120px;accent-color:#d9822b}' +
      '.ebd-cutout{font-size:.88rem;color:var(--ink);font-variant-numeric:tabular-nums}' +
      '.ebd-stage{height:420px;overflow:hidden}' +
      '.ebd-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y}' +
      '.ebd-tip{position:absolute;z-index:3;pointer-events:none;background:var(--white);border:1px solid var(--rule);box-shadow:0 2px 8px rgba(0,0,0,.15);padding:6px 9px;font-size:.8rem;line-height:1.35;max-width:240px}' +
      '.ebd-tip[hidden]{display:none}.ebd-tip b{color:var(--green)}' +
      '.ebd-hint{font-size:.82rem;color:var(--muted);margin:6px 0 18px}' +
      '.ebd-panel{min-height:0}.ebd-sum{font-size:1.02rem}' +
      '.ebd-chart{width:100%;height:auto;display:block;font-family:var(--sans);overflow:visible}' +
      '.ebd-chart text{font-size:12px;fill:var(--muted)}.ebd-chart .ax{stroke:#9a968d;stroke-width:1}.ebd-chart .gr{stroke:#e9e6de;stroke-width:1}' +
      '.ebd-key{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.82rem;margin:4px 0 14px;color:var(--muted)}' +
      '.ebd-key span{display:inline-flex;align-items:center;gap:6px}.ebd-key i{display:inline-block;width:16px;height:3px}' +
      '.ebd-key .is-cur{color:var(--ink);font-weight:600}' +
      '.ebd-msg{font-size:.85rem;color:#8a4b0f;background:#fff7e6;border-left:3px solid #d9822b;padding:6px 10px;margin:0 0 8px}.ebd-msg[hidden]{display:none}' +
      '#dose-explorer button:focus-visible,#dose-explorer input:focus-visible{outline:3px solid #d9822b;outline-offset:2px}' +
      '.is-failed .ebd-cv{display:none}.is-failed.ebd-stage{height:120px}' +
      '@media (max-width:640px){.ebd-stage{height:390px}}';
    document.head.appendChild(st);
  }

  var stage = root.querySelector('.ebd-stage');
  var cv = root.querySelector('.ebd-cv');
  var status = root.querySelector('.sc3d-status');
  var tip = root.querySelector('.ebd-tip');
  var slider = root.querySelector('[data-s="cut"]');
  var svg = root.querySelector('.ebd-chart');

  // ---------- 2D panel: title, summary, chart, numbers ----------
  function curRun() { return run(state.E, state.t); }

  function summary(r) {
    var s;
    if (r.pen) {
      var dur = r.pmax / r.pmin;
      s = 'At ' + fmtE(r.E) + ' the beam treats the whole ' + fmtT(r.t) + ' layer. The most-treated depth gets ' +
        fmt(dur, 3) + '× the dose of the least-treated depth' + (dur <= 2 ? ', an even treatment.' : '.');
      if (isPick(r.E, r.t)) s += ' This is the pairing my thesis recommends.';
    } else {
      s = 'At ' + fmtE(r.E) + ' the dose falls below 10% of its peak by ' + fmt(r.reach, 2) + ' cm, so the bottom ' +
        fmt(r.t - r.reach, 2) + ' cm of this ' + fmtT(r.t) + ' layer is barely treated.';
    }
    return s;
  }

  function series() {
    var r = curRun(), list = [];
    if (state.compare === 'energy') {
      D.energies.forEach(function (E) { var x = run(E, state.t); if (x) list.push(x); });
    } else if (state.compare === 'thick') {
      D.thicknesses.forEach(function (t) { var x = run(state.E, t); if (x) list.push(x); });
    } else list.push(r);
    if (state.unit === 'kgy') list = list.filter(function (x) { return x.pen; });
    return list;
  }

  function nice(max) {
    var raw = max / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    return step;
  }
  function el(name, attrs, text) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function seriesColour(r, list) {
    if (list.length === 1) return '#18453B';
    var idx = state.compare === 'energy' ? D.energies.indexOf(r.E) : D.thicknesses.indexOf(r.t);
    var n = state.compare === 'energy' ? D.energies.length : D.thicknesses.length;
    return css(turbo(0.08 + 0.84 * idx / (n - 1)));
  }

  function drawChart() {
    var r = curRun(), list = series(), unit = state.unit;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = Math.max(320, Math.round(svg.getBoundingClientRect().width) || 640), H = W < 520 ? 250 : 300, L = 62, R = 14, T = 12, B = 42;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var xmax = 0, ymax = 0;
    list.forEach(function (s) {
      xmax = Math.max(xmax, s.pen ? s.t : Math.min(s.t, Math.ceil(s.extent / s.bin) * s.bin));
      s.prof.forEach(function (v, i) { if (s.depth[i] <= s.extent + 1e-9) ymax = Math.max(ymax, conv(s, v + s.profS[i], unit)); });
    });
    ymax *= 1.05;
    var xs = function (x) { return L + x / xmax * (W - L - R); };
    var ys = function (y) { return H - B - y / ymax * (H - T - B); };
    var g = el('g');
    var ystep = nice(ymax);
    for (var y = 0; y <= ymax + 1e-9; y += ystep) {
      g.appendChild(el('line', { x1: L, x2: W - R, y1: ys(y), y2: ys(y), 'class': 'gr' }));
      g.appendChild(el('text', { x: L - 6, y: ys(y) + 4, 'text-anchor': 'end' }, fmt(y, 4)));
    }
    var xstep = nice(xmax);
    for (var x = 0; x <= xmax + 1e-9; x += xstep) {
      g.appendChild(el('line', { x1: xs(x), x2: xs(x), y1: H - B, y2: H - B + 4, 'class': 'ax' }));
      g.appendChild(el('text', { x: xs(x), y: H - B + 17, 'text-anchor': 'middle' }, fmt(+x.toFixed(4), 4)));
    }
    g.appendChild(el('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, 'class': 'ax' }));
    g.appendChild(el('line', { x1: L, x2: L, y1: T, y2: H - B, 'class': 'ax' }));
    g.appendChild(el('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle' }, 'Depth into the soil (cm)'));
    g.appendChild(el('text', { x: 14, y: (T + H - B) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (T + H - B) / 2 + ')' }, UNIT[unit].axis));
    svg.appendChild(g);
    if (unit === 'kgy') {
      var yt = ys(D.targetKGy);
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: yt, y2: yt, stroke: '#d9822b', 'stroke-dasharray': '5 4', 'stroke-width': 1.2 }));
      svg.appendChild(el('text', { x: W - R - 4, y: yt - 5, 'text-anchor': 'end', style: 'fill:#b5651d' }, 'target minimum'));
    }
    // other runs first, current run last (on top) with its 3-sigma band
    var ordered = list.filter(function (s) { return s !== r; });
    if (list.indexOf(r) >= 0) ordered.push(r);
    ordered.forEach(function (s) {
      // PENELOPE doses are bin averages, so each bin is drawn as a flat step across its depth range
      var col = seriesColour(s, list), cur = s === r, h = s.bin / 2;
      var line = [], up = [], dn = [], dots = [];
      s.depth.forEach(function (d, i) {
        if (d - h > s.extent + 1e-9) return;
        var x0 = xs(d - h).toFixed(1), x1 = xs(Math.min(d + h, xmax)).toFixed(1);
        var y = ys(conv(s, s.prof[i], unit)).toFixed(1);
        var yu = ys(conv(s, s.prof[i] + s.profS[i], unit)).toFixed(1);
        var yd = ys(Math.max(0, conv(s, s.prof[i] - s.profS[i], unit))).toFixed(1);
        line.push(x0 + ',' + y, x1 + ',' + y);
        up.push(x0 + ',' + yu, x1 + ',' + yu);
        dn.unshift(x1 + ',' + yd, x0 + ',' + yd);
        dots.push([xs(d).toFixed(1), y]);
      });
      if (cur) svg.appendChild(el('polygon', { points: up.concat(dn).join(' '), fill: col, 'fill-opacity': 0.14, stroke: 'none' }));
      svg.appendChild(el('polyline', { points: line.join(' '), fill: 'none', stroke: col, 'stroke-width': cur ? 2.4 : 1.5, 'stroke-opacity': cur ? 1 : 0.85, 'stroke-linejoin': 'round' }));
      if (cur && dots.length <= 40) dots.forEach(function (q) { svg.appendChild(el('circle', { cx: q[0], cy: q[1], r: 2.4, fill: col })); });
    });
    if (r.t > xmax + 1e-9) svg.appendChild(el('text', { x: W - R - 4, y: T + 14, 'text-anchor': 'end' }, 'this layer continues to ' + fmtT(r.t) + ' →'));
    // key
    var key = root.querySelector('.ebd-key');
    var notes = [];
    if (list.length > 1 || state.compare !== 'off') {
      key.innerHTML = list.map(function (s) {
        var lab = state.compare === 'thick' ? fmtT(s.t) : fmtE(s.E);
        return '<span class="' + (s === r ? 'is-cur' : '') + '"><i style="background:' + seriesColour(s, list) + '"></i>' + lab + '</span>';
      }).join('') + '<span><i style="background:rgba(24,69,59,.25);height:8px"></i>±3σ (this run)</span>';
    } else key.innerHTML = '<span><i style="background:rgba(24,69,59,.25);height:8px"></i>±3σ statistical uncertainty</span>';
    if (state.unit === 'kgy' && state.compare !== 'off') {
      var all = state.compare === 'energy' ? D.energies.map(function (E) { return run(E, state.t); }) : D.thicknesses.map(function (t) { return run(state.E, t); });
      var dropped = all.filter(function (x) { return x && !x.pen; });
      if (dropped.length) notes.push('Runs where the beam does not reach the bottom of the layer are left out, because no minimum dose can be set for them.');
    }
    var msg = root.querySelector('.ebd-msg');
    if (state.kgyFallback) notes.unshift('The beam does not reach the bottom of this layer, so the chart is shown as % of peak instead of kGy.');
    msg.hidden = !notes.length; msg.textContent = notes.join(' ');
  }

  function specs() {
    var r = curRun();
    var items = [
      ['Peak dose (centre)', fmt(r.pmax, 4) + ' eV/g per electron at ' + fmt(r.depth[r.ipk], 2) + ' cm'],
      ['Dose at the surface', fmt(r.prof[0] / r.pmax * 100, 2) + '% of peak'],
      ['Dose at the bottom', fmt(r.prof[r.prof.length - 1] / r.pmax * 100, 2) + '% of peak'],
      ['Max ÷ min dose in the layer', r.pen ? fmt(r.pmax / r.pmin, 3) : 'beam stops at ' + fmt(r.reach, 2) + ' cm'],
      ['Peak at a ' + fmt(D.targetKGy, 4) + ' kGy minimum', r.pen ? fmt(D.targetKGy * r.pmax / r.pmin, 3) + ' kGy' : 'not reachable'],
      ['Absorbed energy doing useful work', fmt(r.pmin / r.mean * 100, 2) + '% (min ÷ average dose)'],
      ['Simulated electrons', fmt(r.showers, 7)],
      ['Voxel grid', r.nb.join(' × ') + ' (' + fmt(r.bin * 10, 3) + ' mm deep each)']
    ];
    root.querySelector('.ebd-specs').innerHTML = items.map(function (it) {
      return '<div><dt>' + esc(it[0]) + '</dt><dd>' + esc(it[1]) + '</dd></div>';
    }).join('');
  }

  function syncButtons() {
    root.querySelectorAll('[data-e]').forEach(function (b) {
      var E = +b.getAttribute('data-e');
      b.setAttribute('aria-pressed', String(E === state.E));
      b.classList.toggle('is-pick', isPick(E, state.t));
    });
    root.querySelectorAll('[data-t]').forEach(function (b) {
      var t = +b.getAttribute('data-t'), ok = !!run(state.E, t);
      b.disabled = !ok;
      b.title = ok ? '' : 'No PUFFIn+ run at ' + fmtE(state.E) + ' with a ' + fmtT(t) + ' layer';
      b.setAttribute('aria-pressed', String(t === state.t));
      b.classList.toggle('is-pick', isPick(state.E, t));
    });
    root.querySelectorAll('[data-e]').forEach(function (b) {
      var E = +b.getAttribute('data-e');
      if (!run(E, state.t)) b.title = 'No ' + fmtT(state.t) + ' run at ' + fmtE(E) + '; picks the nearest layer';
      else b.title = '';
    });
    var r = curRun();
    root.querySelectorAll('[data-u]').forEach(function (b) {
      var u = b.getAttribute('data-u');
      b.setAttribute('aria-pressed', String(u === state.unit));
      if (u === 'kgy') { b.disabled = !r.pen; b.title = r.pen ? '' : 'The beam does not reach the bottom of this layer'; }
    });
    root.querySelectorAll('[data-c]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-c') === state.compare)); });
    root.querySelectorAll('[data-v]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === state.view)); });
    root.querySelector('[data-act="sweep"]').setAttribute('aria-pressed', String(!!sweepT));
    var n = cutN(r);
    slider.max = n - 1;
    slider.value = cutIdx(r);
    root.querySelector('.ebd-cutout').textContent = cutText(r);
  }

  function updatePanel() {
    var r = curRun();
    state.kgyFallback = false;
    if (state.unit === 'kgy' && !r.pen) { state.unit = 'rel'; state.kgyFallback = true; }
    root.querySelector('.ebd-title').textContent = fmtE(r.E) + ' beam · ' + fmtT(r.t) + ' soil layer';
    root.querySelector('.ebd-sum').textContent = summary(r);
    syncButtons(); drawChart(); specs(); legend();
  }

  function legend() { if (V) V.draw(); }

  // ---------- cut position ----------
  var sweepT = 0;
  function cutN(r) { return state.view === 'x' ? r.nb[1] : r.nb[0]; }
  function cutIdx(r) { var n = cutN(r); return Math.max(0, Math.min(n - 1, Math.round(state.cutF * (n - 1)))); }
  function cutPos(r) {          // centre of the cut slice, in cm
    var n = cutN(r), i = cutIdx(r);
    var a = state.view === 'x' ? r.ext[2] : r.ext[0], b = state.view === 'x' ? r.ext[3] : r.ext[1];
    return a + (i + 0.5) * (b - a) / n;
  }
  function win(r) {             // Appendix C centre window, in cm
    var mx = (r.ext[0] + r.ext[1]) / 2, my = (r.ext[2] + r.ext[3]) / 2;
    return { x0: mx - 15, x1: mx + 15, y0: my - 2, y1: my + 2 };
  }
  function cutText(r) {
    var p = cutPos(r), w = win(r), s, inWin;
    if (state.view === 'x') {
      s = 'Slice ' + fmt(p, 3) + ' cm along the ' + fmt(r.ext[3] - r.ext[2], 3) + ' cm strip';
      inWin = p > w.y0 && p < w.y1;
    } else {
      var dx = (r.ext[1] - r.ext[0]) / r.nb[0];
      s = Math.abs(p) < dx ? 'Slice at the belt centre' : 'Slice ' + fmt(Math.abs(p), 3) + ' cm ' + (p < 0 ? 'left' : 'right') + ' of the belt centre';
      inWin = p > w.x0 && p < w.x1;
    }
    return s + (inWin ? ' · inside the centre window' : ' · outside the centre window');
  }
  function stopSweep() { if (sweepT) { clearInterval(sweepT); sweepT = 0; } }
  function setCut(i) {
    var r = curRun(), n = cutN(r);
    state.cutF = n > 1 ? Math.max(0, Math.min(n - 1, i)) / (n - 1) : 0;
    syncButtons(); if (V) V.draw();
  }

  // ---------- events ----------
  root.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b || !root.contains(b) || b.disabled) return;
    if (b.hasAttribute('data-e')) {
      var E = +b.getAttribute('data-e');
      if (!run(E, state.t)) {            // nearest simulated layer
        var best = null;
        D.thicknesses.forEach(function (t) { if (run(E, t) && (best === null || Math.abs(Math.log(t / state.t)) < Math.abs(Math.log(best / state.t)))) best = t; });
        state.t = best;
      }
      state.E = E; changeRun();
    } else if (b.hasAttribute('data-t')) { state.t = +b.getAttribute('data-t'); changeRun(); }
    else if (b.hasAttribute('data-u')) { state.unit = b.getAttribute('data-u'); updatePanel(); }
    else if (b.hasAttribute('data-c')) { state.compare = b.getAttribute('data-c'); updatePanel(); }
    else if (b.hasAttribute('data-v')) { stopSweep(); state.view = b.getAttribute('data-v'); state.cutF = 0.5; syncButtons(); if (V) V.draw(); }
    else if (b.getAttribute('data-act') === 'centre') { stopSweep(); state.cutF = 0.5; syncButtons(); if (V) V.draw(); }
    else if (b.getAttribute('data-act') === 'sweep') {
      if (sweepT) { stopSweep(); syncButtons(); return; }
      var r = curRun(), n = cutN(r), i = cutIdx(r) >= n - 1 ? 0 : cutIdx(r);
      setCut(i);
      sweepT = setInterval(function () {
        var rr = curRun(), nn = cutN(rr), j = cutIdx(rr) + 1;
        if (j >= nn) { stopSweep(); syncButtons(); return; }
        setCut(j);
      }, Math.max(60, Math.min(160, 4000 / n)));
      syncButtons();
    }
  });
  slider.addEventListener('input', function () { stopSweep(); setCut(+slider.value); });

  function changeRun() { stopSweep(); updatePanel(); if (V) V.load(curRun()); }

  updatePanel();
  var rz = 0, lastW = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      var w = svg.getBoundingClientRect().width; if (Math.abs(w - lastW) > 4) { lastW = w; drawChart(); }
      if (V) V.draw();
    }, 150);
  });

  // ---------- data ----------
  var V = null;
  var cache = {};
  function fetchRun(r) {
    if (cache[r.id]) return cache[r.id];
    cache[r.id] = fetch(D.binPath + r.id + '.bin?v=1').then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.arrayBuffer();
    }).then(function (buf) {
      var n = r.nb[0] * r.nb[1] * r.nb[2];
      return { q: new Uint16Array(buf, 0, n), u: new Uint8Array(buf, 2 * n, n) };
    });
    cache[r.id].catch(function () { delete cache[r.id]; });
    return cache[r.id];
  }

  function startView() { V = makeView(); V.load(curRun()); }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      if (en.some(function (e) { return e.isIntersecting; })) { io.disconnect(); startView(); }
    }, { rootMargin: '400px 0px' });
    io.observe(stage);
  } else startView();

  // ---------- 2D cutaway ----------
  function makeView() {
    var ctx = cv.getContext('2d');
    var off = document.createElement('canvas'), octx = off.getContext('2d');
    var cur = null, data = null, token = 0, box = null;
    var FONT = getComputedStyle(root).fontFamily || 'sans-serif';

    function load(r) {
      var my = ++token;
      tip.hidden = true;
      if (!data) { status.hidden = false; status.textContent = 'Loading the dose map…'; }
      fetchRun(r).then(function (dd) {
        if (my !== token) return;
        cur = r; data = dd; status.hidden = true; status.textContent = '';
        draw();
      }).catch(function () {
        if (my !== token) return;
        if (!data) {
          stage.classList.add('is-failed');
          status.textContent = 'The dose map could not load here, but the chart and numbers below still work.';
        } else status.textContent = '';
      });
    }

    function ticks(a, b, maxN) {
      var span = b - a, raw = span / maxN, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
      var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p, out = [];
      for (var v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step);
      return out;
    }
    function tl(v) { return String(+v.toFixed(3)); }

    function draw() {
      if (!cur || !data) return;
      var r = cur;
      if (r !== curRun()) return;                    // a newer run is still loading
      var Wc = stage.clientWidth, Hc = stage.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (cv.width !== Math.round(Wc * dpr) || cv.height !== Math.round(Hc * dpr)) { cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, Wc, Hc);
      var small = Wc < 560;
      var nx = r.nb[0], ny = r.nb[1], nz = r.nb[2];
      var across = state.view === 'x';
      var nh = across ? nx : ny;                       // cells across the picture
      var h0 = across ? r.ext[0] : r.ext[2], h1 = across ? r.ext[1] : r.ext[3];
      var ci = cutIdx(r), w = win(r);

      // layout
      var L = small ? 46 : 60, R = small ? 66 : 80, T = small ? 112 : 96, B = 46;
      var sw = Wc - L - R, sh = Hc - T - B;
      var ppcH = sw / (h1 - h0), ppcZ = sh / r.t;
      if (ppcZ < ppcH) { ppcH = ppcZ; }               // never squash depth: draw both to the same scale
      var pw = (h1 - h0) * ppcH, ph = r.t * ppcZ;
      var x0 = L + (sw - pw) / 2, y0 = T;
      var k = ppcZ / ppcH;
      box = { x0: x0, y0: y0, pw: pw, ph: ph, nh: nh, nz: nz, across: across, ci: ci };

      // heat map: one pixel per voxel, scaled up without smoothing
      off.width = nh; off.height = nz;
      var img = octx.createImageData(nh, nz), px = img.data, scale = r.peak / 65535 / r.pmax;
      for (var iz = 0; iz < nz; iz++) {
        for (var ih = 0; ih < nh; ih++) {
          var i = across ? ih + nx * (ci + ny * iz) : ci + nx * (ih + ny * iz);
          var c = turbo(data.q[i] * scale), o = 4 * (ih + nh * iz);
          px[o] = c[0] * 255; px[o + 1] = c[1] * 255; px[o + 2] = c[2] * 255; px[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, x0, y0, pw, ph);
      ctx.strokeStyle = '#6f6b63'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x0) - 0.5, Math.round(y0) - 0.5, Math.round(pw) + 1, Math.round(ph) + 1);

      // centre window (Appendix C)
      var wa = across ? w.x0 : w.y0, wb = across ? w.x1 : w.y1;
      ctx.save();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5;
      [wa, wb].forEach(function (v) {
        if (v <= h0 || v >= h1) return;
        var xx = Math.round(x0 + (v - h0) * ppcH) + 0.5;
        ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 + ph); ctx.stroke();
      });
      ctx.restore();

      // axes
      ctx.fillStyle = '#5f5f5f'; ctx.font = '12px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ticks(h0, h1, Math.max(3, Math.floor(pw / 70))).forEach(function (v) {
        var xx = Math.round(x0 + (v - h0) * ppcH) + 0.5;
        ctx.fillRect(xx - 0.5, y0 + ph + 1, 1, 5);
        ctx.fillText(tl(v), xx, y0 + ph + 8);
      });
      ctx.fillText(across ? 'cm across the belt (0 = belt centre)' : 'cm along the belt (direction of travel)', x0 + pw / 2, y0 + ph + 26);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ticks(0, r.t, Math.max(2, Math.min(6, Math.floor(ph / 45)))).forEach(function (v) {
        var yy = Math.round(y0 + v * ppcZ) + 0.5;
        ctx.fillRect(x0 - 6, yy - 0.5, 5, 1);
        ctx.fillText(tl(v), x0 - 9, yy);
      });
      ctx.save(); ctx.translate(Math.max(small ? 11 : 16, x0 - (small ? 35 : 44)), y0 + ph / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.fillText('Depth (cm)', 0, 0); ctx.restore();

      // beam arrows and labels
      ctx.strokeStyle = '#2f63b8'; ctx.fillStyle = '#2f63b8'; ctx.lineWidth = 1.5;
      var na = Math.max(4, Math.floor(pw / 46));
      for (var a = 0; a < na; a++) {
        var ax = x0 + (a + 0.5) * pw / na, ay = y0 - 22;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, y0 - 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax - 4, y0 - 9); ctx.lineTo(ax, y0 - 3); ctx.lineTo(ax + 4, y0 - 9); ctx.fill();
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '600 13px ' + FONT;
      ctx.fillText('Electron beam (' + fmtE(r.E) + ')', L, small ? 20 : 24);
      ctx.fillStyle = '#5f5f5f'; ctx.font = '12px ' + FONT;
      var note = k > 1.05 ? (small ? 'Depth stretched ' + fmt(k, 2) + '× to fit' : 'Depth drawn ' + fmt(k, 2) + '× larger than ' + (across ? 'width' : 'length') + ' so the ' + fmtT(r.t) + ' layer is visible') : 'Drawn to scale';
      ctx.fillText(note, L, small ? 38 : 44);

      // top-view locator: soil footprint, centre window, cut line
      var fx = r.ext[1] - r.ext[0], fy = r.ext[3] - r.ext[2];
      var lw = Math.min(small ? 120 : 160, Wc * 0.32), lh = lw * fy / fx;
      var lx = small ? L : Wc - R - lw, ly = small ? 58 : 34;
      ctx.fillStyle = '#5f5f5f'; ctx.font = '11px ' + FONT; ctx.textAlign = 'left';
      ctx.fillText('Top view · cut in orange', lx, ly - 6);
      ctx.fillStyle = '#e7dcc6'; ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = '#9a968d'; ctx.lineWidth = 1; ctx.strokeRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1);
      var sx = lw / fx, sy = lh / fy;
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#6f6b63';
      ctx.strokeRect(lx + (w.x0 - r.ext[0]) * sx, ly + (w.y0 - r.ext[2]) * sy, (w.x1 - w.x0) * sx, (w.y1 - w.y0) * sy);
      ctx.restore();
      var cp = cutPos(r);
      ctx.strokeStyle = '#d9822b'; ctx.lineWidth = 2.5; ctx.beginPath();
      if (across) { var cy = ly + (cp - r.ext[2]) * sy; ctx.moveTo(lx - 3, cy); ctx.lineTo(lx + lw + 3, cy); }
      else { var cx = lx + (cp - r.ext[0]) * sx; ctx.moveTo(cx, ly - 3); ctx.lineTo(cx, ly + lh + 3); }
      ctx.stroke();
      ctx.fillStyle = '#5f5f5f'; ctx.font = '10px ' + FONT;
      ctx.fillText('belt travel ↓', lx + lw + 6, ly + lh / 2 + 3);

      // colour legend
      var gx = Wc - R + (small ? 10 : 16), gw = 12;
      var grad = ctx.createLinearGradient(0, y0 + ph, 0, y0);
      for (var g = 0; g <= 10; g++) grad.addColorStop(g / 10, css(turbo(g / 10)));
      ctx.fillStyle = grad; ctx.fillRect(gx, y0, gw, ph);
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.strokeRect(gx + 0.5, y0 + 0.5, gw - 1, ph - 1);
      ctx.fillStyle = '#2b2b2b'; ctx.font = '600 11px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      var u = state.unit;
      [[1, '≥ '], [0.5, ''], [0, '']].forEach(function (s) {
        var v = conv(r, s[0] * r.pmax, u);
        ctx.fillText(s[1] + (s[0] ? fmt(v, u === 'rel' ? 3 : 3) : '0'), gx + gw + 4, y0 + (1 - s[0]) * ph);
      });
      ctx.fillStyle = '#5f5f5f'; ctx.font = '11px ' + FONT; ctx.textBaseline = 'top';
      ctx.textAlign = 'right'; ctx.fillText(u === 'rel' ? '% of peak' : u === 'abs' ? 'eV/g per e⁻' : 'kGy', Wc - 4, y0 + ph + 8);

      cv.setAttribute('aria-label', 'Dose cutaway, ' + fmtE(r.E) + ' beam into a ' + fmtT(r.t) + ' soil layer. ' + cutText(r) +
        '. Colour shows dose from blue (none) to red (centre peak).');
      hl = null;
      if (lastHover) doHover(lastHover);
    }
    var hl = null;
    function outline(ih, iz) {
      var cw = box.pw / box.nh, ch = box.ph / box.nz;
      if (hl) { ctx.putImageData(hl.img, hl.x, hl.y); hl = null; }
      if (ih == null) return;
      var dpr = cv.width / stage.clientWidth;
      var x = Math.floor((box.x0 + ih * cw - 2) * dpr), y = Math.floor((box.y0 + iz * ch - 2) * dpr);
      var w = Math.ceil((cw + 4) * dpr), h = Math.ceil((ch + 4) * dpr);
      hl = { img: ctx.getImageData(x, y, w, h), x: x, y: y };
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(box.x0 + ih * cw, box.y0 + iz * ch, cw, ch); ctx.restore();
    }

    // ---- hover / tap read-out ----
    var lastHover = null;
    function doHover(e) {
      var r = cur;
      if (!r || !data || !box) return;
      var rect = cv.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var ih = Math.floor((mx - box.x0) / box.pw * box.nh), iz = Math.floor((my - box.y0) / box.ph * box.nz);
      if (ih < 0 || ih >= box.nh || iz < 0 || iz >= box.nz) { tip.hidden = true; lastHover = null; outline(null); return; }
      outline(ih, iz);
      lastHover = { clientX: e.clientX, clientY: e.clientY };
      var nx = r.nb[0], ny = r.nb[1];
      var ix = box.across ? ih : box.ci, iy = box.across ? box.ci : ih;
      var i = ix + nx * (iy + ny * iz);
      var dose = data.q[i] / 65535 * r.peak, unc = data.u[i];
      var xc = r.ext[0] + (ix + 0.5) * (r.ext[1] - r.ext[0]) / nx;
      var yc = r.ext[2] + (iy + 0.5) * (r.ext[3] - r.ext[2]) / ny;
      var unitLine = state.unit === 'kgy' ? fmt(conv(r, dose, 'kgy'), 3) + ' kGy at a ' + fmt(D.targetKGy, 4) + ' kGy minimum'
        : fmt(dose / r.pmax * 100, 3) + '% of the centre peak';
      tip.innerHTML = '<b>' + fmt(dose, 4) + ' eV/g</b> per electron' + (unc < 255 ? ' (±' + unc + '%, 3σ)' : ' (no dose recorded)') + '<br>' +
        esc(unitLine) + '<br>' + fmt(r.depth[iz], 3) + ' cm deep, ' + fmt(xc, 3) + ' cm across, ' + fmt(yc, 3) + ' cm along';
      tip.hidden = false;
      tip.style.left = Math.max(6, Math.min(mx + 14, rect.width - tip.offsetWidth - 6)) + 'px';
      tip.style.top = (my - tip.offsetHeight - 12 < 6 ? my + 16 : my - tip.offsetHeight - 12) + 'px';
    }
    cv.addEventListener('pointermove', doHover);
    cv.addEventListener('pointerdown', doHover);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { tip.hidden = true; lastHover = null; outline(null); } });

    root._ebdHover = doHover;   // test hook
    return { load: load, draw: draw };
  }
})();
