/**
 * Synthetic-but-realistic ITB page text, modeled on a public electrical
 * subcontract solicitation. Used to exercise the parse/validate pipeline
 * without shipping a binary PDF or hitting the model API.
 */
export const ITB_SAMPLE_PAGES: string[] = [
  `INVITATION TO BID
Project: Northside Elementary School — Electrical Renovation
Location: 1420 Maple Ave, Dallas, TX 75201
Owner: Dallas Independent School District
General Contractor: Turner Ridge Construction, LLC
Bid Due: August 12, 2026, 2:00 PM CST
Pre-Bid Walkthrough: July 29, 2026, 10:00 AM at the site
RFI Deadline: August 5, 2026
Contact: Maria Alvarez, Estimator — malvarez@turnerridge.com — (214) 555-0182`,

  `SCOPE OF WORK — DIVISION 26 ELECTRICAL
1. Demolish and remove existing lighting fixtures in Classrooms 100-118, approximately 240 fixtures.
2. Furnish and install new LED 2x4 troffers, 260 EA, in classrooms and corridors.
3. Provide and install new 480V/208V, 300 kVA transformer in the main electrical room.
4. Install approximately 3,500 LF of EMT conduit for branch circuits.
5. Pull new copper branch wiring, approximately 12,000 LF, THHN #12 AWG.
6. Furnish and install fire alarm devices to tie into existing panel (approx. 45 devices).`,

  `COMPLIANCE & REQUIREMENTS
Bid Bond: 5% of bid amount required with submission.
Performance & Payment Bond: 100% required upon award.
Insurance: General Liability $2,000,000 aggregate; Auto $1,000,000; Workers Comp statutory.
Prevailing Wage: This is a public project subject to Texas prevailing wage rates.
Davis-Bacon: Federal Davis-Bacon wage rates apply.
Licensing: Texas Master Electrician license required for supervisor of record.
Prequalification: Bidders must be prequalified with the District prior to award.

EXCLUSIONS NOTED BY GC: Temporary power, patching and painting, and cutting of finished surfaces are by others.`,
];

/** A well-formed model reply matching the extraction schema, for happy-path tests. */
export const VALID_EXTRACTION_JSON = JSON.stringify({
  metadata: {
    projectName: "Northside Elementary School — Electrical Renovation",
    projectAddress: "1420 Maple Ave, Dallas, TX 75201",
    owner: "Dallas Independent School District",
    generalContractor: "Turner Ridge Construction, LLC",
    bidDeadline: "August 12, 2026, 2:00 PM CST",
    rfiDeadline: "August 5, 2026",
    walkthroughDate: "July 29, 2026, 10:00 AM",
    contactName: "Maria Alvarez",
    contactEmail: "malvarez@turnerridge.com",
    contactPhone: "(214) 555-0182",
  },
  scope: [
    { id: "s1", description: "Demolish existing lighting fixtures, Classrooms 100-118", trade: "electrical", quantity: 240, unit: "EA", notes: null, confidence: 0.95, sourcePage: 2 },
    { id: "s2", description: "Furnish and install LED 2x4 troffers", trade: "electrical", quantity: 260, unit: "EA", notes: null, confidence: 0.92, sourcePage: 2 },
    { id: "s3", description: "Install 300 kVA transformer", trade: "electrical", quantity: 1, unit: "EA", notes: "480V/208V", confidence: 0.9, sourcePage: 2 },
    { id: "s4", description: "Install EMT conduit for branch circuits", trade: "electrical", quantity: 3500, unit: "LF", notes: null, confidence: 0.85, sourcePage: 2 },
    { id: "s5", description: "Pull copper branch wiring THHN #12 AWG", trade: "electrical", quantity: 12000, unit: "LF", notes: null, confidence: 0.85, sourcePage: 2 },
    { id: "s6", description: "Furnish and install fire alarm devices", trade: "fire_protection", quantity: 45, unit: "EA", notes: "tie into existing panel", confidence: 0.7, sourcePage: 2 },
  ],
  inclusions: ["Division 26 electrical work as scoped"],
  exclusions: ["Temporary power", "Patching and painting", "Cutting of finished surfaces"],
  compliance: {
    bondRequired: true,
    bondPercent: 5,
    insuranceRequired: true,
    insuranceLimits: ["General Liability $2,000,000 aggregate", "Auto $1,000,000", "Workers Comp statutory"],
    licenseRequirements: ["Texas Master Electrician license"],
    prevailingWage: true,
    unionRequired: false,
    davisBacon: true,
    prequalRequired: true,
    otherRequirements: [],
  },
  primaryTrade: "electrical",
  warnings: ["Quantity for branch wiring is approximate per the ITB."],
});
