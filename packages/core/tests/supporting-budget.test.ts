import { describe, it, expect } from "vitest";
import {
  planSupportingUploads,
  describeSkipped,
  DEFAULT_SUPPORTING_LIMITS,
  MAX_SUPPORTING_FILE_BYTES,
} from "../src/inbox/supporting-budget";
import type { InboundAttachment } from "../src/inbox/detect";

const pdf = (fileName: string, size: number): InboundAttachment => ({
  fileName,
  contentType: "application/pdf",
  size,
});

const MB = 1024 * 1024;

describe("planSupportingUploads", () => {
  it("keeps the small documents an estimator actually needs at hand", () => {
    const plan = planSupportingUploads([
      pdf("Addendum 1.pdf", 200_000),
      pdf("Wage Determination.pdf", 150_000),
      pdf("RFI Answers.pdf", 90_000),
    ]);
    expect(plan.keep).toHaveLength(3);
    expect(plan.skipped).toEqual([]);
  });

  it("skips a scanned drawing set rather than writing it to disk forever", () => {
    // Verbatim size from SAM.gov 08c4a2b7 — 28 MB of scanned pictures we never
    // read, since only the primary is extracted.
    const plan = planSupportingUploads([
      pdf("2_Technical_Exhibit_SOW_Pictures_145027-26-0030.pdf", 28_467_372),
      pdf("Addendum 1.pdf", 200_000),
    ]);
    expect(plan.keep.map((k) => k.fileName)).toEqual(["Addendum 1.pdf"]);
    expect(plan.skipped[0].fileName).toContain("SOW_Pictures");
    expect(plan.skipped[0].reason).toMatch(/too large/i);
  });

  it("states the actual size and limit, so the skip is explicable", () => {
    const plan = planSupportingUploads([pdf("drawings.pdf", 28_467_372)]);
    expect(plan.skipped[0].reason).toContain("27.1 MB");
    expect(plan.skipped[0].reason).toContain("10.0 MB");
  });

  it("enforces a total budget across files", () => {
    // Six 5 MB files = 30 MB, over the 25 MB total.
    const plan = planSupportingUploads(
      Array.from({ length: 6 }, (_, i) => pdf(`exhibit-${i}.pdf`, 5 * MB)),
    );
    expect(plan.totalBytes).toBeLessThanOrEqual(DEFAULT_SUPPORTING_LIMITS.maxTotalBytes);
    expect(plan.keep).toHaveLength(5);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].reason).toMatch(/total limit/i);
  });

  it("enforces a file-count limit", () => {
    const plan = planSupportingUploads(
      Array.from({ length: 15 }, (_, i) => pdf(`sheet-${i}.pdf`, 1000)),
    );
    expect(plan.keep).toHaveLength(12);
    expect(plan.skipped).toHaveLength(3);
    expect(plan.skipped[0].reason).toMatch(/12-file limit/);
  });

  it("takes the small files first, so the budget buys the most documents", () => {
    // Greedy in original order would spend the whole budget on the one big file
    // and drop three useful small ones. 9.9 MB + 0.3 MB overruns 10 MB, so
    // something must go — it should be the big one.
    const plan = planSupportingUploads([
      pdf("big-but-under-cap.pdf", 9.9 * MB),
      pdf("addendum.pdf", 100_000),
      pdf("wage.pdf", 100_000),
      pdf("rfi.pdf", 100_000),
    ], { maxFileBytes: 10 * MB, maxTotalBytes: 10 * MB, maxFiles: 12 });

    expect(plan.keep.map((k) => k.fileName).sort()).toEqual([
      "addendum.pdf", "rfi.pdf", "wage.pdf",
    ]);
    expect(plan.skipped[0].fileName).toBe("big-but-under-cap.pdf");
  });

  it("keeps a file exactly at the per-file limit", () => {
    const plan = planSupportingUploads([pdf("edge.pdf", MAX_SUPPORTING_FILE_BYTES)]);
    expect(plan.keep).toHaveLength(1);
  });

  it("handles no supporting files", () => {
    expect(planSupportingUploads([])).toEqual({ keep: [], skipped: [], totalBytes: 0 });
  });
});

describe("describeSkipped", () => {
  it("is null when nothing was skipped — no note to write", () => {
    expect(describeSkipped([])).toBeNull();
  });

  it("names each skipped file and why, for the inbox activity log", () => {
    const line = describeSkipped([
      { fileName: "drawings.pdf", size: 28_000_000, reason: "too large to keep (26.7 MB, limit 10.0 MB)" },
    ]);
    expect(line).toContain("drawings.pdf");
    expect(line).toContain("too large");
    expect(line).toMatch(/skipped 1 supporting attachment:/);
  });

  it("pluralizes honestly", () => {
    const line = describeSkipped([
      { fileName: "a.pdf", size: 1, reason: "x" },
      { fileName: "b.pdf", size: 1, reason: "y" },
    ]);
    expect(line).toMatch(/skipped 2 supporting attachments:/);
  });
});
