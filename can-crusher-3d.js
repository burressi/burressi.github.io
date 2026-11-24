/* ==========================================================
   Mechanical can crusher 3D explorer (case study page)
   Plain JavaScript. three.js (0.186.1, loaded on demand from jsDelivr)
   draws the ten printed parts from models/can-crusher-parts.js, plus
   stand-in gears, wrist pin, mounting board and a can.
   linkage-explorer.js owns the clock: every crank angle it reports
   moves the handle, gears, crank, rod and ram, and crushes, ejects and
   reloads the can. All text lives in can-crusher-data.js.
   The parts list, readouts, diagram and charts still work if the 3D
   view cannot load.
   ========================================================== */
(function () {
  'use strict';

  var D = window.CAN_CRUSHER, G = window.CAN_CRUSHER_PARTS, LX = window.LinkageExplorer;
  var root = document.getElementById('crusher-explorer');
  var kinRoot = document.getElementById('crusher-kinematics');
  if (!D || !root || !LX) return;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEG = Math.PI / 180;
  var L = D.linkage, C = D.cad;

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

  // ---------- the crusher cycle, from the linkage model ----------
  var M = LX.model(L);
  var d0 = M.at(C.theta0).d;
  var phi0 = M.at(C.theta0).phi;
  var L0 = D.can.length, R0 = D.can.diameter / 2;
  function ramFace(d) { return C.ramFace0 + (d - d0); }
  function gapAt(k) { return C.endWall - ramFace(k.d); }
  var gapMin = C.endWall - ramFace(M.dmax);
  var psiTDC = M.outStroke;
  function thAt(psi) { return M.thFold + psi; }
  var psiContact = 0, psiDrop = psiTDC;
  for (var p = 0; p <= psiTDC; p += 0.25) { if (gapAt(M.at(thAt(p))) <= L0) { psiContact = p; break; } }
  for (p = psiTDC; p < 360; p += 0.25) { if (gapAt(M.at(thAt(p))) - gapMin > 0.1) { psiDrop = p; break; } }
  var DROP_SPAN = 45;

  function canState(s) {
    if (s.dwellT !== null && s.dwellT !== undefined) {
      var t = clamp(s.dwellT / 0.7, 0, 1);
      return { show: true, L: L0, y: 4.4 * (1 - t * t), alpha: 1, phase: 'Loading a can' };
    }
    var g = gapAt(s.kin);
    if (s.psi <= psiTDC + 1e-6) {
      var touching = g <= L0;
      return { show: true, L: Math.min(L0, g), y: 0, alpha: 1, phase: touching ? 'Crushing' : 'Ram moving up to the can' };
    }
    var f = clamp((s.psi - psiDrop) / DROP_SPAN, 0, 1);
    if (f >= 1) return { show: false, phase: 'Ram returning' };
    var y = -4.6 * f * f;
    return { show: true, L: gapMin, y: y, alpha: y < -0.9 ? clamp(1 - (-y - 0.9) / 3, 0, 1) : 1,
             phase: s.psi < psiDrop ? 'Ram pulling back' : 'Flattened can drops out' };
  }

  // ---------- markup ----------
  var parts = D.parts;
  parts.forEach(function (pt, i) { pt.n = i + 1; });
  var views = D.views;
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

  root.innerHTML =
    '<div class="sc3d-stage cc3d-stage">' +
      '<div class="sc3d-viewer cc3d-viewer" role="img" aria-label="Interactive 3D model of the can crusher. A handle drives a pair of gears and a crank, and a connecting rod pushes a ram that flattens a can against the end of a channel."></div>' +
      '<div class="cc3d-markers" hidden>' + markers + '</div>' +
      '<p class="sc3d-status" role="status">Loading the 3D model&hellip;</p>' +
      '<p class="cc3d-phase" aria-hidden="true" hidden></p>' +
      '<div class="sc3d-tools cc3d-tools" hidden>' + viewBtns +
        '<button type="button" class="sc3d-tool" data-act="xray" aria-pressed="false">See-through housing</button>' +
      '</div>' +
      '<p class="sc3d-hint" hidden>Drag to rotate &middot; scroll or pinch to zoom &middot; click a part</p>' +
    '</div>' +
    '<div class="cc3d-transport"></div>' +
    '<div class="cc3d-readouts"></div>' +
    '<div class="sc3d-chips" role="group" aria-label="Crusher parts">' + chips + '</div>' +
    '<div class="sc3d-panel" aria-live="polite"></div>' +
    (D.note ? '<p class="sc3d-note">' + esc(D.note) + '</p>' : '');

  var stage = root.querySelector('.cc3d-stage');
  var viewer = root.querySelector('.cc3d-viewer');
  var statusEl = root.querySelector('.sc3d-status');
  var phaseEl = root.querySelector('.cc3d-phase');
  var panel = root.querySelector('.sc3d-panel');
  var markerWrap = root.querySelector('.cc3d-markers');

  var kin = {};
  if (kinRoot) {
    kinRoot.innerHTML =
      '<div class="cc3d-kin-transport"></div>' +
      '<div class="mx-kin"><div class="mx-schematic"></div><div class="mx-charts-host"></div></div>';
    kin.transport = kinRoot.querySelector('.cc3d-kin-transport');
    kin.schematic = kinRoot.querySelector('.mx-schematic');
    kin.charts = kinRoot.querySelector('.mx-charts-host');
  }

  // ---------- the shared clock, readouts, diagram and charts ----------
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  var explorer = LX.create({
    linkage: L,
    period: 4.4,
    dwell: 1.2,
    startInDwell: true,
    autoplay: true,
    angleLabel: 'Crank angle',
    mounts: {
      transport: [root.querySelector('.cc3d-transport'), kin.transport],
      readouts: root.querySelector('.cc3d-readouts'),
      schematic: kin.schematic,
      charts: kin.charts
    },
    readouts: [
      { key: 'theta', label: 'Crank angle' },
      { key: 'travel', label: 'Ram travel' },
      { key: 'ddot', label: 'Ram speed', note: 'at 5 rad/s' },
      { key: 'mu', label: 'Transmission angle' },
      { key: 'ma', label: 'Mechanical advantage', note: 'handle to ram' },
      { key: 'hand', label: 'Hand force', note: 'for 112 lbf' }
    ],
    charts: [
      { key: 'd', title: 'Ram position, d (in)', fmt: function (v) { return v.toFixed(2) + ' in'; } },
      { key: 'ddot', title: 'Ram velocity at 5 rad/s (in/s)', fmt: function (v) { return f1(v) + ' in/s'; } },
      { key: 'mu', title: 'Transmission angle (\u00b0)', min: 0, max: 90, guide: 40, guideLabel: '40\u00b0 guideline',
        fmt: function (v) { return f1(v) + '\u00b0'; } },
      { key: 'ma', title: 'Mechanical advantage, handle to ram', min: 0, max: 40,
        fmt: function (v) { return !isFinite(v) || v >= 100 ? '100+ : 1' : f1(v) + ' : 1'; } }
    ],
    contact: function (k, psi) { return psi <= psiTDC + 1e-6 && gapAt(k) <= L0 + 1e-6; },
    contactLabel: 'Shaded: the ram is crushing the can (for the can shown in the model)'
  });
  explorer.watch(root.querySelector('.cc3d-stage'));

  // ---------- parts list and details panel ----------
  var state = { selected: null, xray: false, view: 'overview' };
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
    var xb = e.target.closest('[data-act="xray"]');
    if (xb && api3d) { setXray(!state.xray); }
  });
  function setXray(on) {
    state.xray = on;
    var b = root.querySelector('[data-act="xray"]');
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (api3d) api3d.applyLook();
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
      img.alt = 'Rendering of the can crusher 3D model';
      img.onerror = function () { img.remove(); };
      stage.insertBefore(img, stage.firstChild);
    }
    var m = document.createElement('span');
    m.className = 'cc3d-fail-msg';
    m.textContent = msg + ' The parts list, readouts and charts below still work.';
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
    if (!G || !G.data) { fail('The 3D model file did not load.'); return; }
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
    function V(X, Y, Z) { return new THREE.Vector3(X, Z, -Y); }   // CAD inches -> scene

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

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b4, 1.55));
    var key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.copy(V(-2, -10, 24));
    key.target.position.copy(V(6.5, 5.6, 1.5));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    var sc = key.shadow.camera;
    sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 2; sc.far = 70;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
    scene.add(key, key.target);
    var fill = new THREE.DirectionalLight(0xffffff, 0.75);
    fill.position.copy(V(22, 20, 10));
    scene.add(fill);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.14 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.45;
    ground.receiveShadow = true;
    scene.add(ground);

    // ----- groups that move -----
    function pivot(X, Z) {
      var outer = new THREE.Group(), inner = new THREE.Group();
      outer.position.set(X, Z, 0); inner.position.set(-X, -Z, 0);
      outer.add(inner); scene.add(outer);
      return { outer: outer, inner: inner };
    }
    var crank = pivot(C.crankAxis[0], C.crankAxis[1]);
    var pin = pivot(C.pinionAxis[0], C.pinionAxis[1]);
    var A0 = { x: C.crankAxis[0] + M.at(C.theta0).ax, y: C.crankAxis[1] + M.at(C.theta0).ay };
    var rod = pivot(A0.x, A0.y);
    var ram = { outer: new THREE.Group() }; ram.inner = ram.outer; scene.add(ram.outer);
    var fixed = { inner: scene };
    var groupOf = { crank: crank, pinion: pin, rod: rod, ram: ram };

    // ----- materials -----
    var COLORS = {
      'housing': 0xa7adb3, 'crusher': 0x5b86ad, 'connecting-rod': 0x3f8f6a, 'crank-male': 0xd9822b, 'crank-female': 0xd9822b,
      'crank-support': 0x6d747d, 'crank-support-top': 0x6d747d, 'gear-support': 0x6d747d, 'handle': 0x3a3f45,
      'handle-collar': 0xb8382c, 'gear': 0xb59a5e, 'pinion': 0xb59a5e, 'wrist-pin': 0xc9ced3, 'board': 0xdcc6a0
    };
    var meshes = [];          // {mesh, edges, partId, baseColor, metal}
    var partOfMesh = {};
    parts.forEach(function (pt) { pt.meshes.forEach(function (m) { partOfMesh[m] = pt.id; }); });

    function addMesh(geo, meshId, parent, opts) {
      opts = opts || {};
      var mat = new THREE.MeshStandardMaterial({
        color: COLORS[meshId] || 0x999999, roughness: opts.rough !== undefined ? opts.rough : 0.62,
        metalness: opts.metal || 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.partId = partOfMesh[meshId] || null;
      parent.add(mesh);
      var rec = { mesh: mesh, edges: null, partId: mesh.userData.partId, id: meshId };
      if (opts.edges) {
        var lm = new THREE.LineBasicMaterial({ color: 0x1c2126, transparent: true, opacity: 0.38 });
        var lines = new THREE.LineSegments(opts.edges, lm);
        mesh.add(lines);
        rec.edges = lines;
      }
      meshes.push(rec);
      return mesh;
    }

    // ----- printed parts from the STL package -----
    var bin = atob(G.data), buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    var ab = buf.buffer;
    var where = {
      'crank-male': crank, 'crank-female': crank, 'handle': pin, 'handle-collar': pin,
      'connecting-rod': rod, 'crusher': ram
    };
    var geoById = {};
    G.parts.forEach(function (pp) {
      var off = pp.offset;
      var q = new Uint16Array(ab, off, pp.nv * 3); off += pp.nv * 6;
      var n8 = new Int8Array(ab, off, pp.nv * 3); off += pp.nv * 3; if (off % 2) off += 1;
      var idx = new Uint16Array(ab, off, pp.ni); off += pp.ni * 2;
      var eidx = new Uint16Array(ab, off, pp.ne);
      var pos = new Float32Array(pp.nv * 3), nrm = new Float32Array(pp.nv * 3);
      for (var j = 0; j < pp.nv * 3; j++) {
        var c = j % 3;
        pos[j] = pp.min[c] + q[j] / 65535 * pp.span[c];
        nrm[j] = n8[j] / 127;
      }
      var g = new THREE.BufferGeometry();
      var pa = new THREE.BufferAttribute(pos, 3);
      g.setAttribute('position', pa);
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
      g.computeBoundingSphere();
      var eg = new THREE.BufferGeometry();
      eg.setAttribute('position', pa);
      eg.setIndex(new THREE.BufferAttribute(new Uint16Array(eidx), 1));
      geoById[pp.id] = { g: g, e: eg };
      addMesh(g, pp.id, (where[pp.id] || fixed).inner, { edges: eg });
    });
    // the second crank support and cap: same prints, mirrored position on the other journal
    ['crank-support', 'crank-support-top'].forEach(function (id) {
      if (!geoById[id]) return;
      var m = addMesh(geoById[id].g, id, scene, { edges: geoById[id].e });
      m.position.z = 3.6;                 // CAD Y 7.55-8.05 -> 3.95-4.45
      meshes[meshes.length - 1].id = id + '-2';
      m.userData.partId = partOfMesh[id + '-2'] || partOfMesh[id];
      meshes[meshes.length - 1].partId = m.userData.partId;
    });

    // ----- stand-ins: gears, wrist pin, board -----
    function gearShape(teeth, pd, bore, phase) {
      var P = teeth / pd, rp = pd / 2, ro = rp + 1 / P, rr = rp - 1.25 / P;
      var pitch = 2 * Math.PI / teeth;
      var s = new THREE.Shape();
      for (var t = 0; t < teeth; t++) {
        var c0 = phase + t * pitch;
        var pts = [
          [rr, c0 - pitch / 2], [rr, c0 - pitch * 0.30], [rp, c0 - pitch * 0.25],
          [ro, c0 - pitch * 0.15], [ro, c0 + pitch * 0.15], [rp, c0 + pitch * 0.25], [rr, c0 + pitch * 0.30]
        ];
        pts.forEach(function (pq, k) {
          var x = pq[0] * Math.cos(pq[1]), y = pq[0] * Math.sin(pq[1]);
          if (t === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
        });
      }
      s.closePath();
      var hole = new THREE.Path();
      hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
      s.holes.push(hole);
      return s;
    }
    var face = C.gearY[1] - C.gearY[0];
    var gearGeo = new THREE.ExtrudeGeometry(gearShape(24, 2.4, 0.26, 0), { depth: face, bevelEnabled: false, curveSegments: 6 });
    var gear = addMesh(gearGeo, 'gear', crank.outer, { metal: 0.55, rough: 0.38, edges: new THREE.EdgesGeometry(gearGeo, 30) });
    gear.position.z = -C.gearY[1];
    var hubGeo = new THREE.CylinderGeometry(0.42, 0.42, 3.85 - C.gearY[1], 28);
    hubGeo.rotateX(Math.PI / 2);
    var hub = addMesh(hubGeo, 'gear', crank.outer, { metal: 0.55, rough: 0.38 });
    hub.position.z = -(C.gearY[1] + 3.85) / 2;
    var pinGeo = new THREE.ExtrudeGeometry(gearShape(12, 1.2, 0.19, Math.PI / 12), { depth: face, bevelEnabled: false, curveSegments: 6 });
    var pinion = addMesh(pinGeo, 'pinion', pin.outer, { metal: 0.55, rough: 0.38, edges: new THREE.EdgesGeometry(pinGeo, 30) });
    pinion.position.z = -C.gearY[1];

    var wpGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.36, 20);
    wpGeo.rotateX(Math.PI / 2);
    var wp = addMesh(wpGeo, 'wrist-pin', ram.outer, { metal: 0.7, rough: 0.3 });
    wp.position.copy(V(C.ramFace0 - 1.6005, C.channelY, C.crankAxis[1] - L.c));

    var bs = new THREE.Shape();
    bs.moveTo(0.4, 2.6); bs.lineTo(12.4, 2.6); bs.lineTo(12.4, 8.6); bs.lineTo(0.4, 8.6); bs.closePath();
    var bh = new THREE.Path();
    bh.moveTo(C.slot[0], C.channelY - C.channelHalf); bh.lineTo(C.slot[0], C.channelY + C.channelHalf);
    bh.lineTo(C.slot[1], C.channelY + C.channelHalf); bh.lineTo(C.slot[1], C.channelY - C.channelHalf); bh.closePath();
    bs.holes.push(bh);
    var boardGeo = new THREE.ExtrudeGeometry(bs, { depth: C.boardTop, bevelEnabled: false });
    boardGeo.rotateX(-Math.PI / 2);
    addMesh(boardGeo, 'board', scene, { rough: 0.85, edges: new THREE.EdgesGeometry(boardGeo, 30) });

    // ----- the can -----
    var NU = 44, NV = 40, nBody = (NV + 1) * NU;
    var canPos = new Float32Array((nBody + 2) * 3), canCol = new Float32Array((nBody + 2) * 3);
    var canIdx = [];
    for (var j2 = 0; j2 < NV; j2++) {
      for (var u = 0; u < NU; u++) {
        var a1 = j2 * NU + u, b1 = j2 * NU + (u + 1) % NU, c1 = (j2 + 1) * NU + u, e1 = (j2 + 1) * NU + (u + 1) % NU;
        canIdx.push(a1, c1, b1, b1, c1, e1);
      }
    }
    for (u = 0; u < NU; u++) {
      canIdx.push(nBody, (u + 1) % NU, u);
      canIdx.push(nBody + 1, NV * NU + u, NV * NU + (u + 1) % NU);
    }
    var ALU = [0.80, 0.82, 0.84], BODY = [0.07, 0.33, 0.25], STRIPE = [0.93, 0.93, 0.90];
    function canColor(v) {
      if (v < 0.075 || v > 0.925) return ALU;
      if ((v > 0.30 && v < 0.335) || (v > 0.665 && v < 0.70)) return STRIPE;
      return BODY;
    }
    for (j2 = 0; j2 <= NV; j2++) {
      var cc = canColor(j2 / NV);
      for (u = 0; u < NU; u++) { var o = (j2 * NU + u) * 3; canCol[o] = cc[0]; canCol[o + 1] = cc[1]; canCol[o + 2] = cc[2]; }
    }
    for (var e2 = 0; e2 < 2; e2++) { var o2 = (nBody + e2) * 3; canCol[o2] = ALU[0]; canCol[o2 + 1] = ALU[1]; canCol[o2 + 2] = ALU[2]; }
    var canGeo = new THREE.BufferGeometry();
    canGeo.setAttribute('position', new THREE.BufferAttribute(canPos, 3));
    canGeo.setAttribute('color', new THREE.BufferAttribute(canCol, 3));
    canGeo.setIndex(canIdx);
    var canMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.34, side: THREE.DoubleSide });
    var can = new THREE.Mesh(canGeo, canMat);
    can.castShadow = true; can.receiveShadow = true;
    scene.add(can);
    var lastCan = { L: -1 };
    function profile(v) {                          // rest radius along the can: necked ends, straight body
      if (v < 0.07) return R0 * (0.86 + 0.14 * smooth(0, 0.07, v));
      if (v > 0.93) return R0 * (0.86 + 0.14 * smooth(1, 0.93, v));
      return R0;
    }
    function shapeCan(Lc) {
      if (Math.abs(Lc - lastCan.L) < 1e-4) return;
      lastCan.L = Lc;
      var k = clamp(1 - Lc / L0, 0, 1);
      var x0 = C.endWall - Lc, zc = -C.channelY, half = C.channelHalf - 0.02;
      for (var jj = 0; jj <= NV; jj++) {
        var v = jj / NV;
        var x = x0 + v * Lc;
        var env = smooth(0, 0.1, v) * smooth(1, 0.9, v);
        var rr = profile(v) * (1 + env * k * (0.16 + 0.26 * Math.cos(2 * Math.PI * 6.5 * v)));
        var yc = C.floorTop + rr;                      // sits on the floor, bulges upward
        for (var uu = 0; uu < NU; uu++) {
          var ang = uu / NU * Math.PI * 2;
          var r = rr * (1 + env * k * 0.07 * Math.sin(3 * ang + 9 * v));
          var o = (jj * NU + uu) * 3;
          canPos[o] = x + env * k * 0.04 * Math.sin(2 * ang + 5 * v);
          canPos[o + 1] = yc + r * Math.cos(ang);
          canPos[o + 2] = zc + clamp(r * Math.sin(ang), -half, half);
        }
      }
      var inset = 0.07 * (1 - k);
      canPos[nBody * 3] = x0 + inset; canPos[nBody * 3 + 1] = C.floorTop + profile(0); canPos[nBody * 3 + 2] = zc;
      canPos[(nBody + 1) * 3] = x0 + Lc - inset; canPos[(nBody + 1) * 3 + 1] = C.floorTop + profile(1); canPos[(nBody + 1) * 3 + 2] = zc;
      canGeo.attributes.position.needsUpdate = true;
      canGeo.computeVertexNormals();
      canGeo.computeBoundingSphere();
    }
    shapeCan(L0);

    // ----- markers -----
    var anchors = parts.map(function (pt) {
      var o = new THREE.Object3D();
      o.position.copy(V(pt.marker[0], pt.marker[1], pt.marker[2]));
      ((pt.group && groupOf[pt.group]) || fixed).inner.add(o);
      return { id: pt.id, obj: o, el: markerWrap.querySelector('.cc3d-marker[data-id="' + pt.id + '"]') };
    });

    // ----- look: selection ghosting and see-through housing -----
    var GLOW = new THREE.Color(0xd9822b);
    function applyLook() {
      meshes.forEach(function (r) {
        var m = r.mesh.material;
        var sel = state.selected, mine = sel && r.partId === sel;
        var ghost = sel && !mine;
        var xr = state.xray && r.id === 'housing' && !mine;
        var op = ghost ? 0.13 : xr ? 0.26 : 1;
        m.transparent = op < 1; m.opacity = op; m.depthWrite = op === 1;
        m.emissive.copy(mine ? GLOW : new THREE.Color(0x000000));
        m.emissiveIntensity = mine ? 0.32 : 0;
        r.mesh.castShadow = op === 1;
        m.needsUpdate = true;
        if (r.edges) { r.edges.material.opacity = ghost ? 0.05 : xr ? 0.18 : 0.38; }
      });
      dirty = true;
    }

    // ----- camera and controls -----
    var orbit = { target: new THREE.Vector3(), az: 0, el: 0, dist: 20 };
    function setFromView(v) {
      orbit.target.copy(V(v.target[0], v.target[1], v.target[2]));
      orbit.az = v.az * DEG; orbit.el = v.el * DEG; orbit.dist = v.dist;
    }
    function placeCamera() {
      var ce = Math.cos(orbit.el);
      camera.position.set(
        orbit.target.x + orbit.dist * ce * Math.sin(orbit.az),
        orbit.target.y + orbit.dist * Math.sin(orbit.el),
        orbit.target.z + orbit.dist * ce * Math.cos(orbit.az));
      camera.lookAt(orbit.target);
      dirty = true;
    }
    var tween = null;
    function goView(name) {
      var v = views[name]; if (!v) return;
      state.view = name;
      Array.prototype.forEach.call(root.querySelectorAll('[data-view]'), function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-view') === name ? 'true' : 'false');
      });
      if (name === 'side' && !state.xray) setXray(true);
      var from = { t: orbit.target.clone(), az: orbit.az, el: orbit.el, dist: orbit.dist };
      var to = { t: V(v.target[0], v.target[1], v.target[2]), az: v.az * DEG, el: v.el * DEG, dist: v.dist };
      var dAz = Math.atan2(Math.sin(to.az - from.az), Math.cos(to.az - from.az));
      if (REDUCE) { setFromView(v); placeCamera(); return; }
      tween = { from: from, to: to, dAz: dAz, t0: performance.now(), dur: 750 };
    }
    function stepTween(now) {
      if (!tween) return;
      var t = clamp((now - tween.t0) / tween.dur, 0, 1), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      orbit.target.lerpVectors(tween.from.t, tween.to.t, e);
      orbit.az = tween.from.az + tween.dAz * e;
      orbit.el = tween.from.el + (tween.to.el - tween.from.el) * e;
      orbit.dist = tween.from.dist + (tween.to.dist - tween.from.dist) * e;
      placeCamera();
      if (t >= 1) tween = null;
    }
    function markCustom() {
      tween = null;
      if (state.view) {
        state.view = null;
        Array.prototype.forEach.call(root.querySelectorAll('[data-view]'), function (b) { b.setAttribute('aria-pressed', 'false'); });
      }
    }

    canvas.style.touchAction = 'pan-y';
    var ptrs = {}, nPtr = 0, down = null, moved = 0, pinch0 = 0, dist0 = 0, mode = 'rotate';
    function ptrDist() {
      var k = Object.keys(ptrs); if (k.length < 2) return 0;
      var a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y);
    }
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; nPtr++;
      if (nPtr === 1) { down = { x: e.clientX, y: e.clientY }; moved = 0; mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate'; }
      if (nPtr === 2) { pinch0 = ptrDist(); dist0 = orbit.dist; }
    });
    canvas.addEventListener('pointermove', function (e) {
      var p0 = ptrs[e.pointerId]; if (!p0) return;
      var dx = e.clientX - p0.x, dy = e.clientY - p0.y;
      p0.x = e.clientX; p0.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (nPtr === 2) {
        var dnow = ptrDist(); if (pinch0 > 0 && dnow > 0) { orbit.dist = clamp(dist0 * pinch0 / dnow, 7, 60); markCustom(); placeCamera(); }
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
        orbit.el = clamp(orbit.el + dy * 0.0075, -0.05, 1.45);
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
      orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.0011), 7, 60);
      markCustom(); placeCamera();
    }, { passive: false });

    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var pickables = meshes.map(function (r) { return r.mesh; });
    function pick(e) {
      var rc = canvas.getBoundingClientRect();
      ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(pickables, false).filter(function (h) {
        return h.object.userData.partId && (h.object.material.opacity > 0.5 || h.object.userData.partId === state.selected);
      });
      if (!hits.length) { if (state.selected) select(null); return; }
      var id = hits[0].object.userData.partId;
      select(state.selected === id ? null : id);
    }
    canvas.addEventListener('pointermove', function (e) {
      if (nPtr) return;
      var rc = canvas.getBoundingClientRect();
      ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hit = ray.intersectObjects(pickables, false).some(function (h) { return h.object.userData.partId && h.object.material.opacity > 0.5; });
      canvas.style.cursor = hit ? 'pointer' : 'grab';
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

    // ----- pose from the clock -----
    var dirty = true, lastPhase = '';
    function pose(s) {
      var k = s.kin;
      var dth = (k.theta - C.theta0) * DEG;
      crank.outer.rotation.z = dth;
      pin.outer.rotation.z = -L.gear * dth;
      rod.outer.position.set(C.crankAxis[0] + k.ax, C.crankAxis[1] + k.ay, 0);
      rod.outer.rotation.z = (k.phi - phi0) * DEG;
      ram.outer.position.x = k.d - d0;
      var cs = canState(s);
      can.visible = !!cs.show;
      if (cs.show) {
        shapeCan(cs.L);
        can.position.y = cs.y;
        var a = cs.alpha;
        canMat.transparent = a < 1; canMat.opacity = a; canMat.depthWrite = a >= 1;
        can.castShadow = a > 0.5;
      }
      if (cs.phase !== lastPhase) { lastPhase = cs.phase; phaseEl.textContent = cs.phase; }
      dirty = true;
    }

    // ----- render loop (only while on screen) -----
    var onScreen = true, rafId = 0, vtmp = new THREE.Vector3();
    function updateMarkers() {
      anchors.forEach(function (a) {
        a.obj.getWorldPosition(vtmp);
        vtmp.project(camera);
        var behind = vtmp.z > 1;
        a.el.style.transform = 'translate(' + ((vtmp.x + 1) / 2 * W).toFixed(1) + 'px,' + ((1 - vtmp.y) / 2 * H).toFixed(1) + 'px)';
        a.el.style.visibility = behind ? 'hidden' : '';
      });
    }
    function frame(now) {
      rafId = 0;
      stepTween(now);
      if (dirty) {
        resize();
        renderer.render(scene, camera);
        updateMarkers();
        dirty = false;
      }
      if (onScreen) rafId = requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        if (onScreen && !rafId) { dirty = true; rafId = requestAnimationFrame(frame); }
      }, { rootMargin: '100px' }).observe(stage);
    }

    setFromView(views.overview);
    placeCamera();
    resize();
    api3d = { applyLook: applyLook, goView: goView, renderNow: function () { dirty = true; } };
    applyLook();
    explorer.onFrame(pose);

    statusEl.hidden = true;
    phaseEl.hidden = false;
    markerWrap.hidden = false;
    root.querySelector('.cc3d-tools').hidden = false;
    root.querySelector('.sc3d-hint').hidden = false;
    stage.classList.add('is-ready');
    rafId = requestAnimationFrame(frame);

    // test / screenshot hook
    window.__canCrusher3D = { renderer: renderer, scene: scene, camera: camera, goView: goView, orbit: orbit, place: placeCamera,
      setView: function (v) { setFromView(v); placeCamera(); }, explorer: explorer, select: select, setXray: setXray,
      psi: { contact: psiContact, tdc: psiTDC, drop: psiDrop } };
  }
})();
