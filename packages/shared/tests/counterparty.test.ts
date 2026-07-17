import { describe, it, expect } from "vitest";
import { counterparty, counterpartyName } from "../src/types/counterparty";

describe("counterparty", () => {
  it("uses the GC on private work, even when an owner is also named", () => {
    // You bid to the GC; the owner is named in the ITB but isn't your customer.
    expect(counterparty({ gcName: "Turner Ridge", ownerName: "Dallas ISD" })).toEqual({
      name: "Turner Ridge",
      kind: "gc",
    });
  });

  it("falls back to the owner on a public solicitation", () => {
    // All seven real federal ITBs extracted gcName: null — the agency solicits
    // subs directly, so it is the counterparty rather than missing data.
    expect(counterparty({ gcName: null, ownerName: "NOAA" })).toEqual({
      name: "NOAA",
      kind: "owner",
    });
  });

  it("is null only when neither is known", () => {
    expect(counterparty({ gcName: null, ownerName: null })).toBeNull();
  });

  it("treats blank and whitespace-only names as absent", () => {
    // Extraction returns "" rather than null often enough that a trim-less
    // check would show an empty GC column and call it a name.
    expect(counterparty({ gcName: "", ownerName: "NOAA" })?.name).toBe("NOAA");
    expect(counterparty({ gcName: "   ", ownerName: "NOAA" })?.kind).toBe("owner");
    expect(counterparty({ gcName: "  ", ownerName: "  " })).toBeNull();
  });

  it("trims the name it returns", () => {
    expect(counterparty({ gcName: " Turner Ridge ", ownerName: null })?.name).toBe("Turner Ridge");
  });
});

describe("counterpartyName", () => {
  it("renders the name, or an em dash when there is none", () => {
    expect(counterpartyName({ gcName: null, ownerName: "NOAA" })).toBe("NOAA");
    expect(counterpartyName({ gcName: null, ownerName: null })).toBe("—");
  });

  it("takes a caller-supplied fallback", () => {
    expect(counterpartyName({ gcName: null, ownerName: null }, "No GC named")).toBe("No GC named");
  });
});
