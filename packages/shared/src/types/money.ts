export type Cents = number;

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: Cents): number {
  return cents / 100;
}

export function formatCents(cents: Cents, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Money is always an integer number of cents. `number` is exact for integers up
 * to 2^53 (~$90 trillion), far beyond any bid, and stays JSON-serializable —
 * so we enforce the integer invariant rather than reaching for BigInt.
 */
export function isIntegerCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/** Throw if a value isn't integer cents. Use at trust boundaries. */
export function assertIntegerCents(value: unknown, label = "value"): asserts value is Cents {
  if (!isIntegerCents(value)) {
    throw new Error(`${label} must be an integer number of cents, got: ${String(value)}`);
  }
}

/** Sum cents, staying in integer space. */
export function sumCents(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0);
}

/** A percentage of a cent amount, rounded to the nearest whole cent. */
export function applyPercent(cents: Cents, percent: number): Cents {
  return Math.round((cents * percent) / 100);
}

/** quantity x unit cost, rounded to the nearest whole cent. */
export function lineItemTotalCents(quantity: number, unitCostCents: Cents): Cents {
  return Math.round(quantity * unitCostCents);
}
