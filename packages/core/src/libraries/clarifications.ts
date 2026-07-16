import type { ClauseSeed } from "./types";

/**
 * Seed clarifications — questions a subcontractor should get answered by the
 * GC before submitting. Entries with an empty `trades` array apply to every trade.
 */
export const CLARIFICATION_LIBRARY: ClauseSeed[] = [
  // ---- General: scope & documents -----------------------------------------
  { id: "clr-drawing-set", trades: [], text: "Please confirm the complete drawing and specification set, including all addenda, that the bid should be based on." },
  { id: "clr-scope-boundary", trades: [], text: "Please confirm the exact scope boundary between our trade and adjacent trades." },
  { id: "clr-alternates", trades: [], text: "Are there alternates or unit prices that must be carried, and should they be priced separately?" },
  { id: "clr-allowances", trades: [], text: "Are any allowances required to be carried in the base bid?" },
  { id: "clr-value-eng", trades: [], text: "Is the GC open to value-engineering suggestions, and should they be submitted with the bid or after award?" },
  { id: "clr-owner-furnished", trades: [], text: "Which items, if any, are owner-furnished, and who is responsible for receiving, storing, and installing them?" },
  { id: "clr-spec-substitutions", trades: [], text: "Will substitutions to specified products be considered, and what is the approval process?" },

  // ---- General: schedule ---------------------------------------------------
  { id: "clr-start-date", trades: [], text: "What is the anticipated start date and required duration for our scope?" },
  { id: "clr-phasing", trades: [], text: "Is the work phased, and if so, how many mobilizations should we carry?" },
  { id: "clr-after-hours", trades: [], text: "Is any after-hours, weekend, or shift work required?" },
  { id: "clr-liquidated-damages", trades: [], text: "Are liquidated damages applicable to our scope, and if so, at what rate?" },
  { id: "clr-milestones", trades: [], text: "Are there interim milestones our scope must meet, and are they enforced separately?" },

  // ---- General: commercial -------------------------------------------------
  { id: "clr-retainage", trades: [], text: "What retainage percentage applies, and when is it released?" },
  { id: "clr-payment-terms", trades: [], text: "What are the payment terms, and is payment contingent on the GC receiving payment from the owner (pay-if-paid)?" },
  { id: "clr-bond-cost", trades: [], text: "Should bond cost be included in the base bid or listed separately?" },
  { id: "clr-insurance-limits", trades: [], text: "Please confirm required insurance limits and whether any unusual endorsements are required." },
  { id: "clr-contract-form", trades: [], text: "Please provide the subcontract form for review prior to award." },
  { id: "clr-change-order-markup", trades: [], text: "What markup is permitted on change order work for labor, material, and subcontracted work?" },
  { id: "clr-tax-exempt", trades: [], text: "Is this project tax-exempt, and will an exemption certificate be provided?" },

  // ---- General: site & logistics -------------------------------------------
  { id: "clr-temp-facilities", trades: [], text: "Please confirm that temporary power, water, lighting, and toilets are provided by the GC." },
  { id: "clr-hoisting", trades: [], text: "Who provides hoisting and material handling to floor?" },
  { id: "clr-storage", trades: [], text: "What on-site storage and laydown area will be made available to us?" },
  { id: "clr-cleanup", trades: [], text: "Please confirm that final cleaning is by the GC and our scope is limited to our own debris." },
  { id: "clr-safety-program", trades: [], text: "Are there project-specific safety, badging, or orientation requirements that affect our labor cost?" },
  { id: "clr-prevailing-wage", trades: [], text: "Please confirm whether prevailing wage or Davis-Bacon rates apply and provide the applicable wage determination." },
  { id: "clr-existing-conditions-survey", trades: [], text: "Has an existing-conditions survey been performed, and can we review it?" },

  // ---- Trade-specific ------------------------------------------------------
  { id: "clr-elec-service-capacity", trades: ["electrical"], text: "Has the existing electrical service capacity been verified as adequate for the new loads?" },
  { id: "clr-elec-shutdown-window", trades: ["electrical"], text: "What shutdown windows are available for tie-ins to the existing service?" },
  { id: "clr-elec-fixture-package", trades: ["electrical"], text: "Is the lighting fixture package owner-furnished or contractor-furnished?" },
  { id: "clr-plmb-fixture-schedule", trades: ["plumbing"], text: "Please confirm the plumbing fixture schedule and who furnishes the trim and carriers." },
  { id: "clr-plmb-existing-riser", trades: ["plumbing"], text: "Have existing risers and waste lines been verified for location and condition?" },
  { id: "clr-hvac-controls-scope", trades: ["hvac"], text: "Is the controls scope by the HVAC contractor or a separate controls vendor?" },
  { id: "clr-hvac-tab", trades: ["hvac"], text: "Is testing, adjusting, and balancing included in our scope or by others?" },
  { id: "clr-conc-mix-design", trades: ["concrete"], text: "Please confirm the required mix designs and who is responsible for testing and special inspection." },
  { id: "clr-earth-spoils", trades: ["earthwork"], text: "May excess spoils remain on site, or is off-site haul and disposal required?" },
  { id: "clr-roof-warranty", trades: ["roofing"], text: "What manufacturer warranty term is required, and is an NDL warranty specified?" },
  { id: "clr-dw-finish-level", trades: ["drywall"], text: "Please confirm the required drywall finish level in each area." },
  { id: "clr-paint-colors", trades: ["painting"], text: "How many finish colors are required, and are any accent or specialty coatings included?" },
  { id: "clr-steel-shop-turnaround", trades: ["steel"], text: "What is the expected shop drawing review turnaround, and who provides connection design?" },
  { id: "clr-fp-ahj", trades: ["fire_protection"], text: "Which AHJ has jurisdiction, and are there known local requirements beyond NFPA 13?" },
  { id: "clr-demo-salvage", trades: ["demolition"], text: "Are any materials to be salvaged or turned over to the owner rather than disposed?" },
];
