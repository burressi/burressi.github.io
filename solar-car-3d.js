/* ==========================================================
   Duodecim 3D explorer (solar car case study)
   Plain JavaScript. Uses Google's <model-viewer> web component
   for the 3D view; all text and settings live in solar-car-data.js.
   The system buttons and details panel still work if the 3D view
   cannot load.
   ========================================================== */
(function () {
  'use strict';

  var D = window.DUODECIM_3D;
  var root = document.getElementById('car-explorer');
  if (!D || !root) return;

  var EDIT = /[?&]edit3d\b/.test(window.location.search);
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLOW = [0.85, 0.42, 0.08];        // orange highlight
  var GLOW_SOFT = [0.30, 0.15, 0.03];   // gentler glow for large surfaces
  var SHELL_ALPHA = 0.14;               // see-through level for the shell

  var systems = D.systems;
  var byId = {};
  systems.forEach(function (s, i) { s.n = i + 1; byId[s.id] = s; });

  var state = { current: null, inside: false, ready: false, mats: [] };

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- build the markup ----------
  var hotspots = systems.map(function (s) {
    return '<button type="button" class="sc3d-hotspot" slot="hotspot-' + s.id + '"' +
      ' data-id="' + s.id + '" data-position="' + s.hotspot.position + '" data-normal="' + s.hotspot.normal + '"' +
      ' data-visibility-attribute="visible" aria-label="' + s.n + '. ' + esc(s.name) + '">' +
      '<span class="sc3d-num" aria-hidden="true">' + s.n + '</span>' +
      '<span class="sc3d-label" aria-hidden="true">' + esc(s.name) + '</span></button>';
  }).join('');

  var chips = systems.map(function (s) {
    return '<button type="button" class="sc3d-chip" data-id="' + s.id + '" aria-pressed="false">' +
      '<span class="sc3d-chip-num" aria-hidden="true">' + s.n + '</span>' + esc(s.name) + '</button>';
  }).join('');

  root.innerHTML =
    '<div class="sc3d-stage">' +
      '<model-viewer class="sc3d-viewer" src="' + esc(D.model) + '"' +
        ' alt="Interactive 3D model of the Duodecim solar car with numbered markers for each vehicle system"' +
        ' camera-controls touch-action="pan-y" interaction-prompt="none"' +
        ' camera-orbit="' + D.overview.orbit + '" camera-target="' + D.overview.target + '"' +
        ' min-camera-orbit="auto 5deg 1.6m" max-camera-orbit="auto 100deg 12m"' +
        ' interpolation-decay="' + (REDUCE ? 1000 : 140) + '"' +
        ' shadow-intensity="0.8" shadow-softness="0.9" exposure="1.05" environment-image="neutral">' +
        hotspots +
        '<div slot="progress-bar"></div>' +
      '</model-viewer>' +
      '<p class="sc3d-status" role="status">Loading the 3D model&hellip;</p>' +
      '<div class="sc3d-tools">' +
        '<button type="button" class="sc3d-tool" data-act="inside" aria-pressed="false">See inside</button>' +
        '<button type="button" class="sc3d-tool" data-act="reset">Reset view</button>' +
      '</div>' +
      '<p class="sc3d-hint">Drag to rotate &middot; scroll or pinch to zoom &middot; click a part or a numbered marker</p>' +
    '</div>' +
    '<div class="sc3d-chips" role="group" aria-label="Vehicle systems">' + chips + '</div>' +
    '<div class="sc3d-panel" aria-live="polite"></div>' +
    (D.placeholder ? '<p class="sc3d-note">The model shown is a simplified stand-in built to the car&rsquo;s real ' +
      'dimensions and layout. The full team CAD model is coming soon.</p>' :
      (D.note ? '<p class="sc3d-note">' + D.note + '</p>' : '')) +
    (EDIT ? '<div class="sc3d-edit"><h4>Edit mode</h4><p>Click the car to read a marker position. ' +
      'Move the camera to read view values. Copy them into solar-car-data.js.</p>' +
      '<pre class="sc3d-edit-out">Waiting for the model&hellip;</pre></div>' : '');

  var mv = root.querySelector('model-viewer');
  var status = root.querySelector('.sc3d-status');
  var panel = root.querySelector('.sc3d-panel');
  var insideBtn = root.querySelector('[data-act="inside"]');
  var editOut = root.querySelector('.sc3d-edit-out');

  // ---------- details panel ----------
  function specList(rows) {
    return '<dl class="sc3d-specs">' + rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('') + '</dl>';
  }

  function renderOverview() {
    var v = D.vehicle;
    panel.innerHTML =
      '<p class="sc3d-eyebrow">The car</p>' +
      '<h3>' + esc(v.name) + '</h3>' +
      '<p>' + esc(v.intro) + '</p>' +
      specList(v.facts) +
      '<p class="sc3d-prompt">Pick one of the nine systems above, or click a numbered marker on the car.</p>';
  }

  function renderSystem(s) {
    var prev = systems[(s.n - 2 + systems.length) % systems.length];
    var next = systems[s.n % systems.length];
    panel.innerHTML =
      '<p class="sc3d-eyebrow">' + s.n + ' of ' + systems.length + ' &middot; ' + esc(s.group) + '</p>' +
      '<h3>' + esc(s.name) + '</h3>' +
      '<p class="sc3d-summary">' + esc(s.summary) + '</p>' +
      specList(s.specs) +
      '<p>' + esc(s.story) + '</p>' +
      '<div class="sc3d-nav">' +
        '<button type="button" class="sc3d-link" data-go="' + prev.id + '">&larr; ' + esc(prev.name) + '</button>' +
        '<button type="button" class="sc3d-link" data-go="overview">Whole car</button>' +
        '<button type="button" class="sc3d-link" data-go="' + next.id + '">' + esc(next.name) + ' &rarr;</button>' +
      '</div>';
  }

  // ---------- 3D material helpers ----------
  function matsNamed(names) {
    return state.mats.filter(function (m) { return names.indexOf(m.name) !== -1; });
  }

  function setHighlight(names) {
    state.mats.forEach(function (m) { m.ref.setEmissiveFactor(m.emissive); });
    if (!names) return;
    matsNamed(names).forEach(function (m) {
      var soft = D.shellMaterials.indexOf(m.name) !== -1 && m.name !== 'array';
      m.ref.setEmissiveFactor(soft ? GLOW_SOFT : GLOW);
    });
  }

  function setInside(on) {
    state.inside = on;
    insideBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    root.classList.toggle('is-inside', on);
    matsNamed(D.shellMaterials).forEach(function (m) {
      if (on) {
        m.ref.setAlphaMode('BLEND');
        m.ref.pbrMetallicRoughness.setBaseColorFactor([m.color[0], m.color[1], m.color[2], Math.min(m.color[3], SHELL_ALPHA)]);
      } else {
        m.ref.setAlphaMode(m.alphaMode);
        m.ref.pbrMetallicRoughness.setBaseColorFactor(m.color);
      }
    });
  }

  function moveCamera(view) {
    if (!state.ready) return;
    mv.cameraOrbit = view.orbit;
    mv.cameraTarget = view.target;
    mv.fieldOfView = 'auto';
  }

  // ---------- selection ----------
  function select(id, opts) {
    opts = opts || {};
    var s = byId[id] || null;
    state.current = s ? s.id : null;

    root.querySelectorAll('.sc3d-chip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-id') === state.current ? 'true' : 'false');
    });
    root.querySelectorAll('.sc3d-hotspot').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-id') === state.current);
    });

    if (s) { renderSystem(s); } else { renderOverview(); }
    if (!state.ready) return;

    if (s) {
      setHighlight(s.materials);
      setInside(!!s.view.seeInside);
      if (!opts.keepCamera) moveCamera(s.view);
    } else {
      setHighlight(null);
      setInside(false);
      moveCamera(D.overview);
    }
  }

  // ---------- events ----------
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-id], [data-go], [data-act]');
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute('data-act')) {
      var act = t.getAttribute('data-act');
      if (act === 'inside') setInside(!state.inside);
      if (act === 'reset') select(null);
      return;
    }
    var id = t.getAttribute('data-go') || t.getAttribute('data-id');
    if (id === 'overview') { select(null); return; }
    if (t.classList.contains('sc3d-chip') && state.current === id) { select(null); return; }
    select(id);
  });

  // arrow keys move between system buttons
  root.querySelector('.sc3d-chips').addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
    var btns = Array.prototype.slice.call(root.querySelectorAll('.sc3d-chip'));
    var i = btns.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') i = (i - 1 + btns.length) % btns.length;
    if (e.key === 'ArrowRight') i = (i + 1) % btns.length;
    if (e.key === 'Home') i = 0;
    if (e.key === 'End') i = btns.length - 1;
    btns[i].focus();
    select(btns[i].getAttribute('data-id'));
  });

  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.current) select(null);
  });

  // click on a part of the car (not a drag) picks its system
  var down = null;
  mv.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
  mv.addEventListener('click', function (e) {
    if (!state.ready || e.target.closest('.sc3d-hotspot')) return;
    if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) return;
    if (EDIT) { showPoint(e); return; }
    if (typeof mv.materialFromPoint !== 'function') return;
    var mat = mv.materialFromPoint(e.clientX, e.clientY);
    if (!mat) return;
    var hit = null;
    systems.forEach(function (s) {
      if (s.materials.indexOf(mat.name) !== -1 && !(state.inside && D.shellMaterials.indexOf(mat.name) !== -1)) hit = s;
    });
    if (hit) select(hit.id, { keepCamera: true });
  });

  // ---------- edit mode readout ----------
  var lastPoint = '';
  function showCamera() {
    if (!editOut || !state.ready) return;
    editOut.textContent =
      (lastPoint ? lastPoint + '\n\n' : '') +
      '"view": { "orbit": "' + mv.getCameraOrbit().toString() + '", "target": "' + mv.getCameraTarget().toString() + '" }\n\n' +
      'Materials in this model: ' + state.mats.map(function (m) { return m.name; })
        .filter(function (n, i, a) { return a.indexOf(n) === i; }).join(', ');
  }
  function showPoint(e) {
    var hit = mv.positionAndNormalFromPoint(e.clientX, e.clientY);
    var mat = typeof mv.materialFromPoint === 'function' ? mv.materialFromPoint(e.clientX, e.clientY) : null;
    if (!hit) return;
    lastPoint = '"hotspot": { "position": "' + hit.position.toString() + '", "normal": "' + hit.normal.toString() + '" }' +
      (mat ? '\nmaterial clicked: ' + mat.name : '');
    showCamera();
  }
  if (EDIT) mv.addEventListener('camera-change', showCamera);

  // ---------- loading ----------
  function fail(msg) {
    status.textContent = msg;
    root.classList.add('is-failed');
  }

  mv.addEventListener('load', function () {
    state.ready = true;
    status.hidden = true;
    root.classList.add('is-ready');
    state.mats = mv.model.materials.map(function (m) {
      return {
        ref: m,
        name: m.name,
        color: m.pbrMetallicRoughness.baseColorFactor.slice(),
        emissive: (m.emissiveFactor || [0, 0, 0]).slice(),
        alphaMode: m.getAlphaMode ? m.getAlphaMode() : 'OPAQUE'
      };
    });
    select(state.current, {});
    showCamera();
  });

  mv.addEventListener('error', function () {
    fail('The 3D model could not be loaded. The system details below still work.');
  });

  if (window.customElements) {
    var timer = window.setTimeout(function () {
      if (!window.customElements.get('model-viewer')) {
        fail('The 3D viewer is not available in this browser. The system details below still work.');
      }
    }, 10000);
    window.customElements.whenDefined('model-viewer').then(function () { window.clearTimeout(timer); });
  }

  renderOverview();
})();
