/* ==========================================================
   Mobile E-Beam Treatment Station 3D explorer (case study page)
   Plain JavaScript. Uses Google's <model-viewer> web component
   for the 3D view; all text and settings live in ebeam-3d-data.js.
   Built the same way as the solar car explorer (solar-car-3d.js) and
   reuses its sc3d-* styles. The system buttons and details panel
   still work if the 3D view cannot load.
   ========================================================== */
(function () {
  'use strict';

  var D = window.EBEAM_3D;
  var root = document.getElementById('station-explorer');
  if (!D || !root) return;

  var EDIT = /[?&]edit3d\b/.test(window.location.search);
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLOW = [0.85, 0.42, 0.08];        // orange highlight
  var GLOW_SOFT = [0.22, 0.11, 0.02];   // gentler glow for the big shell surfaces
  var GHOST = 0.1;                      // see-through level for parts outside an isolated system

  var systems = D.systems;
  var byId = {};
  systems.forEach(function (s, i) { s.n = i + 1; byId[s.id] = s; });
  var modes = D.modes || [];
  var modeById = {};
  modes.forEach(function (m) { modeById[m.id] = m; });

  var state = { current: null, ready: false, mats: [], solid: false, isolate: false,
                mode: D.startMode || (modes[0] && modes[0].id), time: 0, anim: 0, hasAnim: false };

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- markup ----------
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

  var modeBtns = modes.map(function (m) {
    return '<button type="button" class="sc3d-tool eb3d-mode" data-mode="' + m.id + '" aria-pressed="false">' + esc(m.label) + '</button>';
  }).join('');

  root.innerHTML =
    '<div class="sc3d-stage">' +
      '<model-viewer class="sc3d-viewer eb3d-viewer" src="' + esc(D.model) + '"' +
        ' alt="Interactive 3D model of the mobile electron beam treatment trailer with numbered markers for each system"' +
        ' camera-controls touch-action="pan-y" interaction-prompt="none"' +
        ' camera-orbit="' + D.overview.orbit + '" camera-target="' + D.overview.target + '"' +
        ' min-camera-orbit="auto 0deg 2m" max-camera-orbit="auto 105deg 45m"' +
        ' field-of-view="30deg" interpolation-decay="' + (REDUCE ? 1000 : 140) + '" animation-crossfade-duration="0"' +
        ' shadow-intensity="0.7" shadow-softness="0.9" exposure="1.05" environment-image="neutral">' +
        hotspots +
        '<div slot="progress-bar"></div>' +
      '</model-viewer>' +
      '<p class="sc3d-status" role="status">Loading the 3D model&hellip;</p>' +
      '<div class="sc3d-tools">' +
        (modes.length ? '<div class="eb3d-modes" role="group" aria-label="Station mode" hidden>' + modeBtns + '</div>' : '') +
        '<button type="button" class="sc3d-tool" data-act="solid" aria-pressed="false">Solid walls</button>' +
        '<button type="button" class="sc3d-tool" data-act="isolate" aria-pressed="false">Isolate</button>' +
        '<button type="button" class="sc3d-tool" data-act="reset">Reset view</button>' +
      '</div>' +
      '<p class="eb3d-caption" hidden></p>' +
      '<p class="sc3d-hint">Drag to rotate &middot; scroll or pinch to zoom &middot; pick a system or a numbered marker</p>' +
    '</div>' +
    '<div class="sc3d-chips" role="group" aria-label="Station systems">' + chips + '</div>' +
    '<div class="sc3d-panel" aria-live="polite"></div>' +
    (D.note ? '<p class="sc3d-note">' + esc(D.note) + '</p>' : '') +
    (EDIT ? '<div class="sc3d-edit"><h4>Edit mode</h4><p>Click the model to read a marker position. ' +
      'Move the camera to read view values. Copy them into ebeam-3d-data.js.</p>' +
      '<pre class="sc3d-edit-out">Waiting for the model&hellip;</pre></div>' : '');

  if (!document.getElementById('eb3d-css')) {   // small additions, kept here so style.css stays unchanged
    var css = document.createElement('style'); css.id = 'eb3d-css';
    css.textContent =
      '.eb3d-viewer{height:520px}' +
      '#station-explorer .sc3d-tools{flex-wrap:wrap;justify-content:flex-end;max-width:calc(100% - 24px)}' +
      '.eb3d-modes{display:flex;gap:0}.eb3d-modes[hidden],.eb3d-caption[hidden]{display:none}' +
      '.eb3d-modes .sc3d-tool+.sc3d-tool{margin-left:-1px}' +
      '.eb3d-caption{position:absolute;left:12px;bottom:40px;max-width:min(440px,calc(100% - 24px));margin:0;' +
      'padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.92);border:1px solid rgba(0,0,0,.08);' +
      'font-size:.85rem;line-height:1.4;color:inherit}' +
      '@media (max-width:700px){.eb3d-viewer{height:380px}.eb3d-caption{position:static;margin:8px 0 0}}';
    document.head.appendChild(css);
  }

  var mv = root.querySelector('model-viewer');
  var status = root.querySelector('.sc3d-status');
  var panel = root.querySelector('.sc3d-panel');
  var caption = root.querySelector('.eb3d-caption');
  var modeGroup = root.querySelector('.eb3d-modes');
  var editOut = root.querySelector('.sc3d-edit-out');

  // ---------- details panel ----------
  function specList(rows) {
    return '<dl class="sc3d-specs">' + rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('') + '</dl>';
  }

  function renderOverview() {
    var v = D.station;
    panel.innerHTML =
      '<p class="sc3d-eyebrow">The station</p>' +
      '<h3>' + esc(v.name) + '</h3>' +
      '<p>' + esc(v.intro) + '</p>' +
      specList(v.facts) +
      '<p class="sc3d-prompt">Pick one of the ' + systems.length + ' systems above, or click a numbered marker on the model.</p>';
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
        '<button type="button" class="sc3d-link" data-go="overview">Whole station</button>' +
        '<button type="button" class="sc3d-link" data-go="' + next.id + '">' + esc(next.name) + ' &rarr;</button>' +
      '</div>';
  }

  // ---------- materials: one function sets every material from the current state ----------
  function isShell(name) { return D.shellMaterials.indexOf(name) !== -1; }

  function applyLook() {
    if (!state.ready) return;
    var sel = state.current ? byId[state.current].materials : null;
    var beamOn = !!(modeById[state.mode] && modeById[state.mode].beam);
    state.mats.forEach(function (m) {
      if (m.name === 'edges') return;      // CAD outline lines stay as they are
      var c = m.color.slice(), mode = m.alphaMode, em = m.emissive.slice();
      var picked = sel && sel.indexOf(m.name) !== -1;
      if (isShell(m.name) && state.solid) { c[3] = 1; mode = 'OPAQUE'; }
      if (m.name === 'beam') {
        c[3] = beamOn ? m.color[3] : 0; mode = 'BLEND';
        if (!beamOn) em = [0, 0, 0];
      }
      if (state.isolate && sel && !picked && !isShell(m.name) && m.name !== 'beam') {
        c[3] = Math.min(c[3], GHOST); mode = 'BLEND';
      }
      if (picked) em = isShell(m.name) ? GLOW_SOFT : GLOW;
      m.ref.setAlphaMode(mode);
      m.ref.pbrMetallicRoughness.setBaseColorFactor(c);
      m.ref.setEmissiveFactor(em);
    });
  }

  function moveCamera(view) {
    if (!state.ready) return;
    mv.cameraOrbit = view.orbit;
    mv.cameraTarget = view.target;
    mv.fieldOfView = '30deg';
  }

  // ---------- modes (one animation, posed through currentTime) ----------
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function setMode(id, instant) {
    var m = modeById[id]; if (!m) return;
    state.mode = id;
    root.querySelectorAll('.eb3d-mode').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-mode') === id ? 'true' : 'false');
    });
    if (caption) { caption.textContent = m.caption || ''; caption.hidden = !m.caption; }
    applyLook();
    if (!state.hasAnim) return;
    window.cancelAnimationFrame(state.anim);
    var from = state.time, to = m.time, ms = 900 * Math.abs(to - from), t0 = null;
    if (instant || REDUCE || ms < 1) { state.time = to; mv.currentTime = to; return; }
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms);
      state.time = from + (to - from) * ease(k);
      mv.currentTime = state.time;
      if (k < 1) state.anim = window.requestAnimationFrame(step);
    }
    state.anim = window.requestAnimationFrame(step);
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
    applyLook();
    if (!state.ready) return;
    if (!opts.keepCamera) moveCamera(s ? s.view : D.overview);
  }

  function toggle(act, btn) {
    state[act] = !state[act];
    btn.setAttribute('aria-pressed', state[act] ? 'true' : 'false');
    applyLook();
  }

  // ---------- events ----------
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-id], [data-go], [data-act], [data-mode]');
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute('data-mode')) { setMode(t.getAttribute('data-mode')); return; }
    if (t.hasAttribute('data-act')) {
      var act = t.getAttribute('data-act');
      if (act === 'solid' || act === 'isolate') toggle(act, t);
      if (act === 'reset') { setMode(D.startMode || modes[0].id); select(null); }
      return;
    }
    var id = t.getAttribute('data-go') || t.getAttribute('data-id');
    if (id === 'overview') { select(null); return; }
    if (t.classList.contains('sc3d-chip') && state.current === id) { select(null); return; }
    select(id);
  });

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

  // click on a part (not a drag) picks its system; the see-through walls are skipped
  var down = null;
  mv.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
  mv.addEventListener('click', function (e) {
    if (!state.ready || e.target.closest('.sc3d-hotspot')) return;
    if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) return;
    if (EDIT) { showPoint(e); return; }
    if (typeof mv.materialFromPoint !== 'function') return;
    var mat = mv.materialFromPoint(e.clientX, e.clientY);
    if (!mat || (isShell(mat.name) && !state.solid)) return;
    var hit = null;
    systems.forEach(function (s) { if (s.materials.indexOf(mat.name) !== -1) hit = s; });
    if (hit) select(hit.id, { keepCamera: true });
  });

  // ---------- edit mode readout ----------
  var lastPoint = '';
  function showCamera() {
    if (!editOut || !state.ready) return;
    editOut.textContent =
      (lastPoint ? lastPoint + '\n\n' : '') +
      '"view": { "orbit": "' + mv.getCameraOrbit().toString() + '", "target": "' + mv.getCameraTarget().toString() + '" }\n\n' +
      'Materials in this model: ' + state.mats.map(function (m) { return m.name; }).join(', ');
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
    if (mv.availableAnimations && mv.availableAnimations.indexOf('Operate') !== -1) {
      // load the animation and hold it still; currentTime poses the model from here on
      mv.animationName = 'Operate';
      mv.play(); mv.pause();
      state.hasAnim = true;
      if (modeGroup) modeGroup.hidden = false;
    }
    setMode(state.mode, true);
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
