import type { ClauseSeed } from "./types";

/**
 * Seed assumptions a subcontractor commonly states to protect their bid.
 * Entries with an empty `trades` array apply to every trade.
 */
export const ASSUMPTION_LIBRARY: ClauseSeed[] = [
  // ---- General: schedule & access -----------------------------------------
  { id: "asm-normal-hours", trades: [], text: "All work is performed during normal business hours, Monday through Friday, 7:00 AM to 3:30 PM, excluding holidays." },
  { id: "asm-no-overtime", trades: [], text: "No overtime, premium time, shift work, or weekend work is included." },
  { id: "asm-continuous-access", trades: [], text: "Continuous and unobstructed access to all work areas is provided during scheduled work hours." },
  { id: "asm-single-mobilization", trades: [], text: "Pricing is based on a single mobilization. Additional mobilizations will be billed as a change order." },
  { id: "asm-work-sequence", trades: [], text: "Our work may proceed in a continuous, uninterrupted sequence once started." },
  { id: "asm-schedule-provided", trades: [], text: "A project schedule will be provided by the GC prior to mobilization, and our scope will be sequenced accordingly." },
  { id: "asm-adjacent-complete", trades: [], text: "All preceding and adjacent work by other trades is complete and acceptable prior to the start of our work." },
  { id: "asm-laydown-area", trades: [], text: "The GC provides an on-site laydown and staging area within reasonable distance of the work." },
  { id: "asm-parking", trades: [], text: "Adequate on-site parking is available for our crews at no cost." },
  { id: "asm-hoisting-by-gc", trades: [], text: "The GC provides hoisting, cranes, and material handling to floor for materials exceeding two-person carry." },

  // ---- General: site conditions & utilities --------------------------------
  { id: "asm-temp-power", trades: [], text: "Temporary power, lighting, water, and toilet facilities are provided by the GC at no cost to us." },
  { id: "asm-dry-site", trades: [], text: "The site is dry, weather-tight, and maintained at working temperature where required for our work." },
  { id: "asm-no-hazmat", trades: [], text: "No hazardous materials (asbestos, lead, mold, PCBs, contaminated soil) are present or will be encountered." },
  { id: "asm-existing-conditions", trades: [], text: "Existing conditions are as shown on the documents and as observed during the site walkthrough." },
  { id: "asm-no-unforeseen", trades: [], text: "No unforeseen or concealed conditions requiring additional work will be encountered." },
  { id: "asm-dumpster", trades: [], text: "The GC provides a dumpster on site; our scope includes only removal of our own debris to that dumpster." },
  { id: "asm-security", trades: [], text: "The site is secured by the GC. We are not responsible for theft or vandalism of installed or stored materials." },

  // ---- General: documents, pricing & coordination ---------------------------
  { id: "asm-per-documents", trades: [], text: "This proposal is based solely on the documents listed and any addenda issued prior to the bid date." },
  { id: "asm-no-addenda-after", trades: [], text: "Addenda issued after our bid date are not included and may affect pricing." },
  { id: "asm-material-escalation", trades: [], text: "Pricing is based on current material costs. Escalation beyond the proposal validity period will be reviewed." },
  { id: "asm-lead-times", trades: [], text: "Quoted lead times are current at bid date and are subject to supplier confirmation at time of award." },
  { id: "asm-standard-warranty", trades: [], text: "A standard one-year workmanship warranty from substantial completion is included." },
  { id: "asm-layout-by-gc", trades: [], text: "The GC provides accurate control lines, benchmarks, and dimensional layout for our work." },
  { id: "asm-permits-by-gc", trades: [], text: "The general building permit is provided by the GC; our scope includes only our trade permit where noted." },
  { id: "asm-no-bim", trades: [], text: "No BIM modeling, clash detection, or 3D coordination is included unless explicitly stated." },
  { id: "asm-asbuilts-redline", trades: [], text: "As-built documentation is limited to redlined field drawings." },

  // ---- Electrical ----------------------------------------------------------
  { id: "asm-elec-existing-service", trades: ["electrical"], text: "The existing electrical service has adequate capacity for the new loads without upgrade." },
  { id: "asm-elec-shutdowns", trades: ["electrical"], text: "Utility shutdowns and tie-ins occur during normal hours and are coordinated by the GC." },
  { id: "asm-elec-circuits-accessible", trades: ["electrical"], text: "Existing circuits, panels, and junction boxes are accessible and correctly labeled." },
  { id: "asm-elec-ceiling-access", trades: ["electrical"], text: "Accessible ceilings are open, or ceiling tile removal and replacement is by others." },
  { id: "asm-elec-fixture-spec", trades: ["electrical", "low_voltage"], text: "Fixtures and devices are as specified; substitutions require review and may affect pricing." },

  // ---- Plumbing ------------------------------------------------------------
  { id: "asm-plmb-existing-lines", trades: ["plumbing"], text: "Existing water, waste, and vent lines are in serviceable condition and correctly located per the documents." },
  { id: "asm-plmb-no-rework", trades: ["plumbing"], text: "No rework of existing piping outside the scoped area is required to complete our work." },
  { id: "asm-plmb-shutoff", trades: ["plumbing"], text: "Water shutoffs are coordinated by the GC and occur during normal hours." },
  { id: "asm-plmb-fixture-supply", trades: ["plumbing"], text: "Plumbing fixtures and trim are furnished as specified; owner-furnished fixtures are delivered on schedule and undamaged." },

  // ---- HVAC ----------------------------------------------------------------
  { id: "asm-hvac-existing-equip", trades: ["hvac"], text: "Existing HVAC equipment to remain is in good working order and requires no repair." },
  { id: "asm-hvac-structural", trades: ["hvac"], text: "The existing structure supports new equipment loads without reinforcement." },
  { id: "asm-hvac-controls-tie", trades: ["hvac", "low_voltage"], text: "Existing controls are compatible and available for tie-in without upgrade." },
  { id: "asm-hvac-tab-access", trades: ["hvac"], text: "Access for testing, adjusting, and balancing is available during a single continuous visit." },

  // ---- Concrete / earthwork ------------------------------------------------
  { id: "asm-conc-subgrade", trades: ["concrete", "earthwork"], text: "Subgrade is compacted, stable, and ready to receive our work, and is provided by others." },
  { id: "asm-conc-soil-report", trades: ["concrete", "earthwork"], text: "Soil conditions are as represented in the geotechnical report; no rock or groundwater is encountered." },
  { id: "asm-conc-pump-access", trades: ["concrete"], text: "Concrete truck and pump access is available within reasonable reach of all placements." },
  { id: "asm-conc-testing-by-others", trades: ["concrete"], text: "Concrete testing and special inspection is provided and paid for by the owner or GC." },
  { id: "asm-earth-spoils-onsite", trades: ["earthwork"], text: "Excess spoils may be spread or stockpiled on site; off-site haul is not included." },

  // ---- Framing / drywall / finishes ---------------------------------------
  { id: "asm-dw-level4", trades: ["drywall"], text: "Drywall finish is Level 4 in typical areas; Level 5 is not included unless specified." },
  { id: "asm-dw-temp-climate", trades: ["drywall", "painting", "flooring"], text: "The building is enclosed and climate-controlled prior to the start of our work." },
  { id: "asm-frame-tolerance", trades: ["framing", "drywall"], text: "Existing substrates are within industry-standard tolerance and require no additional shimming or furring." },
  { id: "asm-paint-two-coats", trades: ["painting"], text: "Pricing is based on two finish coats over a properly prepared substrate in standard colors." },
  { id: "asm-floor-substrate", trades: ["flooring"], text: "The substrate is level, clean, dry, and within the manufacturer's moisture tolerance prior to installation." },

  // ---- Roofing / envelope --------------------------------------------------
  { id: "asm-roof-deck-sound", trades: ["roofing"], text: "The existing roof deck is structurally sound and requires no repair or replacement." },
  { id: "asm-roof-weather", trades: ["roofing"], text: "Work proceeds in dry weather; delays due to weather are not our responsibility and may extend the schedule." },
  { id: "asm-roof-one-layer", trades: ["roofing"], text: "No more than one existing roofing layer is present for tear-off." },

  // ---- Steel / masonry / demolition ---------------------------------------
  { id: "asm-steel-shop-approval", trades: ["steel"], text: "Shop drawings are reviewed and returned within ten business days of submission." },
  { id: "asm-steel-crane-access", trades: ["steel"], text: "Crane access and adequate set-up area are available at the erection location." },
  { id: "asm-masonry-scaffold", trades: ["masonry"], text: "Scaffolding is erected and maintained by us for our work only and is not shared with other trades." },
  { id: "asm-demo-no-structural", trades: ["demolition"], text: "Demolition is non-structural; no shoring or structural engineering is included." },
  { id: "asm-demo-utilities-off", trades: ["demolition"], text: "All utilities serving the demolition area are disconnected and made safe by others prior to our start." },

  // ---- Fire protection / low voltage ---------------------------------------
  { id: "asm-fp-hydraulic", trades: ["fire_protection"], text: "The existing water supply meets hydraulic demand without a fire pump or service upgrade." },
  { id: "asm-fp-ahj-standard", trades: ["fire_protection"], text: "The AHJ accepts a standard design approach; no unusual review or redesign is required." },
  { id: "asm-lv-pathways", trades: ["low_voltage"], text: "Pathways, conduit, and backboxes are provided by the electrical contractor." },
];
