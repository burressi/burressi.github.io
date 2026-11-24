/* ==========================================================
   Slider crank paperweight (ME 470 Project A): text, numbers and
   settings for case-slider-crank.html.
   SLIDER_CRANK drives the live kinematics (linkage-explorer.js).
   SLIDER_CRANK_3D drives the 3D model (slider-crank-3d.js).
   Link lengths and handle radius are from Figure 1 of the Project A
   report; crank speed from Table 1. Plan sizes are scaled from the
   same dimensioned top view; heights are estimated from photos of
   the prototype. Positions are inches: X along the slider line from
   the main crank axis, Y across, Z up from the bottom of the plate.
   ========================================================== */
window.SLIDER_CRANK = {
  linkage: { a: 0.75, b: 3.0, c: 0, rIn: 3.5, omega: 5, gear: 1 },
  period: 3.6,
  start: 100,
  autoplay: true,
  angleLabel: 'Crank angle',
  presets: [{ label: 'Jump to 100\u00b0 (Table 1)', theta: 100 }],
  readouts: [
    { key: 'theta', label: 'Crank angle', sym: '\u03b8\u2082' },
    { key: 'd', label: 'Slider position', sym: 'd' },
    { key: 'ddot', label: 'Slider speed', note: 'at 5 rad/s' },
    { key: 'theta3', label: 'Rod angle', sym: '\u03b8\u2083' },
    { key: 'mu', label: 'Transmission angle', sym: '\u03bc' },
    { key: 'ma', label: 'Mechanical advantage', note: '3.5 in handle' }
  ],
  charts: [
    { key: 'd', title: 'Slider position, d (in)', fmt: function (v) { return v.toFixed(2) + ' in'; } },
    { key: 'ddot', title: 'Slider velocity at 5 rad/s (in/s)', fmt: function (v) { return (Math.round(v * 100) / 100).toFixed(2) + ' in/s'; } },
    { key: 'mu', title: 'Transmission angle (\u00b0)', min: 0, max: 90, guide: 40, guideLabel: '40\u00b0 guideline',
      fmt: function (v) { return (Math.round(v * 10) / 10).toFixed(1) + '\u00b0'; } },
    { key: 'ma', title: 'Mechanical advantage (3.5 in handle)', min: 0, max: 20,
      fmt: function (v) { return !isFinite(v) || v >= 100 ? '100+ : 1' : (Math.round(v * 10) / 10).toFixed(1) + ' : 1'; } }
  ]
};

