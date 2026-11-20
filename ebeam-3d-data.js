/* Mobile E-Beam Treatment Station 3D explorer - content and settings
   ------------------------------------------------------------------
   Edit this file to change the text, the model file, or where each
   numbered marker sits. Sources: the published thesis abstract
   (Texas A&M OAKTrust, May 2024), the thesis CAD part files (all
   dimensions below were measured from them) and the SolidWorks
   assembly screenshots.

   model          path to the .glb file
   overview       starting camera: orbit = "angle-around angle-down distance"
   shellMaterials trailer and shielding walls (see-through by default;
                  the "Solid walls" switch makes them opaque)
   modes          poses of the one animation in the model ("Operate"):
                  0 s transport, 1 s operating (the door is static,
                  shown open as drawn in the CAD), 3 s door open
   systems[].materials       materials that glow when the system is picked
   systems[].hotspot         marker position / surface direction (metres)
   systems[].view            camera for that system

   Model axes: x along the trailer (- = drum end, + = chiller end),
   y up from the floor of the drop-deck well, z across (+ = door side).
   Open the page with ?edit3d to read new marker and camera values.
*/
window.EBEAM_3D = {
  "model": "models/ebeam-station.glb?v=3",
  "note": "The final design iteration, rebuilt for the web from the thesis CAD parts and SolidWorks assembly screenshots. Part sizes come straight from the CAD files; where the screenshots could not fix a position exactly, the part sits where the screenshots show it. The radiation door is shown open, as drawn in the final design.",
  "overview": { "orbit": "-40deg 60deg 27m", "target": "0m 1.3m 0m" },
  "shellMaterials": ["shell", "shield"],
  "modes": [
    { "id": "transport", "label": "Transport", "time": 0,
      "caption": "Road mode: the chimney is stowed and the beam is off. The whole station travels as one oversize load on a single trailer. The door is shown open, as drawn in the CAD." },
    { "id": "operating", "label": "Operating", "time": 1, "beam": true,
      "caption": "Treating soil: the chimney is raised to exhaust filtered off-gas and the 3 MeV beam (yellow) scans the 0.5 cm soil layer on the belt. The door is shown open, as drawn in the CAD." }
  ],
  "startMode": "operating",
  "station": {
    "name": "Mobile E-Beam Treatment Station",
    "intro": "A single-trailer electron beam facility that treats PFAS-contaminated soil on site instead of hauling it to a fixed plant. Soil leaves a feed drum, runs on a metal belt under a 3 MeV beam inside a 6 in stainless steel vault, and returns to a treated-soil drum while the off-gas is captured and filtered.",
    "facts": [
      ["Beam", "3 MeV, 50 kW"],
      ["Soil layer", "0.5 cm (optimal at 3 MeV)"],
      ["Shielding", "About 6 in stainless steel"],
      ["Trailer", "48 ft × 8.5 ft drop deck"],
      ["Chassis", "3+ axles, oversize load"],
      ["Design tools", "SolidWorks, FEA, PUFFIn+"]
    ]
  },
  "systems": [
    {
      "id": "vault", "name": "Shielded Trailer & Vault", "group": "Structure & shielding",
      "materials": ["shell", "shield", "hardware"],
      "hotspot": { "position": "2.6m 3.08m 0.9m", "normal": "0m 1m 0m" },
      "view": { "orbit": "-30deg 62deg 28.9m", "target": "-1.5m 1.4m 0m" },
      "summary": "Everything rides in one 48 ft drop-deck trailer. The treatment room and the accelerator room sit inside a continuous stainless steel vault with walls about 6 in thick.",
      "specs": [["Trailer", "48 ft long × 8.5 ft wide"], ["Box height", "10.1 ft over the drop well"], ["Vault walls", "0.15 m (5.9 in) stainless"], ["Treatment room", "13.4 × 7.5 × 9.1 ft inside"], ["Accelerator room", "14.3 ft long, behind a 6 in bulkhead"], ["End bays", "Drum bay and chiller/controls bay, 8 ft tall"]],
      "story": "My first layout weighed about 40 tons, far too heavy to pull on a trailer. The final layout keeps the thick steel around the two beam rooms, the treatment room and the accelerator room, and drops both floors 25 in into the trailer well. The thesis recommends one trailer on a chassis with three or more axles, moved as an oversize load."
    },
    {
      "id": "feed", "name": "Contaminated Soil Feed", "group": "Material handling",
      "materials": ["drum_red", "pipe_red"],
      "hotspot": { "position": "-5.93m 1.62m 0.9m", "normal": "0m 1m 0m" },
      "view": { "orbit": "-55deg 60deg 11.0m", "target": "-4.6m 0.9m -0.2m" },
      "summary": "Contaminated soil starts in the red 55 gal feed drum in the rear bay. An enclosed 7 in tube carries it through the vault wall and drops it into the blue knife-edge box at the feed end of the conveyor.",
      "specs": [["Feed drum", "55 gal (red)"], ["Transfer tube", "7 in OD, enclosed"], ["Wall pass", "Through the 6 in rear wall"], ["Drop point", "Knife-edge box at the feed end"]],
      "story": "The feed and treated-soil drums sit in the rear bay, outside the shielding. The feed tube rises over the conveyor and drops into the knife-edge box at the feed end of the belt."
    },
    {
      "id": "conveyor", "name": "Modular Conveyor & 0.5 cm Soil Bed", "group": "Material handling",
      "materials": ["conveyor", "roller", "soil", "knife", "guide"],
      "hotspot": { "position": "-2.62m 0.94m 0m", "normal": "0m 1m 0m" },
      "view": { "orbit": "-22deg 55deg 4.2m", "target": "-2.75m 0.85m 0m" },
      "summary": "Six 1 ft conveyor modules, three long and two high, carry the soil under the beam. A knife-edge box at the feed end levels it into a thin bed, and two guide plates steer it off the head roller into the hopper.",
      "specs": [["Modules", "1 ft × 18 in × 6 in, 3 long × 2 high"], ["Conveyor", "3 ft long, 18 in wide, 12 in tall"], ["Soil layer", "0.5 cm thick"], ["Levelling", "Knife-edge box, 18.5 × 10.25 in"], ["Discharge", "Head roller and two guide plates"], ["Belt", "Metal alloy"]],
      "story": "PUFFIn+ simulations of beam energy, soil thickness and beam use set the layer: at 3 MeV the best soil thickness is 0.5 cm. The thesis also recommends metal-alloy conveyors for every part that touches the soil, so nothing in the process line can become a source of contamination."
    },
    {
      "id": "beamline", "name": "Scan Horn & Beam Window", "group": "Irradiation",
      "materials": ["horn", "beam", "beamtube", "beamstop"],
      "hotspot": { "position": "-3.02m 1.2m 0.19m", "normal": "0m 0m 1m" },
      "view": { "orbit": "-35deg 68deg 7.0m", "target": "-2.6m 1.1m 0m" },
      "summary": "The beam leaves the accelerator through a drift tube, turns down through a 90° elbow and fans out in a thin scan horn across the width of the belt. An open beam-stop box under the conveyor takes the beam that passes through.",
      "specs": [["Beam energy", "3 MeV"], ["Beam power", "50 kW"], ["Beam line", "On the trailer centreline"], ["Horn exit", "About 24 × 4 in, across the belt"], ["Beam stop", "8 × 36 × 12 in open box"]],
      "story": "The drift tube runs on the trailer centreline from the accelerator through the bulkhead. A 90° elbow turns the beam down into the scan horn, which spreads it across the full width of the belt. The beam stop sits right under the scan line, and the conveyor rests on it."
    },
    {
      "id": "accelerator", "name": "Electron Accelerator", "group": "Irradiation",
      "materials": ["accel", "frame"],
      "hotspot": { "position": "0.44m 2.22m 0m", "normal": "0m 1m 0m" },
      "view": { "orbit": "-40deg 58deg 11.9m", "target": "0.4m 1.4m 0m" },
      "summary": "A 3 MeV, 50 kW accelerator on a steel stand fills the accelerator room, separated from the treatment room by a 6 in bulkhead.",
      "specs": [["Energy", "3 MeV"], ["Power", "50 kW"], ["Modelled size", "About 8.5 × 4 × 3.6 ft"], ["Shielding", "Clamshell shielding recommended"]],
      "story": "I used PUFFIn+ to simulate beam energy, soil thickness and beam use. The thesis recommends a 3 MeV, 50 kW beam, about 6 in of stainless steel around the treatment room, and clamshell shielding around the accelerator itself."
    },
    {
      "id": "return", "name": "Treated Soil Return", "group": "Material handling",
      "materials": ["hopper", "pipe_green", "drum_green"],
      "hotspot": { "position": "-6.1m 1.62m -0.09m", "normal": "0m 1m 0m" },
      "view": { "orbit": "-60deg 58deg 11.0m", "target": "-4.5m 1.0m 0m" },
      "summary": "Treated soil drops off the belt into a steel discharge hopper and climbs an inclined 7 in tube back through the rear wall to the green 55 gal drum.",
      "specs": [["Hopper", "14.4 in square, steel"], ["Return tube", "7 in OD, inclined"], ["Treated drum", "55 gal (green)"], ["Path", "Up, over and down into the drum"]],
      "story": "Soil leaves the belt over the head roller, falls through the hopper and is carried up and over into the green drum, ready to go back to the site."
    },
    {
      "id": "door", "name": "Stepped Radiation Door", "group": "Access & safety",
      "materials": ["door_arm", "door_leaf"],
      "hotspot": { "position": "-1.97m 1.2m 1.96m", "normal": "0.32m 0m 0.95m" },
      "view": { "orbit": "-20deg 66deg 9.5m", "target": "-2.0m 1.2m 1.4m" },
      "summary": "A 42 × 84 in opening in the near wall gives access to the treatment room. Its stepped steel plug is shown open, as drawn in the CAD, held clear of the opening on a swing arm hung from two wall hinges.",
      "specs": [["Opening", "42 × 84 in"], ["Plug", "3 steps, about 6 in deep"], ["Hinges", "Two, on the trailer wall"], ["Shown", "Open, as drawn in the CAD"], ["Bulkhead door", "36 × 84 in, inside"]],
      "story": "A flat door would leave a straight gap round its edge. The stepped plug means any gap has to turn corners. The swing arm carries the heavy plug out of the opening and parks it beside the wall."
    },
    {
      "id": "offgas", "name": "Off-Gas Capture & Chimney", "group": "Environmental",
      "materials": ["hood", "duct_dark", "duct", "filter", "chim_base", "chim_mid", "chim_top"],
      "hotspot": { "position": "-4.7m 3.12m -0.75m", "normal": "0m 1m 0m" },
      "view": { "orbit": "-50deg 55deg 12.8m", "target": "-3.6m 2.3m -0.3m" },
      "summary": "A fume hood over the beam window pulls off-gas into a ceiling duct, through a labyrinth and an air filter, and out a telescoping chimney on the roof.",
      "specs": [["Fume hood", "48 × 50 × 42 in"], ["Air filter", "30 × 30 × 12 in"], ["Chimney", "3 telescoping sections"], ["Section lengths", "19, 30 and 30 in"]],
      "story": "Treating soil with the beam drives off vapours, so the air is captured right at the beam window. The ducts reach the roof through stepped labyrinth boxes, and the chimney stows for the road and raises on site. Switch between Transport and Operating to see it move."
    },
    {
      "id": "support", "name": "Cooling & Controls", "group": "Support systems",
      "materials": ["chiller", "chiller_frame", "chill_pipe", "cabinet"],
      "hotspot": { "position": "4.49m 2.98m -0.72m", "normal": "0m 1m 0m" },
      "view": { "orbit": "-55deg 58deg 13.6m", "target": "4.6m 1.4m 0m" },
      "summary": "The front bay holds the process chiller that cools the accelerator and four control and power cabinets, all outside the shielding.",
      "specs": [["Chiller", "About 106 × 43 × 91 in"], ["Cabinets", "4, each 24 × 36 × 72 in"], ["Location", "Front bay, outside the vault"], ["Cooling lines", "2.5 in, through the front wall"]],
      "story": "The chiller and electronics sit in the front bay, outside the shielding and away from the beam. Cooling lines run through the front vault wall to the accelerator."
    }
  ]
};
