/* Duodecim 3D explorer - content and settings
   ------------------------------------------------------------------
   Edit this file to change the text, the model file, or where each
   numbered marker sits. Facts come from the team's 2023-24 design
   reviews, the ASC 2024 Mechanical and Electrical VDRs and the 2024
   rollout posters.

   model          path to the .glb file
   placeholder    true shows the "simplified stand-in" note under the viewer
   note           optional line shown under the viewer when placeholder is false
   overview       starting camera: orbit = "angle-around angle-down distance"
   shellMaterials materials made see-through by the "See inside" switch
   systems[].materials       materials that glow when the system is picked
   systems[].hotspot         marker position / surface direction (metres)
   systems[].view            camera for that system; seeInside turns on x-ray

   To find new positions after swapping in the real CAD model, open the
   page with ?edit3d at the end of the address. Click the car to read a
   marker position, and move the camera to read orbit / target values.
*/
window.DUODECIM_3D = {
  "model": "models/duodecim.glb?v=6",
  "placeholder": false,
  "overview": {
    "orbit": "35deg 68deg 7.5m",
    "target": "0m 0.45m 0m"
  },
  "shellMaterials": [
    "aeroshell",
    "array",
    "canopy",
    "chassis"
  ],
  "vehicle": {
    "name": "Duodecim",
    "intro": "Duodecim began life as Argo, a car built by Illini Solar Car. The University of Illinois donated the chassis in summer 2023, and our team redesigned it around the 2024 American Solar Challenge rules: a new roll cage, new suspension and wheels, a single-motor front-wheel-drive powertrain, and an all-new electrical system.",
    "facts": [
      [
        "Size (L × W × H)",
        "4.5 × 1.8 × 1.05 m"
      ],
      [
        "Weight, race-ready",
        "304 kg"
      ],
      [
        "Wheelbase / track",
        "1,950 / 1,460 mm"
      ],
      [
        "Layout",
        "Single seat, front-wheel drive"
      ]
    ]
  },
  "systems": [
    {
      "id": "array",
      "name": "Solar Array",
      "group": "Energy",
      "summary": "260 silicon solar cells bonded to the top shell turn sunlight into the energy that keeps the car moving.",
      "specs": [
        [
          "Cells",
          "260 SunPower E60, in 3 strings (99 / 70 / 91)"
        ],
        [
          "Rated output",
          "About 940 W at maximum power"
        ],
        [
          "Trackers",
          "3 MPPTs, one per string"
        ],
        [
          "Wiring",
          "14 AWG, rated 600 V / 30 A"
        ]
      ],
      "story": "The array came with the donor car, so our first job was to find out what it could still do. We measured each string's open-circuit voltage and short-circuit current, mapped every bypass diode, and kept the three-string layout so each section has its own maximum power point tracker. The array is bonded to the top shell, which hinges open on the left side and is held shut by two key latches plus a steel-cable lanyard as a backup.",
      "materials": [
        "array"
      ],
      "hotspot": {
        "position": "-0.137m 0.721m 0.317m",
        "normal": "0m 1m 0m"
      },
      "view": {
        "orbit": "20deg 32deg 7.5m",
        "target": "-0m 0.616m -0m",
        "seeInside": false
      }
    },
    {
      "id": "battery",
      "name": "Battery Pack",
      "group": "Energy",
      "summary": "A 100 V lithium-ion pack stores solar energy for cloudy stretches and hard acceleration.",
      "specs": [
        [
          "Pack",
          "About 100 V nominal, 5 kWh, under 20 kg"
        ],
        [
          "Cells",
          "18650 Li-ion in a 15-parallel layout (420 Panasonic NCR18650B, 28s15p)"
        ],
        [
          "Protection",
          "Orion 2 BMS with control over the pack contactors"
        ],
        [
          "Enclosure",
          "Removable fiberglass honeycomb box with exhaust fans"
        ]
      ],
      "story": "We tested the donor pack against an 80% capacity threshold before deciding whether to rebuild it, and designed a backup pack of 405 LG MJ1 cells (27s15p) for that case. The battery management system watches every cell's voltage and the pack current, and it can open the contactors on its own if anything goes out of range. Fans at the back of the box pull warm air out of the car, away from the driver.",
      "materials": [
        "battery",
        "batterylid",
        "cells"
      ],
      "hotspot": {
        "position": "1.325m 0.636m 0m",
        "normal": "0m 1m 0m"
      },
      "view": {
        "orbit": "60deg 50deg 2.6m",
        "target": "1.325m 0.591m 0m",
        "seeInside": true
      }
    },
    {
      "id": "power",
      "name": "Power Distribution",
      "group": "Energy",
      "summary": "The high-voltage system moves power between the battery, array and motor, and it can shut down safely.",
      "specs": [
        [
          "Main bus",
          "About 100 V, 70 A fuse, double-insulated 6 AWG wire"
        ],
        [
          "Contactors",
          "5: two pack terminals, precharge, array and motor isolation"
        ],
        [
          "Low-voltage supply",
          "96 V to 12 V DC-DC converter"
        ],
        [
          "Motor",
          "Mitsuba M2096-DIII hub motor, about 95% efficient, with regenerative braking"
        ]
      ],
      "story": "Emergency-stop switches inside and outside the car open the contactors and isolate the pack. When that happens, a separate supplementary pack keeps the 12 V systems (lights, controls, telemetry) running. We converted the car from two motors to one front-left hub motor to save cost and weight, and tuned its acceleration curve for efficiency.",
      "materials": [
        "power"
      ],
      "hotspot": {
        "position": "0.47m 0.676m -0.34m",
        "normal": "0m 1m 0m"
      },
      "view": {
        "orbit": "140deg 68deg 2.4m",
        "target": "0.748m 0.541m -0.25m",
        "seeInside": true
      }
    },
    {
      "id": "aeroshell",
      "name": "Aeroshell",
      "group": "Body & Structure",
      "summary": "A carbon fiber body with five fairings: four wheel pods and a center canopy.",
      "specs": [
        [
          "Construction",
          "Carbon fiber shell, polycarbonate canopy"
        ],
        [
          "Drag coefficient",
          "Estimated 0.10–0.13"
        ],
        [
          "Drag at 45 mph",
          "About 56 N (first estimate)"
        ],
        [
          "Layout",
          "Symmetric five-fairing design"
        ]
      ],
      "story": "A new shell would have taken about 30% of our budget, so we kept Argo's aeroshell and spent our effort on everything underneath it. To check its efficiency we built a simplified model for flow simulation, which gave a first drag estimate of 0.14; we expect the real figure to be between 0.10 and 0.13. The canopy has a spring-loaded positive latch the driver can open from the inside.",
      "materials": [
        "aeroshell",
        "canopy"
      ],
      "hotspot": {
        "position": "2.246m 0.571m -0m",
        "normal": "0.3m 1m 0m"
      },
      "view": {
        "orbit": "50deg 72deg 7.5m",
        "target": "-0m 0.551m -0m",
        "seeInside": false
      }
    },
    {
      "id": "rollcage",
      "name": "Roll Cage",
      "group": "Body & Structure",
      "summary": "A two-hoop chromoly steel cage that protects the driver in a rollover or collision.",
      "specs": [
        [
          "Material",
          "4130 chromoly steel, TIG welded"
        ],
        [
          "Tubes",
          "1.25 in × 0.12 in main bars; 1.0 in × 0.094 in elsewhere"
        ],
        [
          "Tested yield after welding",
          "94 ksi (650 MPa)"
        ],
        [
          "Lowest safety factor",
          "1.17 across ten 5 g load cases"
        ]
      ],
      "story": "We designed the cage from scratch to fit inside the existing canopy and went through about 20 versions before the final one. Instead of trusting handbook values, we bent welded tube samples to failure in a four-point bend test and found the welded joints kept 87% of the base strength. Every load case in the simulation passed with the more conservative strength we assumed at first. The driver sits in a five-point harness whose mounts were checked the same way.",
      "materials": [
        "rollcage"
      ],
      "hotspot": {
        "position": "-0.695m 0.746m -0.125m",
        "normal": "0m 1m 0m"
      },
      "view": {
        "orbit": "60deg 58deg 2.4m",
        "target": "-0.565m 0.418m -0m",
        "seeInside": true
      }
    },
    {
      "id": "controls",
      "name": "Driver Control Systems",
      "group": "Electronics",
      "summary": "Custom circuit boards that turn the driver's inputs into commands across the car.",
      "specs": [
        [
          "Architecture",
          "Separate control nodes on the 12 V line, linked by CAN bus"
        ],
        [
          "Microcontroller",
          "STM32F303K8 on each node"
        ],
        [
          "Nodes",
          "Cockpit controls, pedals, startup and contactors, lighting, display"
        ],
        [
          "Display",
          "Android tablet on the steering wheel"
        ]
      ],
      "story": "Instead of one central computer, each job in the car has its own small board: the steering wheel buttons, the throttle and brake pedals, the startup sequence, and the lights. The boards share data over a CAN bus, so a fault in one area stays contained. Team members designed and soldered the boards themselves. The driver uses steering-wheel switches for turn signals and regenerative braking, with a tablet showing live vehicle data.",
      "materials": [
        "controls"
      ],
      "hotspot": {
        "position": "0.693m 0.603m 0.133m",
        "normal": "0m 1m 0m"
      },
      "view": {
        "orbit": "75deg 50deg 2.4m",
        "target": "0.606m 0.555m -0m",
        "seeInside": true
      }
    },
    {
      "id": "steering",
      "name": "Steering",
      "group": "Vehicle Dynamics",
      "summary": "An offset rack-and-pinion system with a quick-release wheel so the driver can get out fast.",
      "specs": [
        [
          "Type",
          "Rack and pinion, offset"
        ],
        [
          "Steering wheel",
          "300 mm round, quick release"
        ],
        [
          "Column",
          "Carbon fiber tube with a splined double U-joint"
        ],
        [
          "Safety factor",
          "Over 100 at 20 N·m driver input"
        ]
      ],
      "story": "The rack is offset so it clears the brake fluid reservoirs, and the column uses a double U-joint to route around the battery box. Shims between the steering arm and the rack set the alignment and also act as hard steering stops. The column is a filament-wound carbon tube built for twisting loads, which keeps it light.",
      "materials": [
        "steering"
      ],
      "hotspot": {
        "position": "0.868m 0.616m 0.2m",
        "normal": "0m 1m 0m"
      },
      "view": {
        "orbit": "70deg 62deg 3.8m",
        "target": "0.548m 0.581m 0m",
        "seeInside": true
      }
    },
    {
      "id": "suspension",
      "name": "Suspension & Wheels",
      "group": "Vehicle Dynamics",
      "summary": "Double-wishbone suspension at all four corners on custom-machined wheels, tuned for stable highway driving.",
      "specs": [
        [
          "Type",
          "Unequal-length double wishbone, front and rear"
        ],
        [
          "Dampers",
          "FOX air shocks, 3 in total travel"
        ],
        [
          "Material",
          "7075-T6 aluminum arms and CNC-machined wheels"
        ],
        [
          "Lowest safety factor",
          "1.5 under 1 g turn, 1 g brake and 2 g bump"
        ]
      ],
      "story": "We redesigned the arms, hubs and wheels for the single-motor layout. The wishbones had to fit in the narrow space inside each wheel fairing, so they are set up for straight-line stability with just enough camber gain for track racing. Moving to one motor shifted about 12 kg off the right front wheel, so we added ballast boxes to keep the front corners balanced. Brakes are hydraulic discs with separate front and rear circuits.",
      "materials": [
        "suspension",
        "wheels",
        "rims"
      ],
      "hotspot": {
        "position": "0.787m 0.149m 0.81m",
        "normal": "0m 0m 1m"
      },
      "view": {
        "orbit": "35deg 76deg 4.8m",
        "target": "0.997m 0.314m 0.595m",
        "seeInside": true
      }
    },
    {
      "id": "telemetry",
      "name": "Telemetry",
      "group": "Electronics",
      "summary": "A radio link that streams live car data to the chase vehicle so strategy calls can be made on the road.",
      "specs": [
        [
          "Radio",
          "XBee Pro module with external antenna"
        ],
        [
          "Data",
          "Battery, BMS faults, motor controller, MPPTs, contactors"
        ],
        [
          "Source",
          "Read directly from the CAN bus"
        ],
        [
          "Receiver",
          "Chase vehicle following the car"
        ]
      ],
      "story": "On a 1,500-mile road event the team in the chase car has to know what the car is doing at all times. The telemetry node listens to every message on the CAN bus, picks out the values that matter for strategy and safety, and sends them by radio to the chase vehicle. That lets the crew manage battery charge, spot faults early and decide when to push or save energy.",
      "materials": [],
      "hotspot": {
        "position": "0.218m 0.691m 0m",
        "normal": "0m 1m 0m"
      },
      "view": {
        "orbit": "60deg 55deg 3m",
        "target": "0.248m 0.601m 0m",
        "seeInside": true
      }
    }
  ],
  "note": "Model from the team&rsquo;s master CAD in Duodecim&rsquo;s 2024 race livery, with sponsor names shown as plain text. The steering rack and steering wheel are simplified stand-ins, and the 420 battery cells are drawn as simple cylinders."
};
