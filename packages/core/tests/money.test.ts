import { describe, it, expect } from "vitest";
import { dollarsToCents, centsToDollars, formatCents } from "@bidwright/shared";

describe("money", () => {
  it("converts dollars to integer cents", () => {
    expect(dollarsToCents(12.5)).toBe(1250);
    expect(dollarsToCents(0.01)).toBe(1);
    expect(dollarsToCents(1234.56)).toBe(123456);
  });

  it("round-trips without float error", () => {
    for (const n of [0.1, 0.2, 12.34, 999.99]) {
      expect(centsToDollars(dollarsToCents(n))).toBe(n);
    }
  });

  it("formats as USD", () => {
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(0)).toBe("$0.00");
  });
});
