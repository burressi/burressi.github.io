/* ==========================================================
   Mechanical can crusher: text, numbers and settings for the
   case study page (read by can-crusher-3d.js and linkage-explorer.js).
   Positions are CAD inches: X along the ram, Y across, Z up,
   matching the team's STL files.
   ========================================================== */
window.CAN_CRUSHER = {

  // Final design from the "Final project" sheets of our calculation workbook
  linkage: {
    a: 1.75,        // crank throw, in
    b: 5.25,        // connecting rod, in
    c: 1.0,         // offset: ram line sits 1 in below the crank axis
    rIn: 4.0,       // handle radius used in the analysis, in
    omega: 5,       // crank speed used in the analysis, rad/s
    gear: 2,        // 1.2 in pinion driving a 2.4 in gear
    load: 112       // design crush load at the ram, lbf
  },

  // Where things are in the CAD assembly (measured from the STL files)
  cad: {
    crankAxis: [2.55, 2.875],     // X, Z of the crankshaft axis
    pinionAxis: [4.35, 2.875],    // X, Z of the handle / pinion shaft
    theta0: -88.681,              // crank angle in the STL pose (deg, ccw from +X seen from the handle side)
    ramFace0: 9.387,              // ram face X in the STL pose
    endWall: 11.75,               // inside face of the housing end wall
    floorTop: 0.725,              // top of the housing floor
    boardTop: 0.475,              // bottom of every part = top of the mounting board
    channelY: 6.0,                // center line of the ram and channel
    channelHalf: 1.175,           // half of the 2.35 in inside width
    slot: [10.75, 11.75],         // floor opening next to the end wall (X range)
    gearY: [3.25, 3.65]           // where the stand-in gear and pinion sit (Y range)
  },

  // Illustrative can, sized to fit the printed chamber
  can: { length: 3.9, diameter: 2.1 },

  parts: [
    {
      id: 'handle',
      name: 'Handle and grip',
      meshes: ['handle', 'handle-collar'],
      group: 'pinion',
      marker: [0.6, -0.3, 2.875],
      kind: 'Printed part',
      summary: 'The input. A Z-shaped arm puts the grip 3.75 in from the pinion shaft, and a loose printed collar spins on the grip so it rolls in your hand instead of twisting.',
      specs: [
        ['Grip radius (CAD)', '3.75 in'],
        ['Radius in the analysis', '4 in'],
        ['Handle turns per can', '2 (one crank turn)'],
        ['Solid volume', '2.1 in\u00b3 (arm + collar)']
      ]
    },
    {
      id: 'gears',
      name: 'Gear pair',
      meshes: ['gear', 'pinion'],
      group: null,
      marker: [2.55, 3.45, 4.15],
      kind: 'Stand-in (bought part)',
      summary: 'A 1.2 in pinion on the handle shaft drives a 2.4 in gear on the crankshaft. The 2:1 reduction doubles the torque reaching the crank. The gears are not in the print set, so the model shows representative 20\u00b0 spur gears at the pitch diameters from our gear check.',
      specs: [
        ['Ratio', '2 : 1'],
        ['Pitch diameters', '1.2 in and 2.4 in'],
        ['Center distance', '1.80 in (matches the CAD)'],
        ['Pressure angle', '20\u00b0'],
        ['Design torque at the crank', '395 lb\u00b7in'],
        ['Tooth load', '329 lbf tangential, 120 lbf radial']
      ]
    },
    {
      id: 'gear-support',
      name: 'Gear support',
      meshes: ['gear-support'],
      group: null,
      marker: [4.95, 2.7, 1.1],
      kind: 'Printed part',
      summary: 'Twin uprights carry the handle shaft and pinion exactly 1.80 in from the crank axis, the center distance a 1.2 in and 2.4 in gear pair needs to mesh.',
      specs: [
        ['Shaft height above the base', '2.40 in'],
        ['Gap between uprights', '0.85 in (the pinion sits here)'],
        ['Solid volume', '2.3 in\u00b3']
      ]
    },
    {
      id: 'crankshaft',
      name: 'Crankshaft (two halves)',
      meshes: ['crank-male', 'crank-female'],
      group: 'crank',
      marker: [2.55, 6.0, 2.875],
      kind: 'Printed part',
      summary: 'Two printed halves plug together at the crank pin, which lets the closed big end of the connecting rod slide onto the pin before the halves are joined. It turns once for every two turns of the handle.',
      specs: [
        ['Crank throw, a', '1.75 in'],
        ['Main journals', '0.50 in diameter'],
        ['Speed', 'Half the handle speed'],
        ['Solid volume', '2.0 in\u00b3 (both halves)']
      ]
    },
    {
      id: 'crank-supports',
      name: 'Crank supports (2) with caps',
      meshes: ['crank-support', 'crank-support-top', 'crank-support-2', 'crank-support-top-2'],
      group: null,
      marker: [1.3, 7.8, 3.375],
      kind: 'Printed part, print 2 of each',
      summary: 'Split pillow blocks. The crankshaft journals drop into half-round seats and a cap is screwed down over each one, so the crank goes in without pressing in any bearings.',
      specs: [
        ['Journal seat', '0.55 in for a 0.50 in journal'],
        ['Axis height above the base', '2.40 in'],
        ['Solid volume', '5.9 in\u00b3 (all four pieces)']
      ]
    },
    {
      id: 'rod',
      name: 'Connecting rod',
      meshes: ['connecting-rod'],
      group: 'rod',
      marker: [5.1, 6.0, 1.55],
      kind: 'Printed part',
      summary: 'Carries the crank\u2019s push to the ram. At 5.25 in it is three times the crank throw, which keeps the push close to the ram\u2019s line of travel: the transmission angle never drops below 58\u00b0.',
      specs: [
        ['Length, b', '5.25 in, pin to pin'],
        ['Rod to crank ratio', '3.0'],
        ['Minimum transmission angle', '58.4\u00b0'],
        ['Solid volume', '3.0 in\u00b3']
      ]
    },
    {
      id: 'ram',
      name: 'Crusher ram',
      meshes: ['crusher', 'wrist-pin'],
      group: 'ram',
      marker: [8.4, 6.0, 3.025],
      kind: 'Printed part',
      summary: 'A solid block that slides in the housing channel. The connecting rod is pinned into a slot at the back, and the flat face does the crushing.',
      specs: [
        ['Face', '2.30 \u00d7 2.30 in'],
        ['Stroke', '3.57 in'],
        ['Offset, c', '1.00 in below the crank axis'],
        ['Solid volume', '8.8 in\u00b3']
      ]
    },
    {
      id: 'housing',
      name: 'Housing (crushing chamber)',
      meshes: ['housing'],
      group: null,
      marker: [11.2, 4.7, 3.225],
      kind: 'Printed part',
      summary: 'An open-top channel closed by an end wall. At full stroke the ram stops 0.67 in from the wall, and an opening in the floor beside the wall lets the flattened can fall out as the ram pulls back.',
      specs: [
        ['Inside width', '2.35 in'],
        ['Room for a can', '4.25 in with the ram back'],
        ['Gap at full stroke', '0.67 in'],
        ['Floor opening', '1.00 in long'],
        ['Solid volume', '13.2 in\u00b3']
      ]
    },
    {
      id: 'base',
      name: 'Mounting board',
      meshes: ['board'],
      group: null,
      marker: [1.2, 3.2, 0.475],
      kind: 'Stand-in',
      summary: 'Not part of the print set. Every printed part has screw holes for a common base, and all of them sit on the same plane in the CAD, so the model shows a plain board with a cut-out under the drop opening. The 3.75 in handle swings lower than the board, so the crusher needs to sit at the edge of a bench.',
      specs: [
        ['Board thickness shown', '0.475 in'],
        ['Printed parts in total', '10 STL files, 12 prints']
      ]
    }
  ],

  overview: {
    title: 'How it works',
    steps: [
      'Turn the handle. The pinion drives the 2:1 gear, which turns the crank once for every two turns of the handle.',
      'The crank and connecting rod push the ram along the channel, 3.57 in from end to end.',
      'The ram flattens the can against the end wall and stops 0.67 in short of it.',
      'On the way back, the flattened can drops through the opening in the floor, ready for the next can.'
    ]
  },

  views: {
    overview: { label: 'Overview', target: [6.6, 5.4, 1.6], az: 30, el: 30, dist: 21.5 },
    side:     { label: 'Linkage view', target: [5.9, 5.6, 2.1], az: 0, el: 3, dist: 21 },
    chamber:  { label: 'Into the chamber', target: [9.7, 6.0, 1.3], az: 58, el: 50, dist: 14 }
  },

  note: 'The printed parts come straight from the team\u2019s STL files, in their assembly positions. The gears, wrist pin, mounting board and can are stand-ins. The can is sized to fit the chamber (about 2.1 \u00d7 3.9 in). Readouts and charts use the analysis inputs: 5 rad/s at the crank, a 4 in handle and a 112 lbf crush load, with no friction.',

  fallbackImage: 'pictures/can-crusher-render.jpg'
};