window.SLIDER_CRANK_3D = {

  // Sizes used to build the model (inches)
  geo: {
    plate: { x: [-1.18, 5.55], y: [-1.99, 1.99], t: 0.125,
             holesX: [-0.30, 0.70, 1.70, 2.70, 3.69, 4.69], holesY: [-1.12, -0.375, 0.375, 1.12], holeD: 0.2 },
    bracket: { x: [-1.18, 1.19], y: [-1.99, 1.99], top: 1.125, chamfer: 0.2, screws: [[-0.30, 1.12], [0.69, 1.12], [-0.30, -1.12], [0.69, -1.12]] },
    support: { legX: [4.17, 5.16], legY: [0.61, 1.61], trackX: [2.68, 5.16], trackHalf: 0.52, slotHalf: 0.36,
               floor: [3.2, 3.5], wallTop: 3.8, bridgeBottom: 2.95, coverTop: 4.3 },
    rodZ: [3.65, 3.95],
    piston: { back: -0.26, front: 1.33, half: 0.345, z: [3.5, 4.15], slot: [3.62, 3.98], pinTop: 4.35 },
    handleZ: [7.3, 8.3],
    pivotZ: 4.3,                   // turn-over axis height: half the overall height
    drop: 0.45,                    // how far the piston falls out of the open track
    dropYaw: 18                    // and how far it swings on its pin once it's free (deg)
  },

  overview: {
    title: 'How the paperweight works',
    steps: [
      'Turn the handle by its red collar. The collar spins on its bolt, so your grip never twists.',
      'The orange upper crank locks onto the blue lower crank, and the pair turns on a \u00bd in bolt in the purple bracket.',
      'The crank pin sits 0.75 in off that axis. The green connecting rod, 3 in long, turns its circle into a push and pull.',
      'The light-blue piston slides 1.50 in back and forth along the track on the magenta piston support.'
    ]
  },

  parts: [
    {
      id: 'collar', name: 'Handle collar', group: 'crank', marker: [3.5, 0, 8.0], kind: 'Printed part',
      summary: 'The grip. It spins freely on the bolt at the end of the handle, so it rolls in your hand while the crank turns.',
      specs: [
        ['Distance from the main axis', '3.5 in (the input radius in our analysis)'],
        ['Held on by', 'A bolt and washer through its center']
      ]
    },
    {
      id: 'upper-crank', name: 'Upper crank and handle', group: 'crank', marker: [2.15, 0, 6.55], kind: 'Printed part',
      summary: 'The input arm. It climbs from the crank pin to the handle and locks onto the lower crank through a cylinder with two flats cut on it, so the two pieces turn as one.',
      specs: [
        ['Handle radius', '3.5 in'],
        ['Locking feature', 'Cylinder with two flats'],
        ['Lowest mechanical advantage', '4.5 : 1, handle to piston']
      ]
    },
    {
      id: 'lower-crank', name: 'Lower crank', group: 'crank', marker: [0.1, 0, 2.5], kind: 'Printed part',
      summary: 'The crank itself. It turns on the main \u00bd in bolt and carries the crank pin 0.75 in off the axis. The connecting rod rides on that pin with enough clearance to turn freely.',
      specs: [
        ['Crank radius, a', '0.75 in'],
        ['Main axis', '\u00bd in bolt in a threaded hole'],
        ['Stroke it produces', '1.50 in (2a)']
      ]
    },
    {
      id: 'rod', name: 'Connecting rod', group: 'rod', marker: [1.6, 0, 3.95], kind: 'Printed part',
      summary: 'Turns the crank\u2019s rotation into the piston\u2019s straight-line motion. Because b \u2212 a (2.25 in) is greater than the offset c (0 in), the linkage is Grashof and the crank turns all the way round.',
      specs: [
        ['Length, b', '3 in'],
        ['Largest angle off the slider line', '14.5\u00b0'],
        ['Transmission angle', '75.5\u00b0 to 90\u00b0']
      ]
    },
    {
      id: 'piston', name: 'Piston and pin', group: 'piston', marker: [0.75, 0, 4.15], kind: 'Printed part and pin',
      summary: 'The slider. A pin joins it to the rod, and it slides back and forth along the track on the piston support.',
      specs: [
        ['Stroke', '1.50 in'],
        ['Slider position, d', '2.25 to 3.75 in from the main axis'],
        ['Peak speed at 5 rad/s', '3.9 in/s']
      ]
    },
    {
      id: 'support', name: 'Piston support', group: null, marker: [4.66, -1.11, 2.2], kind: 'Printed part',
      summary: 'Two legs and an open-topped track that guide the piston. That open top is why the paperweight failed the upside-down requirement: turned over, nothing holds the piston in. Try the upside-down test below the model, then switch to the revised support.',
      specs: [
        ['Original track', 'Open on top'],
        ['Revised track', 'Covered, so the piston can\u2019t fall out']
      ]
    },
    {
      id: 'bracket', name: 'Bracket', group: null, marker: [-0.75, -1.35, 1.125], kind: 'Printed part',
      summary: 'Holds the crank to the baseplate. The main \u00bd in bolt passes through it, with a nut and two washers to cut friction. This is the main axis of rotation.',
      specs: [
        ['Main fastener', '\u00bd in bolt, nut and two washers'],
        ['Footprint', 'About 2.4 \u00d7 4.0 in (scaled from Figure 1)']
      ]
    },
    {
      id: 'base', name: 'Baseplate and hardware', group: null, marker: [5.1, -1.55, 0.125], kind: 'Shop parts',
      summary: 'The grey parts are metal from the lab: a plate with a grid of holes, plus the bolts, nuts, washers and pin. The \u00bd in threaded hole for the main bolt was one of our build problems, because the largest tap in the lab was \u215c in.',
      specs: [
        ['Plate', 'About 6.7 \u00d7 4.0 in (scaled from Figure 1)'],
        ['Hole grid', '1 in \u00d7 0.75 in']
      ]
    }
  ],

  views: {
    overview: { label: 'Overview', target: [2.0, 0.2, 4.05], az: -38, el: 21, dist: 22.5, flipEl: 12 },
    top: { label: 'Top (Figure 1)', target: [2.2, 0.55, 4], az: 0, el: 89.5, dist: 50, fov: 12.5 },
    side: { label: 'Side', target: [2.2, 0, 4.25], az: 0, el: 3, dist: 22 }
  },

  test: {
    intro: 'The brief said the paperweight had to keep working upside down. Turn it over to see why ours didn\u2019t, then try the fix from our report.',
    tags: {
      revised: 'Revised support',
      turning: 'Turning it over\u2026',
      fails: 'Upside down: the piston falls out',
      works: 'Upside down: still working',
      upright: 'Back upright'
    },
    messages: {
      revised: 'Revised support: a cover over the track holds the piston in.',
      turning: 'Turning it over\u2026',
      fails: 'Upside down, nothing holds the piston in its open track, so it falls out. This is the requirement we missed.',
      works: 'Upside down with the revised support, the cover keeps the piston in its track, so it keeps working.',
      upright: 'Back upright.'
    }
  },

  note: 'Built for this page from the dimensioned top view in our report (Figure 1) and photos of the prototype. Link lengths are exact; part shapes and heights are simplified. Colors follow our CAD.',
  fallbackImage: 'pictures/slider-crank-3d.jpg'
};
