import type { ItbSpec } from "./itb-pdf";

/**
 * The demo projects.
 *
 * Each carries its own scope, so a bid's row, extraction, and PDF all describe
 * the same job. They previously shared one electrical extraction, which meant
 * the HVAC bid's extraction read "Northside Elementary — Electrical
 * Renovation" — a document contradicting its own row is worse than no
 * document.
 */

export interface DemoScopeItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  confidence: number;
}

export interface DemoProject {
  file: string;
  projectName: string;
  trade: string;
  /** Days from today; null means the ITB stated no deadline. */
  deadlineInDays: number | null;
  status: string;
  itb: Omit<ItbSpec, "scope"> & { scope: string[] };
  scope: DemoScopeItem[];
  compliance: Record<string, unknown>;
  assumptions: string[];
  clarifications: string[];
  exclusions: string[];
  warnings: string[];
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    file: "northside-elementary.pdf",
    projectName: "Northside Elementary — Electrical Renovation",
    trade: "electrical",
    deadlineInDays: 3,
    status: "draft",
    itb: {
      projectName: "Northside Elementary School — Electrical Renovation",
      projectAddress: "1420 Maple Ave, Dallas, TX 75201",
      owner: "Dallas Independent School District",
      generalContractor: "Turner Ridge Construction, LLC",
      bidDeadline: "August 12, 2026, 2:00 PM CST",
      rfiDeadline: "August 5, 2026",
      walkthrough: "July 29, 2026, 10:00 AM at the site",
      contactName: "Maria Alvarez",
      contactEmail: "malvarez@turnerridge.com",
      contactPhone: "(214) 555-0182",
      division: "DIVISION 26 ELECTRICAL",
      scope: [
        "Demolish and remove existing lighting fixtures in Classrooms 100-118, approximately 240 fixtures.",
        "Furnish and install new LED 2x4 troffers, 260 EA, in classrooms and corridors.",
        "Provide and install new 480V/208V, 300 kVA transformer in the main electrical room.",
        "Install approximately 3,500 LF of EMT conduit for branch circuits.",
        "Pull new copper branch wiring, approximately 12,000 LF, THHN #12 AWG.",
        "Furnish and install fire alarm devices to tie into existing panel (approx. 45 devices).",
      ],
      compliance: [
        "Bid Bond: 5% of bid amount required with submission.",
        "Performance & Payment Bond: 100% required upon award.",
        "Insurance: General Liability $2,000,000 aggregate; Auto $1,000,000; Workers Comp statutory.",
        "Prevailing Wage: This is a public project subject to Texas prevailing wage rates.",
        "Davis-Bacon: Federal Davis-Bacon wage rates apply.",
        "Licensing: Texas Master Electrician license required for supervisor of record.",
        "Prequalification: Bidders must be prequalified with the District prior to award.",
      ],
      exclusions: ["Temporary power", "Patching and painting", "Cutting of finished surfaces"],
    },
    scope: [
      { description: "Demolish and remove existing lighting fixtures, Classrooms 100-118", quantity: 240, unit: "EA", notes: null, confidence: 0.95 },
      { description: "Furnish and install LED 2x4 troffers", quantity: 260, unit: "EA", notes: null, confidence: 0.92 },
      { description: "Install 480V/208V, 300 kVA transformer", quantity: 1, unit: "EA", notes: "Main electrical room", confidence: 0.9 },
      { description: "Install EMT conduit for branch circuits", quantity: 3500, unit: "LF", notes: null, confidence: 0.85 },
      { description: "Pull copper branch wiring, THHN #12 AWG", quantity: 12000, unit: "LF", notes: null, confidence: 0.85 },
      { description: "Furnish and install fire alarm devices", quantity: 45, unit: "EA", notes: "Tie into existing panel", confidence: 0.7 },
    ],
    compliance: {
      bondRequired: true, bondPercent: 5, insuranceRequired: true,
      insuranceLimits: ["General Liability $2,000,000 aggregate", "Auto $1,000,000", "Workers Comp statutory"],
      licenseRequirements: ["Texas Master Electrician license"],
      prevailingWage: true, unionRequired: false, davisBacon: true, prequalRequired: true,
      otherRequirements: ["100% Performance & Payment Bond upon award"],
    },
    assumptions: [
      "All work is performed during normal business hours, Monday through Friday, 7:00 AM to 3:30 PM, excluding holidays.",
      "Temporary power, lighting, water, and toilet facilities are provided by the GC at no cost to us.",
      "The existing electrical service has adequate capacity for the new loads without upgrade.",
    ],
    clarifications: [
      "Has the existing electrical service capacity been verified as adequate for the new loads?",
      "What shutdown windows are available for tie-ins to the existing service?",
      "Is the lighting fixture package owner-furnished or contractor-furnished?",
    ],
    exclusions: [
      "Permits, permit fees, plan review fees, and impact fees.",
      "Payment and performance bonds (available at additional cost if required).",
      "Firestopping and fire-rated penetration sealing.",
      "Cutting, patching, and repair of finished surfaces.",
      "Low-voltage, data, security, and audiovisual systems and cabling.",
    ],
    warnings: [
      "Quantities for conduit, wiring, and fixtures are approximate per the document; verify before bidding.",
      "Fire alarm device scope may be handled as low_voltage; verify trade responsibility.",
    ],
  },
  {
    file: "municipal-water.pdf",
    projectName: "Municipal Water Treatment — Phase 2",
    trade: "plumbing",
    deadlineInDays: 1,
    status: "in_review",
    itb: {
      projectName: "Municipal Water Treatment Plant — Phase 2 Process Piping",
      projectAddress: "8800 Trinity Rd, Dallas, TX 75212",
      owner: "City of Dallas Water Utilities",
      generalContractor: "Ryan Companies",
      bidDeadline: "July 17, 2026, 11:00 AM CST",
      rfiDeadline: "July 10, 2026",
      walkthrough: "July 8, 2026, 9:00 AM at the plant gate",
      contactName: "Devon Price",
      contactEmail: "dprice@ryancompanies.com",
      contactPhone: "(214) 555-0144",
      division: "DIVISION 22 PLUMBING / PROCESS PIPING",
      scope: [
        "Furnish and install 1,800 LF of 12-inch ductile iron process piping, restrained joints.",
        "Install 14 EA butterfly valves, 12-inch, with manual actuators.",
        "Demolish and remove existing 8-inch cast iron header, approximately 400 LF.",
        "Furnish and install 6 EA chemical feed pump skids per the equipment schedule.",
        "Pressure test and disinfect all new potable lines per AWWA C651.",
      ],
      compliance: [
        "Bid Bond: 5% of bid amount required with submission.",
        "Insurance: General Liability $5,000,000 aggregate; Auto $1,000,000; Workers Comp statutory.",
        "Prevailing Wage: Public project subject to Texas prevailing wage rates.",
        "Licensing: Texas Master Plumber license required for supervisor of record.",
        "Prequalification: Bidders must be prequalified with the City prior to award.",
      ],
      exclusions: ["Site dewatering", "Excavation and backfill", "Electrical for pump skids"],
    },
    scope: [
      { description: "Furnish and install 12-inch ductile iron process piping, restrained joints", quantity: 1800, unit: "LF", notes: null, confidence: 0.93 },
      { description: "Install 12-inch butterfly valves with manual actuators", quantity: 14, unit: "EA", notes: null, confidence: 0.9 },
      { description: "Demolish and remove existing 8-inch cast iron header", quantity: 400, unit: "LF", notes: "Approximate", confidence: 0.78 },
      { description: "Furnish and install chemical feed pump skids", quantity: 6, unit: "EA", notes: "Per equipment schedule", confidence: 0.85 },
      { description: "Pressure test and disinfect new potable lines per AWWA C651", quantity: 1, unit: "LS", notes: null, confidence: 0.8 },
    ],
    compliance: {
      bondRequired: true, bondPercent: 5, insuranceRequired: true,
      insuranceLimits: ["General Liability $5,000,000 aggregate", "Auto $1,000,000", "Workers Comp statutory"],
      licenseRequirements: ["Texas Master Plumber license"],
      prevailingWage: true, unionRequired: false, davisBacon: false, prequalRequired: true,
      otherRequirements: [],
    },
    assumptions: [
      "Existing water, waste, and vent lines are in serviceable condition and correctly located per the documents.",
      "Water shutoffs are coordinated by the GC and occur during normal hours.",
      "The site is dry, weather-tight, and maintained at working temperature where required for our work.",
    ],
    clarifications: [
      "Please confirm the plumbing fixture schedule and who furnishes the trim and carriers.",
      "Have existing risers and waste lines been verified for location and condition?",
      "What retainage percentage applies, and when is it released?",
    ],
    exclusions: [
      "Permits, permit fees, plan review fees, and impact fees.",
      "Site utilities beyond five feet of the building line.",
      "Excavation, backfill, and compaction.",
      "Electrical power wiring, disconnects, and starters.",
      "Dewatering and site drainage maintenance.",
    ],
    warnings: [
      "Quantity for the cast iron header demolition is stated as approximate; verify in the field.",
      "Excavation responsibility is ambiguous — the ITB excludes it but the scope implies buried pipe.",
    ],
  },
  {
    file: "retail-hvac.pdf",
    projectName: "Retail Center — HVAC Retrofit",
    trade: "hvac",
    deadlineInDays: 21,
    status: "submitted",
    itb: {
      projectName: "Weitzman Retail Center — HVAC Retrofit",
      projectAddress: "3300 Preston Rd, Plano, TX 75093",
      owner: "Weitzman Group",
      generalContractor: "Hoar Construction",
      bidDeadline: "August 6, 2026, 3:00 PM CST",
      rfiDeadline: "July 30, 2026",
      walkthrough: "July 24, 2026, 8:00 AM at the management office",
      contactName: "Tara Nguyen",
      contactEmail: "tnguyen@hoarconstruction.com",
      contactPhone: "(972) 555-0119",
      division: "DIVISION 23 HVAC",
      scope: [
        "Remove and dispose of 12 EA existing rooftop units, 5-ton through 15-ton.",
        "Furnish and install 12 EA new high-efficiency rooftop units per the equipment schedule.",
        "Furnish and install approximately 2,400 LF of new insulated ductwork.",
        "Install 38 EA VAV boxes with controls tie-in.",
        "Provide start-up and owner training for all new equipment.",
      ],
      compliance: [
        "Bid Bond: not required for this project.",
        "Insurance: General Liability $2,000,000 aggregate; Auto $1,000,000; Workers Comp statutory.",
        "Prevailing Wage: does not apply — private project.",
        "Licensing: Texas HVAC contractor license required.",
      ],
      exclusions: ["Roof curbs and structural support", "Electrical power to units", "Controls programming"],
    },
    scope: [
      { description: "Remove and dispose of existing rooftop units, 5-ton through 15-ton", quantity: 12, unit: "EA", notes: null, confidence: 0.94 },
      { description: "Furnish and install high-efficiency rooftop units", quantity: 12, unit: "EA", notes: "Per equipment schedule", confidence: 0.91 },
      { description: "Furnish and install insulated ductwork", quantity: 2400, unit: "LF", notes: "Approximate", confidence: 0.8 },
      { description: "Install VAV boxes with controls tie-in", quantity: 38, unit: "EA", notes: null, confidence: 0.88 },
      { description: "Provide start-up and owner training", quantity: 1, unit: "LS", notes: null, confidence: 0.75 },
    ],
    compliance: {
      bondRequired: false, bondPercent: null, insuranceRequired: true,
      insuranceLimits: ["General Liability $2,000,000 aggregate", "Auto $1,000,000", "Workers Comp statutory"],
      licenseRequirements: ["Texas HVAC contractor license"],
      prevailingWage: false, unionRequired: false, davisBacon: false, prequalRequired: false,
      otherRequirements: [],
    },
    assumptions: [
      "Existing HVAC equipment to remain is in good working order and requires no repair.",
      "The existing structure supports new equipment loads without reinforcement.",
      "The GC provides hoisting, cranes, and material handling for rooftop equipment.",
    ],
    clarifications: [
      "Is the controls scope by the HVAC contractor or a separate controls vendor?",
      "Is testing, adjusting, and balancing included in our scope or by others?",
      "Is any after-hours or weekend work required to keep tenants operating?",
    ],
    exclusions: [
      "Building automation, DDC controls, and controls programming.",
      "Testing, adjusting, and balancing.",
      "Structural reinforcement, curbs, and housekeeping pads for equipment.",
      "Electrical power wiring, disconnects, and starters for HVAC equipment.",
      "Roofing and flashing at penetrations.",
    ],
    warnings: [
      "Ductwork quantity is approximate per the document; verify before bidding.",
      "The ITB excludes controls programming but the scope requires a controls tie-in — confirm the boundary.",
    ],
  },
  {
    file: "airport-concourse.pdf",
    projectName: "Airport Concourse — Structural Steel",
    trade: "steel",
    deadlineInDays: -2,
    status: "draft",
    itb: {
      projectName: "DFW Concourse D — Structural Steel Package",
      projectAddress: "2337 South International Pkwy, DFW Airport, TX 75261",
      owner: "DFW Airport Board",
      generalContractor: "Austin Commercial",
      bidDeadline: "July 14, 2026, 2:00 PM CST",
      rfiDeadline: "July 7, 2026",
      walkthrough: "July 2, 2026, 7:00 AM — badging required",
      contactName: "Marcus Brown",
      contactEmail: "mbrown@austincommercial.com",
      contactPhone: "(972) 555-0177",
      division: "DIVISION 05 STRUCTURAL STEEL",
      scope: [
        "Furnish and erect approximately 420 tons of structural steel framing.",
        "Furnish and install 18,000 SF of metal roof deck.",
        "Provide shop drawings and connection design for all members.",
        "Furnish and install 64 EA embed plates coordinated with concrete.",
      ],
      compliance: [
        "Bid Bond: 10% of bid amount required with submission.",
        "Performance & Payment Bond: 100% required upon award.",
        "Insurance: General Liability $10,000,000 aggregate; Auto $2,000,000; Workers Comp statutory.",
        "Prevailing Wage: Federal Davis-Bacon wage rates apply.",
        "Prequalification: Bidders must be prequalified with the Airport Board.",
        "All personnel require airport badging prior to site access.",
      ],
      exclusions: ["Fireproofing", "Concrete embeds installation", "Crane mats"],
    },
    scope: [
      { description: "Furnish and erect structural steel framing", quantity: 420, unit: "TON", notes: "Approximate", confidence: 0.9 },
      { description: "Furnish and install metal roof deck", quantity: 18000, unit: "SF", notes: null, confidence: 0.88 },
      { description: "Provide shop drawings and connection design", quantity: 1, unit: "LS", notes: "Connection design by others is excluded", confidence: 0.72 },
      { description: "Furnish and install embed plates", quantity: 64, unit: "EA", notes: "Coordinate with concrete", confidence: 0.83 },
    ],
    compliance: {
      bondRequired: true, bondPercent: 10, insuranceRequired: true,
      insuranceLimits: ["General Liability $10,000,000 aggregate", "Auto $2,000,000", "Workers Comp statutory"],
      licenseRequirements: [],
      prevailingWage: true, unionRequired: false, davisBacon: true, prequalRequired: true,
      otherRequirements: ["Airport badging required for all personnel"],
    },
    assumptions: [
      "Shop drawings are reviewed and returned within ten business days of submission.",
      "Crane access and adequate set-up area are available at the erection location.",
      "The GC provides accurate control lines, benchmarks, and dimensional layout for our work.",
    ],
    clarifications: [
      "What is the expected shop drawing review turnaround, and who provides connection design?",
      "How much badging lead time should we carry for the erection crew?",
      "Are liquidated damages applicable to our scope, and if so, at what rate?",
    ],
    exclusions: [
      "Spray-applied fireproofing and intumescent coatings.",
      "Field welding inspection and non-destructive testing.",
      "Permits, permit fees, plan review fees, and impact fees.",
      "Cranes, hoisting, and material handling not required for our own work.",
      "Concrete embeds installation.",
    ],
    warnings: [
      "Steel tonnage is approximate per the document; verify against the drawings before bidding.",
      "The ITB requires connection design but also excludes it — clarify responsibility before pricing.",
      "Airport badging may add lead time not reflected in the stated schedule.",
    ],
  },
  {
    file: "warehouse-slab.pdf",
    projectName: "Warehouse Slab — No Deadline Listed",
    trade: "concrete",
    deadlineInDays: null,
    status: "draft",
    itb: {
      projectName: "Prologis Warehouse — Slab on Grade",
      projectAddress: "1500 Logistics Dr, Fort Worth, TX 76177",
      owner: "Prologis",
      generalContractor: "Alston Construction",
      bidDeadline: "To be determined — see Addendum 1",
      rfiDeadline: "To be determined",
      walkthrough: "By appointment",
      contactName: "Sam Ortiz",
      contactEmail: "sortiz@alstonco.com",
      contactPhone: "(817) 555-0163",
      division: "DIVISION 03 CONCRETE",
      scope: [
        "Furnish and place approximately 96,000 SF of 6-inch slab on grade, 4,000 psi.",
        "Furnish and install vapor barrier under the full slab area.",
        "Saw cut and seal control joints per the joint layout.",
        "Furnish and place 1,200 LF of thickened edge at dock doors.",
      ],
      compliance: [
        "Bid Bond: not required.",
        "Insurance: General Liability $2,000,000 aggregate; Workers Comp statutory.",
        "Prevailing Wage: does not apply — private project.",
      ],
      exclusions: ["Subgrade preparation", "Concrete testing", "Dowel baskets"],
    },
    scope: [
      { description: "Furnish and place 6-inch slab on grade, 4,000 psi", quantity: 96000, unit: "SF", notes: "Approximate", confidence: 0.89 },
      { description: "Furnish and install vapor barrier under full slab area", quantity: 96000, unit: "SF", notes: null, confidence: 0.86 },
      { description: "Saw cut and seal control joints per joint layout", quantity: 1, unit: "LS", notes: null, confidence: 0.74 },
      { description: "Furnish and place thickened edge at dock doors", quantity: 1200, unit: "LF", notes: null, confidence: 0.82 },
    ],
    compliance: {
      bondRequired: false, bondPercent: null, insuranceRequired: true,
      insuranceLimits: ["General Liability $2,000,000 aggregate", "Workers Comp statutory"],
      licenseRequirements: [],
      prevailingWage: false, unionRequired: false, davisBacon: false, prequalRequired: false,
      otherRequirements: [],
    },
    assumptions: [
      "Subgrade is compacted, stable, and ready to receive our work, and is provided by others.",
      "Concrete truck and pump access is available within reasonable reach of all placements.",
      "Concrete testing and special inspection is provided and paid for by the owner or GC.",
    ],
    clarifications: [
      "Please confirm the required mix designs and who is responsible for testing and special inspection.",
      "When will the bid date be established? The ITB states it is to be determined.",
      "Is the slab poured in a single continuous placement or phased?",
    ],
    exclusions: [
      "Subgrade preparation, compaction, and proof rolling.",
      "Special inspection, third-party testing, and independent laboratory fees.",
      "Reinforcing design, detailing, and placing drawings.",
      "Permits, permit fees, plan review fees, and impact fees.",
      "Dowel baskets and load transfer devices.",
    ],
    warnings: [
      "No bid deadline is stated — the ITB defers it to Addendum 1, which is not attached.",
      "Slab area is approximate per the document; verify against the drawings.",
    ],
  },
  {
    // A public solicitation, modeled on NOAA 1305M326Q0317. There is no GC:
    // the agency solicits subs directly, which is true of every federal ITB we
    // tested. The board falls back to the owner for the counterparty, and this
    // is the seeded bid that proves it.
    file: "Sol_1305M326Q0317.pdf",
    projectName: "NOAA Fisheries Lab — Electrical Service Upgrade",
    trade: "electrical",
    deadlineInDays: 9,
    status: "submitted",
    itb: {
      projectName: "NOAA Fisheries Lab — Electrical Service Upgrade",
      projectAddress: "166 Water St, Woods Hole, MA 02543",
      owner: "NOAA (National Oceanic and Atmospheric Administration)",
      generalContractor: null,
      bidDeadline: "August 18, 2026, 4:00 PM EST",
      rfiDeadline: "August 4, 2026",
      walkthrough: "July 30, 2026, 9:00 AM — base access request required 5 days prior",
      contactName: "D. Whitfield",
      contactEmail: "contracting@noaa.gov",
      contactPhone: "(508) 555-0119",
      division: "DIVISION 26 ELECTRICAL",
      scope: [
        "Replace existing 800A main switchboard with new service entrance rated equipment.",
        "Furnish and install 150 kVA transformer serving the lab annex.",
        "Install approximately 1,200 LF of rigid galvanized conduit, exterior runs.",
        "Provide and terminate 600 MCM feeders from the utility transformer pad.",
        "Furnish and install a 250 kW standby generator connection and ATS.",
      ],
      compliance: [
        "Bid Bond: 20% of bid amount, not to exceed $3,000,000.",
        "Performance & Payment Bond: 100% required upon award.",
        "Insurance: General Liability $2,000,000 aggregate; Auto $1,000,000; Workers Comp statutory.",
        "Davis-Bacon: Federal Davis-Bacon wage rates apply per the attached wage determination.",
        "Registration: Active SAM.gov registration required prior to award.",
        "Base Access: Contractor personnel require an approved access request before mobilization.",
      ],
      exclusions: ["Utility company fees", "Asbestos or hazardous material abatement"],
    },
    scope: [
      { description: "Replace 800A main switchboard, service entrance rated", quantity: 1, unit: "EA", notes: null, confidence: 0.93 },
      { description: "Furnish and install 150 kVA transformer, lab annex", quantity: 1, unit: "EA", notes: null, confidence: 0.9 },
      { description: "Install rigid galvanized conduit, exterior runs", quantity: 1200, unit: "LF", notes: null, confidence: 0.82 },
      { description: "Provide and terminate 600 MCM feeders from utility pad", quantity: 4, unit: "EA", notes: "Utility coordination required", confidence: 0.78 },
      { description: "Standby generator connection and automatic transfer switch", quantity: 1, unit: "LS", notes: "250 kW", confidence: 0.75 },
    ],
    compliance: {
      bondRequired: true, bondPercent: 20, insuranceRequired: true,
      insuranceLimits: ["General Liability $2,000,000 aggregate", "Auto $1,000,000", "Workers Comp statutory"],
      licenseRequirements: ["Massachusetts Master Electrician license"],
      prevailingWage: true, unionRequired: false, davisBacon: true, prequalRequired: false,
      otherRequirements: ["Active SAM.gov registration", "Approved base access request"],
    },
    assumptions: [
      "Utility company coordination and scheduling of the service cutover is performed by others.",
      "Base access approvals are granted within the timeline stated in the solicitation.",
      "Work is performed during normal business hours; no shift or weekend premium is included.",
    ],
    clarifications: [
      "What outage windows are available for the switchboard cutover?",
      "Is the standby generator owner-furnished, or is it part of this scope?",
      "Please confirm the lead time expectation for base access approval.",
    ],
    exclusions: [
      "Utility company charges, connection fees, and transformer pad work by the utility.",
      "Asbestos, lead, or other hazardous material abatement.",
      "Temporary generator rental during the cutover.",
      "Permits and fees.",
    ],
    warnings: [
      "No general contractor is named — this is a direct federal solicitation.",
      "Bid bond is 20%, well above the 5% typical of private work; confirm surety capacity.",
    ],
  },
];
