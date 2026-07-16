import type { ClauseSeed } from "./types";

/**
 * Seed exclusions — work the subcontractor is explicitly NOT doing.
 * Entries with an empty `trades` array apply to every trade.
 */
export const EXCLUSION_LIBRARY: ClauseSeed[] = [
  // ---- General: money & contract -------------------------------------------
  { id: "exc-bonds", trades: [], text: "Payment and performance bonds (available at additional cost if required)." },
  { id: "exc-permits", trades: [], text: "Permits, permit fees, plan review fees, and impact fees." },
  { id: "exc-sales-tax", trades: [], text: "Sales, use, and gross receipts taxes where not included in the base bid." },
  { id: "exc-liquidated-damages", trades: [], text: "Liquidated damages and consequential damages of any kind." },
  { id: "exc-escalation", trades: [], text: "Material price escalation beyond the proposal validity period." },
  { id: "exc-overtime", trades: [], text: "Overtime, premium time, shift work, and weekend or holiday work." },
  { id: "exc-winter-conditions", trades: [], text: "Winter conditions, temporary heat, temporary enclosures, and weather protection." },

  // ---- General: engineering & documentation --------------------------------
  { id: "exc-engineering", trades: [], text: "Professional engineering, structural design, and stamped calculations." },
  { id: "exc-bim", trades: [], text: "BIM modeling, 3D coordination, and clash detection." },
  { id: "exc-asbuilts-cad", trades: [], text: "CAD or BIM as-built deliverables; redlined field drawings only." },
  { id: "exc-commissioning", trades: [], text: "Third-party commissioning and commissioning agent support." },
  { id: "exc-testing-inspection", trades: [], text: "Special inspection, third-party testing, and independent laboratory fees." },
  { id: "exc-leed", trades: [], text: "LEED documentation, tracking, and certification support." },

  // ---- General: site work by others ----------------------------------------
  { id: "exc-temp-power", trades: [], text: "Temporary power, temporary lighting, temporary water, and temporary toilets." },
  { id: "exc-hazmat", trades: [], text: "Abatement or handling of asbestos, lead, mold, PCBs, contaminated soil, or any hazardous material." },
  { id: "exc-unforeseen", trades: [], text: "Work arising from unforeseen, concealed, or differing site conditions." },
  { id: "exc-cutting-patching", trades: [], text: "Cutting, patching, and repair of finished surfaces." },
  { id: "exc-painting-others", trades: [], text: "Painting, finishing, and touch-up of our work by us unless explicitly scoped." },
  { id: "exc-firestopping", trades: [], text: "Firestopping and fire-rated penetration sealing." },
  { id: "exc-final-clean", trades: [], text: "Final cleaning; our scope is limited to removal of our own debris." },
  { id: "exc-dumpster", trades: [], text: "Dumpsters, waste hauling, and disposal fees." },
  { id: "exc-hoisting", trades: [], text: "Cranes, hoisting, and material handling to floor." },
  { id: "exc-scaffolding", trades: [], text: "Scaffolding, swing stages, and mast climbers not required for our own work." },
  { id: "exc-security", trades: [], text: "Site security and protection of installed work from damage by others." },
  { id: "exc-snow-removal", trades: [], text: "Snow removal, dewatering, and site drainage maintenance." },
  { id: "exc-traffic-control", trades: [], text: "Traffic control, flagging, barricades, and street closure permits." },
  { id: "exc-survey", trades: [], text: "Surveying, layout control, and establishment of benchmarks." },
  { id: "exc-x-ray", trades: [], text: "X-ray, GPR scanning, and locating of existing embedded utilities." },

  // ---- Electrical ----------------------------------------------------------
  { id: "exc-elec-service-upgrade", trades: ["electrical"], text: "Utility company fees, service upgrades, and transformer work by the utility." },
  { id: "exc-elec-temp-power", trades: ["electrical"], text: "Temporary power distribution and maintenance for other trades." },
  { id: "exc-elec-ceiling", trades: ["electrical", "low_voltage", "fire_protection"], text: "Removal and replacement of ceiling tile and grid to access work above." },
  { id: "exc-elec-lv", trades: ["electrical"], text: "Low-voltage, data, security, and audiovisual systems and cabling." },
  { id: "exc-elec-equipment-connections", trades: ["electrical"], text: "Final connections to owner-furnished equipment not shown on the documents." },

  // ---- Plumbing / fire protection -------------------------------------------
  { id: "exc-plmb-fixtures", trades: ["plumbing"], text: "Owner-furnished plumbing fixtures, trim, and appliances." },
  { id: "exc-plmb-site-utilities", trades: ["plumbing"], text: "Site utilities beyond five feet of the building line." },
  { id: "exc-plmb-existing-repair", trades: ["plumbing"], text: "Repair or replacement of existing piping outside the scoped area." },
  { id: "exc-fp-pump", trades: ["fire_protection"], text: "Fire pumps, service upgrades, and underground fire main." },
  { id: "exc-fp-alarm", trades: ["fire_protection"], text: "Fire alarm system, devices, and monitoring." },

  // ---- HVAC ----------------------------------------------------------------
  { id: "exc-hvac-controls", trades: ["hvac"], text: "Building automation, DDC controls, and controls programming." },
  { id: "exc-hvac-tab", trades: ["hvac"], text: "Testing, adjusting, and balancing." },
  { id: "exc-hvac-structural", trades: ["hvac"], text: "Structural reinforcement, curbs, and housekeeping pads for equipment." },
  { id: "exc-hvac-elec", trades: ["hvac"], text: "Electrical power wiring, disconnects, and starters for HVAC equipment." },

  // ---- Concrete / earthwork / steel ----------------------------------------
  { id: "exc-conc-rebar-design", trades: ["concrete"], text: "Reinforcing design, detailing, and placing drawings." },
  { id: "exc-conc-subgrade", trades: ["concrete"], text: "Subgrade preparation, compaction, and proof rolling." },
  { id: "exc-earth-rock", trades: ["earthwork"], text: "Rock excavation, blasting, and removal of subsurface obstructions." },
  { id: "exc-earth-haul", trades: ["earthwork"], text: "Off-site haul, disposal, and import of select fill." },
  { id: "exc-earth-shoring", trades: ["earthwork", "demolition"], text: "Shoring, underpinning, and temporary support of excavation." },
  { id: "exc-steel-erection", trades: ["steel"], text: "Field welding inspection and non-destructive testing." },
  { id: "exc-steel-fireproofing", trades: ["steel"], text: "Spray-applied fireproofing and intumescent coatings." },

  // ---- Finishes / envelope -------------------------------------------------
  { id: "exc-dw-level5", trades: ["drywall"], text: "Level 5 finish, skim coating, and specialty textures." },
  { id: "exc-dw-insulation", trades: ["drywall"], text: "Acoustical insulation, sound sealant, and acoustical caulking." },
  { id: "exc-paint-specialty", trades: ["painting"], text: "Specialty coatings, epoxy floors, wall coverings, and high-performance finishes." },
  { id: "exc-floor-prep", trades: ["flooring"], text: "Substrate preparation, leveling compound, moisture mitigation, and grinding." },
  { id: "exc-roof-deck", trades: ["roofing"], text: "Roof deck repair or replacement, and structural work of any kind." },
  { id: "exc-roof-interior", trades: ["roofing"], text: "Interior protection and repair of interior finishes damaged by leaks." },
  { id: "exc-masonry-cleaning", trades: ["masonry"], text: "Final masonry cleaning, sealing, and efflorescence treatment." },
  { id: "exc-demo-structural", trades: ["demolition"], text: "Structural demolition, shoring, and engineering." },
];
