/* ==========================================================
   Slider crank paperweight 3D explorer (case study page)
   Plain JavaScript. three.js (0.186.1, loaded on demand from jsDelivr)
   draws a simplified model of our final design, built from the sizes
   in slider-crank-data.js. linkage-explorer.js owns the clock: every
   crank angle it reports turns the cranks and handle, swings the rod
   and slides the piston. The upside-down test turns the model over
   and shows why the original open track failed, and how the revised
   support fixes it.
   The readouts, diagram and charts still work if the 3D view cannot
   load.
   ========================================================== */
(function () {
  'use strict';

  var LCFG = window.SLIDER_CRANK, D = window.SLIDER_CRANK_3D, LX = window.LinkageExplorer;
  var root = document.getElementById('slider-3d');
  var kinRoot = document.getElementById('slider-explorer');
  if (!LCFG || !D || !LX || (!root && !kinRoot)) return;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEG = Math.PI / 180;
  var L = LCFG.linkage, G = D.geo;

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // ---------- kinematics-only fallback (no 3D host on the page) ----------
  var kin = {};
  if (kinRoot) {
    kinRoot.innerHTML =
      '<div class="cc3d-kin-transport"></div>' +
      '<div class="mx-kin"><div class="mx-schematic"></div><div class="mx-charts-host"></div></div>';
    kin.transport = kinRoot.querySelector('.cc3d-kin-transport');
    kin.schematic = kinRoot.querySelector('.mx-schematic');
    kin.charts = kinRoot.querySelector('.mx-charts-host');
  }

  // ---------- markup ----------
  var parts = D.parts, views = D.views;
  parts.forEach(function (pt, i) { pt.n = i + 1; });
  if (root) {
    var viewBtns = Object.keys(views).map(function (k) {
      return '<button type="button" class="sc3d-tool" data-view="' + k + '" aria-pressed="' + (k === 'overview') + '">' + esc(views[k].label) + '</button>';
    }).join('');
    var chips = parts.map(function (pt) {
      return '<button type="button" class="sc3d-chip" data-id="' + pt.id + '" aria-pressed="false">' +
        '<span class="sc3d-chip-num" aria-hidden="true">' + pt.n + '</span>' + esc(pt.name) + '</button>';
    }).join('');
    var markers = parts.map(function (pt) {
      return '<button type="button" class="sc3d-hotspot cc3d-marker" data-id="' + pt.id + '" data-visible aria-label="' + pt.n + '. ' + esc(pt.name) + '">' +
        '<span class="sc3d-num" aria-hidden="true">' + pt.n + '</span><span class="sc3d-label" aria-hidden="true">' + esc(pt.name) + '</span></button>';
    }).join('');
    var dims = ['a', 'b', 'd', 'r'].map(function (k) {
      return '<span class="scx-dim" data-dim="' + k + '" aria-hidden="true"></span>';
    }).join('');

    root.innerHTML =
      '<div class="sc3d-stage cc3d-stage scx-stage">' +
        '<div class="sc3d-viewer cc3d-viewer scx-viewer" role="img" aria-label="Interactive 3D model of the slider crank paperweight. A handle turns a crank on a baseplate bracket, and a connecting rod slides a piston back and forth along a track on the piston support."></div>' +
        '<div class="cc3d-markers scx-dims" hidden>' + dims + '</div>' +
        '<div class="cc3d-markers scx-markers" hidden>' + markers + '</div>' +
        '<p class="sc3d-status" role="status">Loading the 3D model&hellip;</p>' +
        '<p class="cc3d-phase" aria-hidden="true" hidden></p>' +
        '<div class="sc3d-tools cc3d-tools" hidden>' + viewBtns +
          '<button type="button" class="sc3d-tool" data-act="dims" aria-pressed="false">Link lengths</button>' +
        '</div>' +
        '<p class="sc3d-hint" hidden>Drag to rotate &middot; scroll or pinch to zoom &middot; click a part</p>' +
      '</div>' +
      '<div class="cc3d-transport"></div>' +
      '<div class="scx-test" hidden>' +
        '<p class="scx-test-intro"><strong>The upside-down test.</strong> ' + esc(D.test.intro) + '</p>' +
        '<div class="scx-test-row">' +
          '<button type="button" class="mx-chip scx-flip" data-act="flip" aria-pressed="false">Turn it upside down</button>' +
          '<div class="scx-seg" role="group" aria-label="Piston support version">' +
            '<button type="button" class="mx-chip" data-support="original" aria-pressed="true">Original support</button>' +
            '<button type="button" class="mx-chip" data-support="revised" aria-pressed="false">Revised support</button>' +
          '</div>' +
        '</div>' +
        '<p class="scx-result" aria-live="polite"></p>' +
      '</div>' +
      '<div class="cc3d-readouts"></div>' +
      '<div class="sc3d-chips" role="group" aria-label="Paperweight parts">' + chips + '</div>' +
      '<div class="sc3d-panel" aria-live="polite"></div>' +
      (D.note ? '<p class="sc3d-note">' + esc(D.note) + '</p>' : '');
  }

  // ---------- the shared clock, readouts, diagram and charts ----------
  var explorer = LX.create({
    linkage: L,
    period: LCFG.period,
    start: LCFG.start,
    autoplay: LCFG.autoplay,
    angleLabel: LCFG.angleLabel,
    presets: LCFG.presets,
    readouts: LCFG.readouts,
    charts: LCFG.charts,
    mounts: {
      transport: [root ? root.querySelector('.cc3d-transport') : null, kin.transport],
      readouts: root ? root.querySelector('.cc3d-readouts') : null,
      schematic: kin.schematic,
      charts: kin.charts
    }
  });
  if (kinRoot) kinRoot.linkageExplorer = explorer;
  if (!root) return;

  var stage = root.querySelector('.scx-stage');
  var viewer = root.querySelector('.scx-viewer');
  var statusEl = root.querySelector('.sc3d-status');
  var phaseEl = root.querySelector('.cc3d-phase');
  var panel = root.querySelector('.sc3d-panel');
  var markerWrap = root.querySelector('.scx-markers');
  var dimWrap = root.querySelector('.scx-dims');
  var testEl = root.querySelector('.scx-test');
  var resultEl = root.querySelector('.scx-result');
  explorer.watch(stage);

  // ---------- parts list and details panel ----------
  var state = { selected: null, view: 'overview', dims: false, revised: false, flipped: false, busy: false };
  var api3d = null;

  function renderPanel() {
    var pt = state.selected && parts.filter(function (x) { return x.id === state.selected; })[0];
    if (!pt) {
      panel.innerHTML = '<p class="sc3d-eyebrow">Overview</p><h3>' + esc(D.overview.title) + '</h3>' +
        '<ol class="cc3d-steps">' + D.overview.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
        '<p class="sc3d-prompt">Pick a part above, or click one on the model, to see what it does.</p>';
      return;
    }
    var i = parts.indexOf(pt), prev = parts[(i + parts.length - 1) % parts.length], next = parts[(i + 1) % parts.length];
    panel.innerHTML =
      '<p class="sc3d-eyebrow">' + pt.n + ' of ' + parts.length + ' &middot; ' + esc(pt.kind) + '</p>' +
      '<h3>' + esc(pt.name) + '</h3>' +
      '<p class="sc3d-summary">' + esc(pt.summary) + '</p>' +
      '<dl class="sc3d-specs">' + pt.specs.map(function (s) { return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="sc3d-nav">' +
        '<button type="button" class="sc3d-link" data-go="' + prev.id + '">&larr; ' + esc(prev.name) + '</button>' +
        '<button type="button" class="sc3d-link" data-go="">Back to overview</button>' +
        '<button type="button" class="sc3d-link" data-go="' + next.id + '">' + esc(next.name) + ' &rarr;</button>' +
      '</div>';
  }
  function select(id) {
    state.selected = id || null;
    Array.prototype.forEach.call(root.querySelectorAll('.sc3d-chip'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-id') === state.selected ? 'true' : 'false');
    });
    Array.prototype.forEach.call(markerWrap.querySelectorAll('.cc3d-marker'), function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-id') === state.selected);
    });
    renderPanel();
    if (api3d) api3d.applyLook();
  }
  root.addEventListener('click', function (e) {
    var chip = e.target.closest('.sc3d-chip, .cc3d-marker');
    if (chip) { var id = chip.getAttribute('data-id'); select(state.selected === id ? null : id); return; }
    var go = e.target.closest('[data-go]');
    if (go) { select(go.getAttribute('data-go')); return; }
    var vb = e.target.closest('[data-view]');
    if (vb && api3d) { api3d.goView(vb.getAttribute('data-view')); return; }
    var db = e.target.closest('[data-act="dims"]');
    if (db && api3d) { setDims(!state.dims); return; }
    var fb = e.target.closest('[data-act="flip"]');
    if (fb && api3d) { api3d.flip(!state.flipped); return; }
    var sb = e.target.closest('[data-support]');
    if (sb && api3d) { api3d.support(sb.getAttribute('data-support') === 'revised'); }
  });
  function setDims(on) {
    state.dims = on;
    state.autoDims = false;
    markerWrap.classList.toggle('is-dimmed', on);
    var b = root.querySelector('[data-act="dims"]');
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (api3d) api3d.showDims(on);
  }
  renderPanel();

  // ---------- 3D ----------
  function fail(msg) {
    stage.classList.add('is-failed', 'cc3d-failed');
    statusEl.innerHTML = '';
    if (D.fallbackImage) {
      var img = document.createElement('img');
      img.className = 'cc3d-fallback-img';
      img.src = D.fallbackImage;
      img.alt = 'Rendering of the slider crank paperweight 3D model';
      img.onerror = function () { img.remove(); };
      stage.insertBefore(img, stage.firstChild);
    }
    var m = document.createElement('span');
    m.className = 'cc3d-fail-msg';
    m.textContent = msg + ' The parts list, readouts and charts still work.';
    statusEl.appendChild(m);
  }
  function webglOK() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    if (!webglOK()) { fail('This browser cannot show 3D graphics.'); return; }
    import(THREE_URL).then(function (THREE) {
      try { build(THREE); }
      catch (err) { console.error(err); fail('The 3D view hit an error.'); }
    }).catch(function (err) {
      console.warn(err);
      fail('The 3D viewer could not load. It needs an internet connection.');
    });
  }
  if ('IntersectionObserver' in window) {
    var lazy = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { lazy.disconnect(); start(); }
    }, { rootMargin: '400px' });
    lazy.observe(stage);
  } else start();

  function build(THREE) {
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    var canvas = renderer.domElement;
    canvas.className = 'cc3d-canvas';
    viewer.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
    function V(X, Y, Z) { return new THREE.Vector3(X, Z, -Y); }   // model inches (Z up) -> scene

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b4, 1.5));
    var key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.copy(V(-4, -8, 26));
    key.target.position.copy(V(2.2, 0, 3));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    var sc = key.shadow.camera;
    sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 2; sc.far = 60;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
    scene.add(key, key.target);
    var fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.copy(V(16, 14, 10));
    scene.add(fill);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.14 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.005;
    ground.receiveShadow = true;
    scene.add(ground);

    // ----- groups: flip (turn-over) > model (Z up) > moving parts -----
    var flip = new THREE.Group();
    flip.position.y = G.pivotZ;
    scene.add(flip);
    var model = new THREE.Group();
    model.rotation.x = -Math.PI / 2;            // model Z up -> scene +y, model Y -> scene -z
    model.position.y = -G.pivotZ;
    flip.add(model);
    var zMid = (G.rodZ[0] + G.rodZ[1]) / 2;
    function pivotGroup() {
      var outer = new THREE.Group(), inner = new THREE.Group();
      outer.rotation.order = 'ZYX';
      inner.position.z = -zMid;
      outer.add(inner); model.add(outer);
      return { outer: outer, inner: inner };
    }
    var crankG = new THREE.Group(); model.add(crankG);
    var rodP = pivotGroup(), pistonP = pivotGroup();
    var rodG = rodP.inner, pistonG = pistonP.inner;
    var groupOf = { crank: crankG, rod: rodG, piston: pistonG };

    // ----- geometry helpers (model inches) -----
    function rrect(x0, y0, x1, y1, r) {
      var s = new THREE.Shape();
      s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
      s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
      s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
      s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
      return s;
    }
    function circle(x, y, r, cw) { var p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, !!cw); return p; }
    // plan shape extruded straight up from z0 to z1
    function prism(shape, z0, z1, bevel) {
      var bt = bevel || 0;
      var g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0 - 2 * bt, bevelEnabled: bt > 0, bevelSize: bt, bevelThickness: bt,
        bevelSegments: 2, curveSegments: 20 });
      g.translate(0, 0, z0 + bt);
      return g;
    }
    // side profile [[r, z], ...] extruded across the crank (width w, centred)
    function profile(pts, w, bevel) {
      var s = new THREE.Shape(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
      var bt = bevel || 0;
      var g = new THREE.ExtrudeGeometry(s, { depth: w - 2 * bt, bevelEnabled: bt > 0, bevelSize: bt, bevelThickness: bt, bevelSegments: 2 });
      g.rotateX(Math.PI / 2);                  // profile y -> Z, depth -> -Y
      g.translate(0, w / 2 - bt, 0);
      return g;
    }
    function cyl(r, z0, z1, x, y, seg) {
      var g = new THREE.CylinderGeometry(r, r, z1 - z0, seg || 32);
      g.rotateX(Math.PI / 2);
      g.translate(x || 0, y || 0, (z0 + z1) / 2);
      return g;
    }
    function box(x0, x1, y0, y1, z0, z1) {
      var g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      return g;
    }
    // block with a chamfered top edge
    function chamferBlock(x0, x1, y0, y1, z0, z1, c) {
      var zc = z1 - c;
      var P = [
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
        [x0, y0, zc], [x1, y0, zc], [x1, y1, zc], [x0, y1, zc],
        [x0 + c, y0 + c, z1], [x1 - c, y0 + c, z1], [x1 - c, y1 - c, z1], [x0 + c, y1 - c, z1]
      ];
      var quads = [[0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
                   [4, 5, 9, 8], [5, 6, 10, 9], [6, 7, 11, 10], [7, 4, 8, 11], [8, 9, 10, 11]];
      var pos = [];
      quads.forEach(function (q) {
        [[q[0], q[1], q[2]], [q[0], q[2], q[3]]].forEach(function (t) {
          t.forEach(function (k) { pos.push(P[k][0], P[k][1], P[k][2]); });
        });
      });
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    }

    // ----- materials and meshes -----
    var COLORS = {
      collar: 0xe0552e, 'upper-crank': 0xeea44a, 'lower-crank': 0x4f8fdc, rod: 0x5bbf4a, piston: 0x8fd0f2,
      support: 0xd862e2, bracket: 0x7d6ad8, plate: 0xaab1b7, steel: 0xb9bec4
    };
    var meshes = [];
    function add(geo, partId, parent, opts) {
      opts = opts || {};
      var mat = new THREE.MeshStandardMaterial({
        color: opts.color !== undefined ? opts.color : COLORS[partId] || 0x999999,
        roughness: opts.rough !== undefined ? opts.rough : 0.58, metalness: opts.metal || 0,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.partId = partId;
      parent.add(mesh);
      var rec = { mesh: mesh, edges: null, partId: partId, cover: !!opts.cover };
      if (opts.edges !== false) {
        var lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28),
          new THREE.LineBasicMaterial({ color: 0x1c2126, transparent: true, opacity: 0.34 }));
        mesh.add(lines);
        rec.edges = lines;
      }
      meshes.push(rec);
      return mesh;
    }
    var METAL = { color: COLORS.steel, metal: 0.65, rough: 0.34 };
    function metal(extra) { var o = {}; for (var k in METAL) o[k] = METAL[k]; for (k in extra) o[k] = extra[k]; return o; }

    // baseplate with its hole grid
    var P = G.plate;
    var plateShape = new THREE.Shape();
    plateShape.moveTo(P.x[0], P.y[0]); plateShape.lineTo(P.x[1], P.y[0]); plateShape.lineTo(P.x[1], P.y[1]); plateShape.lineTo(P.x[0], P.y[1]); plateShape.closePath();
    P.holesX.forEach(function (hx) { P.holesY.forEach(function (hy) { plateShape.holes.push(circle(hx, hy, P.holeD / 2, true)); }); });
    add(prism(plateShape, 0, P.t), 'base', model, { color: COLORS.plate, metal: 0.45, rough: 0.5 });

    // bracket, its screws, and the washer under the crank
    var B = G.bracket;
    add(chamferBlock(B.x[0], B.x[1], B.y[0], B.y[1], P.t, B.top, B.chamfer), 'bracket', model, { color: COLORS.bracket });
    B.screws.forEach(function (s) {
      add(cyl(0.14, B.top, B.top + 0.07, s[0], s[1], 20), 'base', model, metal({ edges: false }));
    });
    add(cyl(0.62, B.top, B.top + 0.08, 0, 0, 40), 'base', model, metal());

    // ----- the crank: nut and bolt, lower crank, upper crank and handle -----
    add(cyl(0.433, B.top + 0.08, B.top + 0.52, 0, 0, 6), 'base', crankG, metal());
    add(cyl(0.25, B.top + 0.52, 1.95, 0, 0, 24), 'base', crankG, metal({ edges: false }));
    var a = L.a, zr = G.rodZ;
    add(profile([[-0.45, 1.95], [0.45, 1.95], [0.45, 2.5], [a + 0.45, 2.95], [a + 0.45, zr[0]], [a - 0.45, zr[0]], [a - 0.45, 3.1], [-0.45, 2.65]], 0.9, 0.04),
      'lower-crank', crankG);
    var hz = G.handleZ, rIn = L.rIn;
    add(profile([[a - 0.45, zr[1]], [a + 0.45, zr[1]], [a + 0.45, 5.2], [rIn - 0.5, hz[0] - 0.55], [rIn + 0.45, hz[0] - 0.55],
                 [rIn + 0.45, hz[0]], [rIn - 0.45, hz[0]], [a + 0.45, 5.85], [a - 0.45, 5.85]], 0.9, 0.04),
      'upper-crank', crankG);
    add(cyl(0.433, 5.85, 6.13, a, 0, 6), 'base', crankG, metal());
    add(cyl(0.36, hz[0], hz[1], rIn, 0, 36), 'collar', crankG);
    add(cyl(0.4, hz[1], hz[1] + 0.05, rIn, 0, 32), 'base', crankG, metal({ edges: false }));
    add(cyl(0.29, hz[1] + 0.05, hz[1] + 0.3, rIn, 0, 6), 'base', crankG, metal());

    // ----- connecting rod (built along +X from the crank pin) -----
    var b = L.b, R1 = 0.5, R2 = 0.25, w1 = 0.25, w2 = 0.15;
    var a1 = Math.asin(w1 / R1), a2 = Math.asin(w2 / R2);
    var rs = new THREE.Shape();
    rs.moveTo(R1 * Math.cos(a1), w1);
    rs.lineTo(b - R2 * Math.cos(a2), w2);
    rs.absarc(b, 0, R2, Math.PI - a2, -(Math.PI - a2), true);
    rs.lineTo(R1 * Math.cos(a1), -w1);
    rs.absarc(0, 0, R1, -a1, a1, true);
    rs.holes.push(circle(b, 0, 0.1, true));
    add(prism(rs, zr[0], zr[1], 0.02), 'rod', rodG);

    // ----- piston (built around its pin) and pin -----
    var PS = G.piston;
    function prong(z0, z1) {
      var s = new THREE.Shape();
      s.moveTo(0.36, -PS.half); s.lineTo(0, -PS.half);
      s.absarc(0, 0, PS.half, -Math.PI / 2, Math.PI / 2, true);
      s.lineTo(0.36, PS.half); s.closePath();
      s.holes.push(circle(0, 0, 0.1, true));
      return prism(s, z0, z1, 0.015);
    }
    add(box(0.35, PS.front, -PS.half, PS.half, PS.z[0], PS.z[1]), 'piston', pistonG);
    add(prong(PS.z[0], PS.slot[0]), 'piston', pistonG);
    add(prong(PS.slot[1], PS.z[1]), 'piston', pistonG);
    add(cyl(0.095, PS.z[0] + 0.02, PS.pinTop, 0, 0, 20), 'piston', pistonG, metal({ edges: false }));

    // ----- piston support: two legs, a bridge, the track, and a fillet under it -----
    var S = G.support, th = S.trackHalf;
    [1, -1].forEach(function (sgn) {
      var y0 = sgn > 0 ? S.legY[0] : -S.legY[1], y1 = sgn > 0 ? S.legY[1] : -S.legY[0];
      add(prism(rrect(S.legX[0], y0, S.legX[1], y1, 0.22), P.t, S.bridgeBottom + 0.01), 'support', model);
      add(box(S.trackX[0], S.trackX[1], sgn > 0 ? S.slotHalf : -th, sgn > 0 ? th : -S.slotHalf, S.floor[1], S.wallTop), 'support', model);
    });
    add(prism(rrect(S.legX[0], -S.legY[1], S.legX[1], S.legY[1], 0.22), S.bridgeBottom, S.floor[1]), 'support', model);
    add(box(S.trackX[0], S.legX[0] + 0.01, -th, th, S.floor[0], S.floor[1]), 'support', model);
    var fil = new THREE.Shape();
    var fx = S.legX[0] - S.trackX[0], fz = S.floor[0] - 1.9;
    fil.moveTo(S.legX[0], S.floor[0]); fil.lineTo(S.trackX[0], S.floor[0]);
    fil.absellipse(S.trackX[0], 1.9, fx, fz, Math.PI / 2, 0, true);
    fil.closePath();
    var filGeo = new THREE.ExtrudeGeometry(fil, { depth: 2 * th - 0.04, bevelEnabled: false, curveSegments: 24 });
    filGeo.rotateX(Math.PI / 2); filGeo.translate(0, th - 0.02, 0);
    add(filGeo, 'support', model);
    // the revised support's cover, with a slot for the pin
    var coverMeshes = [];
    [1, -1].forEach(function (sgn) {
      var yIn = 0.13, yA = sgn > 0 ? S.slotHalf : -th, yB = sgn > 0 ? th : -S.slotHalf;
      coverMeshes.push(add(box(S.trackX[0] + 0.35, S.trackX[1], yA, yB, S.wallTop, S.coverTop - 0.14), 'support', model, { cover: true }));
      coverMeshes.push(add(box(S.trackX[0] + 0.35, S.trackX[1], sgn > 0 ? yIn : -th, sgn > 0 ? th : -yIn, S.coverTop - 0.14, S.coverTop), 'support', model, { cover: true }));
    });

    // ----- link-length overlay (like Figure 1) -----
    var DIM = 0xe2402a, dimZ = G.rodZ[1] + 0.06;
    var dimMat = new THREE.MeshBasicMaterial({ color: DIM, depthTest: false, transparent: true });
    var dimGroup = new THREE.Group(); dimGroup.visible = false; model.add(dimGroup);
    function dimBar() {
      var m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.055, 0.02), dimMat);
      m.renderOrder = 20; dimGroup.add(m); return m;
    }
    var bars = { a: dimBar(), b: dimBar(), d: dimBar(), r: dimBar() };
    var dotGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 20); dotGeo.rotateX(Math.PI / 2);
    var dots = [0, 1, 2, 3].map(function () { var m = new THREE.Mesh(dotGeo, dimMat); m.renderOrder = 21; dimGroup.add(m); return m; });
    function setBar(m, x0, y0, x1, y1) {
      var len = Math.hypot(x1 - x0, y1 - y0);
      m.scale.x = Math.max(len, 0.001);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, dimZ);
      m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    }
    var dimEls = {};
    Array.prototype.forEach.call(dimWrap.querySelectorAll('.scx-dim'), function (el) { dimEls[el.getAttribute('data-dim')] = el; });
    var dimAnchors = { a: new THREE.Object3D(), b: new THREE.Object3D(), d: new THREE.Object3D(), r: new THREE.Object3D() };
    Object.keys(dimAnchors).forEach(function (k) { dimGroup.add(dimAnchors[k]); });
    dimEls.a.textContent = 'a = ' + L.a + ' in';
    dimEls.b.textContent = 'b = ' + L.b + ' in';
    dimEls.r.textContent = 'r = ' + L.rIn + ' in';

    // ----- markers -----
    var anchors = parts.map(function (pt) {
      var o = new THREE.Object3D();
      o.position.set(pt.marker[0], pt.marker[1], pt.marker[2]);
      ((pt.group && groupOf[pt.group]) || model).add(o);
      return { id: pt.id, obj: o, el: markerWrap.querySelector('.cc3d-marker[data-id="' + pt.id + '"]') };
    });

    // ----- look: selection ghosting, the revised cover -----
    var GLOW = new THREE.Color(0xd9822b), BLACK = new THREE.Color(0x000000);
    function applyLook() {
      meshes.forEach(function (r) {
        r.mesh.visible = !r.cover || state.revised;
        var m = r.mesh.material;
        var sel = state.selected, mine = sel && r.partId === sel;
        var ghost = sel && !mine;
        var op = ghost ? 0.13 : 1;
        m.transparent = op < 1; m.opacity = op; m.depthWrite = op === 1;
        m.emissive.copy(mine ? GLOW : BLACK);
        m.emissiveIntensity = mine ? 0.3 : 0;
        r.mesh.castShadow = op === 1;
        m.needsUpdate = true;
        if (r.edges) r.edges.material.opacity = ghost ? 0.05 : 0.34;
      });
      dirty = true;
    }

    // ----- camera and controls -----
    var orbit = { target: new THREE.Vector3(), az: 0, el: 0, dist: 24, fov: 30 };
    function setFromView(v) {
      orbit.target.copy(V(v.target[0], v.target[1], v.target[2]));
      orbit.az = v.az * DEG; orbit.el = v.el * DEG; orbit.dist = v.dist; orbit.fov = v.fov || 30;
    }
    function placeCamera() {
      var ce = Math.cos(orbit.el);
      camera.position.set(
        orbit.target.x + orbit.dist * ce * Math.sin(orbit.az),
        orbit.target.y + orbit.dist * Math.sin(orbit.el),
        orbit.target.z + orbit.dist * ce * Math.cos(orbit.az));
      camera.lookAt(orbit.target);
      if (camera.fov !== orbit.fov) { camera.fov = orbit.fov; camera.updateProjectionMatrix(); }
      dirty = true;
    }
    var tween = null;
    function goView(name) {
      var v = views[name]; if (!v) return;
      state.view = name;
      Array.prototype.forEach.call(root.querySelectorAll('[data-view]'), function (bt) {
        bt.setAttribute('aria-pressed', bt.getAttribute('data-view') === name ? 'true' : 'false');
      });
      if (name === 'top' && !state.dims) { setDims(true); state.autoDims = true; }
      else if (name !== 'top' && state.autoDims) { setDims(false); }
      if (state.flipped) { frameFor(true); return; }
      var from = { t: orbit.target.clone(), az: orbit.az, el: orbit.el, dist: orbit.dist, fov: orbit.fov };
      var to = { t: V(v.target[0], v.target[1], v.target[2]), az: v.az * DEG, el: v.el * DEG, dist: v.dist, fov: v.fov || 30 };
      var dAz = Math.atan2(Math.sin(to.az - from.az), Math.cos(to.az - from.az));
      if (REDUCE) { setFromView(v); placeCamera(); return; }
      tween = { from: from, to: to, dAz: dAz, t0: performance.now(), dur: 750 };
    }
    function stepTween(now) {
      if (!tween) return;
      var t = clamp((now - tween.t0) / tween.dur, 0, 1), e = ease(t);
      orbit.target.lerpVectors(tween.from.t, tween.to.t, e);
      orbit.az = tween.from.az + tween.dAz * e;
      orbit.el = tween.from.el + (tween.to.el - tween.from.el) * e;
      orbit.dist = tween.from.dist + (tween.to.dist - tween.from.dist) * e;
      orbit.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e;
      placeCamera();
      if (t >= 1) tween = null;
    }
    function markCustom() {
      tween = null;
      if (state.view) {
        state.view = null;
        Array.prototype.forEach.call(root.querySelectorAll('[data-view]'), function (bt) { bt.setAttribute('aria-pressed', 'false'); });
      }
    }

    canvas.style.touchAction = 'pan-y';
    var ptrs = {}, nPtr = 0, moved = 0, pinch0 = 0, dist0 = 0, mode = 'rotate';
    function ptrDist() {
      var k = Object.keys(ptrs); if (k.length < 2) return 0;
      var p = ptrs[k[0]], q = ptrs[k[1]]; return Math.hypot(p.x - q.x, p.y - q.y);
    }
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; nPtr++;
      if (nPtr === 1) { moved = 0; mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate'; }
      if (nPtr === 2) { pinch0 = ptrDist(); dist0 = orbit.dist; }
    });
    canvas.addEventListener('pointermove', function (e) {
      var p0 = ptrs[e.pointerId]; if (!p0) return;
      var dx = e.clientX - p0.x, dy = e.clientY - p0.y;
      p0.x = e.clientX; p0.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (nPtr === 2) {
        var dnow = ptrDist(); if (pinch0 > 0 && dnow > 0) { orbit.dist = clamp(dist0 * pinch0 / dnow, 8, 90); markCustom(); placeCamera(); }
        return;
      }
      if (moved < 3) return;
      markCustom();
      if (mode === 'pan') {
        var right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        var up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        var sPan = orbit.dist * 0.0016;
        orbit.target.addScaledVector(right, -dx * sPan).addScaledVector(up, dy * sPan);
      } else {
        orbit.az -= dx * 0.0085;
        orbit.el = clamp(orbit.el + dy * 0.0075, -0.05, 1.55);
      }
      placeCamera();
    });
    function endPtr(e) {
      if (!ptrs[e.pointerId]) return;
      delete ptrs[e.pointerId]; nPtr = Math.max(0, nPtr - 1);
      if (nPtr === 0 && moved < 5 && e.type === 'pointerup') pick(e);
    }
    canvas.addEventListener('pointerup', endPtr);
    canvas.addEventListener('pointercancel', endPtr);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.0011), 8, 90);
      markCustom(); placeCamera();
    }, { passive: false });

    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var pickables = meshes.map(function (r) { return r.mesh; });
    function hitsAt(e) {
      var rc = canvas.getBoundingClientRect();
      ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(pickables, false).filter(function (h) {
        return h.object.visible && h.object.userData.partId && (h.object.material.opacity > 0.5 || h.object.userData.partId === state.selected);
      });
    }
    function pick(e) {
      var hits = hitsAt(e);
      if (!hits.length) { if (state.selected) select(null); return; }
      var id = hits[0].object.userData.partId;
      select(state.selected === id ? null : id);
    }
    canvas.addEventListener('pointermove', function (e) {
      if (nPtr) return;
      canvas.style.cursor = hitsAt(e).length ? 'pointer' : 'grab';
    });

    // ----- sizing -----
    var W = 0, H = 0;
    function resize() {
      var w = viewer.clientWidth, h = viewer.clientHeight;
      if (!w || !h || (w === W && h === H)) return;
      W = w; H = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(viewer);
    window.addEventListener('resize', resize);

    // ----- the upside-down test -----
    // anim.flip: 0 upright .. 1 upside down; anim.drop: 0 in the track .. 1 fallen out
    var anim = { flip: 0, drop: 0 };
    var goals = { flip: 0, drop: 0 };
    var RATE = { flip: 1 / 1.1, drop: 1 / 0.55 };
    var queue = [];
    var wasPlaying = false;
    function say(key) {
      var msg = key ? D.test.messages[key] : '';
      var tag = key ? (D.test.tags[key] || msg) : '';
      resultEl.textContent = msg || '';
      phaseEl.textContent = tag || '';
      phaseEl.hidden = !tag;
    }
    // keep the model framed when it turns over (only from the preset views)
    function frameFor(flipped) {
      var name = state.view;
      if (!name || !views[name]) return;
      var v = views[name], t = v.target;
      var fv = { label: v.label, target: [t[0], t[1], flipped ? G.pivotZ : t[2]], az: v.az,
                 el: flipped && v.flipEl !== undefined ? v.flipEl : v.el, dist: v.dist * (flipped ? 1.12 : 1), fov: v.fov };
      var from = { t: orbit.target.clone(), az: orbit.az, el: orbit.el, dist: orbit.dist, fov: orbit.fov };
      var to = { t: V(fv.target[0], fv.target[1], fv.target[2]), az: fv.az * DEG, el: fv.el * DEG, dist: fv.dist, fov: fv.fov || 30 };
      if (REDUCE) { setFromView(fv); placeCamera(); return; }
      tween = { from: from, to: to, dAz: Math.atan2(Math.sin(to.az - from.az), Math.cos(to.az - from.az)), t0: performance.now(), dur: 1100 };
    }
    function moveTo(prop, v, then) {
      goals[prop] = v;
      if (REDUCE) { anim[prop] = v; applyAnim(); if (then) then(); return; }
      queue.push({ prop: prop, then: then });
      dirty = true; kickLoop();
    }
    function settle() {
      // called once nothing is moving: decide what the mechanism does next
      state.busy = false;
      if (state.flipped && !state.revised) { say('fails'); }
      else if (state.flipped && state.revised) { say('works'); if (!REDUCE) explorer.setPlaying(true); }
      else { say(state.revised ? 'revised' : (state.wasFlipped ? 'upright' : '')); if (state.wasFlipped && wasPlaying && !REDUCE) explorer.setPlaying(true); }
      state.wasFlipped = state.flipped;
      updateTestButtons();
    }
    function sequence(steps) {
      // run [prop, value] steps one after another, then settle
      state.busy = true;
      updateTestButtons();
      var i = 0;
      (function next() {
        if (i >= steps.length) { settle(); return; }
        var s = steps[i++];
        if (typeof s === 'function') { s(); next(); return; }
        if (Math.abs(anim[s[0]] - s[1]) < 1e-6) { next(); return; }
        moveTo(s[0], s[1], next);
      })();
    }
    function doFlip(on) {
      if (state.busy || on === state.flipped) return;
      if (on) {
        wasPlaying = explorer.snapshot().playing;
        state.flipped = true;
        explorer.setPlaying(false);
        say('turning');
        frameFor(true);
        sequence([['flip', 1], ['drop', state.revised ? 0 : 1]]);
      } else {
        state.flipped = false;
        explorer.setPlaying(false);
        say('turning');
        sequence([['drop', 0], function () { frameFor(false); }, ['flip', 0]]);
      }
    }
    function doSupport(revised) {
      if (state.busy || revised === state.revised) return;
      state.revised = revised;
      applyLook();
      if (state.flipped) {
        if (revised) sequence([['drop', 0]]);
        else { explorer.setPlaying(false); sequence([['drop', 1]]); }
      } else { say(revised ? 'revised' : ''); updateTestButtons(); }
    }
    function updateTestButtons() {
      var fb = root.querySelector('[data-act="flip"]');
      fb.setAttribute('aria-pressed', state.flipped ? 'true' : 'false');
      fb.textContent = state.flipped ? 'Turn it back over' : 'Turn it upside down';
      Array.prototype.forEach.call(root.querySelectorAll('[data-support]'), function (bt) {
        bt.setAttribute('aria-pressed', (bt.getAttribute('data-support') === 'revised') === state.revised ? 'true' : 'false');
      });
      testEl.classList.toggle('is-busy', state.busy);
    }
    function stepAnim(dt) {
      if (!queue.length) return false;
      var q = queue[0], p = q.prop;
      var dir = goals[p] > anim[p] ? 1 : -1;
      anim[p] = clamp(anim[p] + dir * RATE[p] * dt, Math.min(anim[p], goals[p]), Math.max(anim[p], goals[p]));
      applyAnim();
      if (Math.abs(anim[p] - goals[p]) < 1e-6) { queue.shift(); if (q.then) q.then(); }
      return true;
    }
    function applyAnim() {
      flip.rotation.x = Math.PI * ease(anim.flip);
      pose(explorer.snapshot());
    }

    // ----- pose from the clock -----
    var dirty = true;
    function pose(s) {
      var k = s.kin;
      crankG.rotation.z = k.theta * DEG;
      var f = ease(anim.drop), drop = G.drop * f;
      var tilt = -Math.asin(clamp(drop / L.b, 0, 0.5));
      var ph = k.phi * DEG, ct = Math.cos(tilt);
      rodP.outer.position.set(k.ax, k.ay, zMid);
      rodP.outer.rotation.set(0, tilt, ph);
      pistonP.outer.position.set(k.ax + L.b * ct * Math.cos(ph), k.ay + L.b * ct * Math.sin(ph), zMid + drop);
      pistonP.outer.rotation.set(0, tilt, f * G.dropYaw * DEG);   // out of the track, it hangs askew on its pin
      // link-length overlay
      if (dimGroup.visible) {
        var hx = L.rIn * Math.cos(k.theta * DEG), hy = L.rIn * Math.sin(k.theta * DEG);
        setBar(bars.r, 0, 0, hx, hy);
        setBar(bars.a, 0, 0, k.ax, k.ay);
        setBar(bars.b, k.ax, k.ay, k.d, 0);
        setBar(bars.d, 0, -0.0, k.d, 0);
        bars.d.position.z = dimZ - 0.01;
        [[0, 0], [k.ax, k.ay], [k.d, 0], [hx, hy]].forEach(function (p, i) { dots[i].position.set(p[0], p[1], dimZ); });
        var nx = -Math.sin(k.theta * DEG), ny = Math.cos(k.theta * DEG);
        dimAnchors.a.position.set(-0.95, k.ay > 0 ? -0.05 : 0.05, dimZ);       // left of the axis, as in Figure 1
        dimAnchors.r.position.set(hx * 0.72 + nx * 0.4, hy * 0.72 + ny * 0.4, dimZ);
        dimAnchors.b.position.set((k.ax + k.d) / 2, (k.ay) / 2 + 0.32, dimZ);
        dimAnchors.d.position.set(k.d / 2, -0.34, dimZ);
        dimEls.d.textContent = 'd = ' + k.d.toFixed(2) + ' in';
      }
      dirty = true;
    }
    function showDims(on) { dimGroup.visible = on; dimWrap.hidden = !on; pose(explorer.snapshot()); }

    // ----- render loop (only while on screen) -----
    var onScreen = true, rafId = 0, lastT = 0, vtmp = new THREE.Vector3();
    function project(obj, el) {
      obj.getWorldPosition(vtmp);
      vtmp.project(camera);
      el.style.transform = 'translate(' + ((vtmp.x + 1) / 2 * W).toFixed(1) + 'px,' + ((1 - vtmp.y) / 2 * H).toFixed(1) + 'px)';
      el.style.visibility = vtmp.z > 1 ? 'hidden' : '';
    }
    function updateOverlays() {
      anchors.forEach(function (an) { project(an.obj, an.el); });
      if (dimGroup.visible) Object.keys(dimAnchors).forEach(function (kk) { project(dimAnchors[kk], dimEls[kk]); });
    }
    function frame(now) {
      rafId = 0;
      var dt = lastT ? Math.min((now - lastT) / 1000, 0.1) : 0;
      lastT = now;
      stepTween(now);
      var moving = stepAnim(dt);
      if (dirty) {
        resize();
        renderer.render(scene, camera);
        updateOverlays();
        dirty = false;
      }
      if (onScreen || moving) rafId = requestAnimationFrame(frame);
      else lastT = 0;
    }
    function kickLoop() { if (!rafId) { lastT = 0; rafId = requestAnimationFrame(frame); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        if (onScreen) { dirty = true; kickLoop(); }
      }, { rootMargin: '100px' }).observe(stage);
    }

    setFromView(views.overview);
    placeCamera();
    resize();
    api3d = { applyLook: applyLook, goView: goView, showDims: showDims, flip: doFlip, support: doSupport };
    applyLook();
    explorer.onFrame(pose);
    updateTestButtons();

    statusEl.hidden = true;
    markerWrap.hidden = false;
    testEl.hidden = false;
    root.querySelector('.cc3d-tools').hidden = false;
    root.querySelector('.sc3d-hint').hidden = false;
    stage.classList.add('is-ready');
    kickLoop();

    // test / screenshot hook
    window.__sliderCrank3D = { renderer: renderer, scene: scene, camera: camera, goView: goView, orbit: orbit, place: placeCamera,
      setView: function (v) { setFromView(v); placeCamera(); }, explorer: explorer, select: select, setDims: setDims,
      flip: doFlip, support: doSupport, anim: anim, state: state };
  }
})();
