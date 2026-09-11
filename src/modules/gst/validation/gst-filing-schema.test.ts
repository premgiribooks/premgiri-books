import { describe, expect, it } from "vitest";

import { markPeriodFiledSchema } from "@/modules/gst/validation/gst-filing-schema";

describe("markPeriodFiledSchema", () => {
  it("accepts a valid period with no ARN", () => {
    const result = markPeriodFiledSchema.safeParse({ periodStart: "2026-04-01", periodEnd: "2026-04-30" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid period with an ARN", () => {
    const result = markPeriodFiledSchema.safeParse({
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      arn: "AA270426000001A",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when periodEnd is before periodStart", () => {
    const result = markPeriodFiledSchema.safeParse({ periodStart: "2026-04-30", periodEnd: "2026-04-01" });
    expect(result.success).toBe(false);
  });

  it("accepts equal periodStart/periodEnd", () => {
    const result = markPeriodFiledSchema.safeParse({ periodStart: "2026-04-01", periodEnd: "2026-04-01" });
    expect(result.success).toBe(true);
  });

  it("rejects an ARN longer than 50 characters", () => {
    const result = markPeriodFiledSchema.safeParse({
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      arn: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid calendar date", () => {
    const result = markPeriodFiledSchema.safeParse({ periodStart: "2026-13-01", periodEnd: "2026-04-30" });
    expect(result.success).toBe(false);
  });
});
