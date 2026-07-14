export type Trade =
  | "electrical" | "plumbing" | "hvac" | "drywall" | "framing" | "concrete"
  | "roofing" | "flooring" | "painting" | "masonry" | "demolition" | "earthwork"
  | "steel" | "glazing" | "insulation" | "fire_protection" | "low_voltage"
  | "landscaping" | "asphalt" | "other";

export const TRADE_LABELS: Record<Trade, string> = {
  electrical: "Electrical",
  plumbing: "Plumbing",
  hvac: "HVAC / Mechanical",
  drywall: "Drywall / Framing",
  framing: "Framing",
  concrete: "Concrete",
  roofing: "Roofing",
  flooring: "Flooring",
  painting: "Painting",
  masonry: "Masonry",
  demolition: "Demolition",
  earthwork: "Earthwork / Site",
  steel: "Structural Steel",
  glazing: "Glazing",
  insulation: "Insulation",
  fire_protection: "Fire Protection",
  low_voltage: "Low Voltage / Data",
  landscaping: "Landscaping",
  asphalt: "Asphalt / Paving",
  other: "Other",
};
