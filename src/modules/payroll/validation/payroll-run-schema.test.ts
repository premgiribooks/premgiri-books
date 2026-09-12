import { describe, expect, it } from "vitest";

import { createPayrollRunSchema, isValidCalendarDate, toUtcDate } from "@/modules/payroll/validation/payroll-run-schema";

describe("isValidCalendarDate", () => {
  it("accepts a well-formed calendar date", () => {
    expect(isValidCalendarDate("2026-01-15")).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(isValidCalendarDate("15-01-2026")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
  });
});

describe("toUtcDate", () => {
  it("parses to UTC midnight", () => {
    expect(toUtcDate("2026-01-15").toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});

describe("createPayrollRunSchema", () => {
  it("accepts a valid period", () => {
    const result = createPayrollRunSchema.parse({ periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(result.periodStart).toBe("2026-01-01");
    expect(result.narration).toBeUndefined();
  });

  it("rejects a period whose start is after its end", () => {
    expect(() => createPayrollRunSchema.parse({ periodStart: "2026-01-31", periodEnd: "2026-01-01" })).toThrow();
  });

  it("rejects a malformed date", () => {
    expect(() => createPayrollRunSchema.parse({ periodStart: "not-a-date", periodEnd: "2026-01-31" })).toThrow();
  });

  it("normalizes a blank narration to undefined", () => {
    const result = createPayrollRunSchema.parse({ periodStart: "2026-01-01", periodEnd: "2026-01-31", narration: "" });
    expect(result.narration).toBeUndefined();
  });
});
