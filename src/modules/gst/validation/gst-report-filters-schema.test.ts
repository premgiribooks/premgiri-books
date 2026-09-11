import { describe, expect, it } from "vitest";

import { gstReportFiltersSchema, isValidCalendarDate, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";

describe("isValidCalendarDate", () => {
  it("accepts a well-formed calendar date", () => {
    expect(isValidCalendarDate("2026-04-01")).toBe(true);
  });

  it("rejects a malformed or impossible date", () => {
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("04-01-2026")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });
});

describe("toUtcDate", () => {
  it("parses to UTC midnight", () => {
    expect(toUtcDate("2026-04-01").toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("gstReportFiltersSchema", () => {
  it("accepts a valid required-only filter set", () => {
    const result = gstReportFiltersSchema.safeParse({ from: "2026-04-01", to: "2026-04-30" });
    expect(result.success).toBe(true);
  });

  it("rejects when 'to' is before 'from'", () => {
    const result = gstReportFiltersSchema.safeParse({ from: "2026-04-30", to: "2026-04-01" });
    expect(result.success).toBe(false);
  });

  it("accepts equal from/to (a single-day report)", () => {
    const result = gstReportFiltersSchema.safeParse({ from: "2026-04-01", to: "2026-04-01" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing 'from' or 'to'", () => {
    expect(gstReportFiltersSchema.safeParse({ to: "2026-04-30" }).success).toBe(false);
    expect(gstReportFiltersSchema.safeParse({ from: "2026-04-01" }).success).toBe(false);
  });

  it("rejects a pageSize above the 200-row cap", () => {
    const result = gstReportFiltersSchema.safeParse({ from: "2026-04-01", to: "2026-04-30", pageSize: 201 });
    expect(result.success).toBe(false);
  });

  it("accepts optional partyId/hsnCode/ratePercent filters", () => {
    const result = gstReportFiltersSchema.safeParse({
      from: "2026-04-01",
      to: "2026-04-30",
      partyId: "11111111-1111-4111-8111-111111111111",
      hsnCode: "3208",
      ratePercent: 18,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid partyId that isn't a UUID", () => {
    const result = gstReportFiltersSchema.safeParse({ from: "2026-04-01", to: "2026-04-30", partyId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
