import { describe, expect, it } from "vitest";

import {
  isValidCalendarDate,
  resolveDefaultAsOfDate,
  toCalendarDateString,
  toUtcDate,
  trialBalanceFiltersSchema,
} from "@/modules/reports/validation/financial-report-filters-schema";

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

describe("toUtcDate / toCalendarDateString", () => {
  it("round-trips a calendar date through UTC midnight", () => {
    expect(toUtcDate("2026-04-01").toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(toCalendarDateString(toUtcDate("2026-04-01"))).toBe("2026-04-01");
  });
});

describe("resolveDefaultAsOfDate", () => {
  it("clamps to the financial year's endDate when it is entirely in the past", () => {
    const financialYear = { startDate: new Date("2020-04-01T00:00:00.000Z"), endDate: new Date("2021-03-31T00:00:00.000Z") };
    expect(resolveDefaultAsOfDate(financialYear)).toBe("2021-03-31");
  });

  it("clamps to the financial year's startDate when it is entirely in the future", () => {
    const financialYear = { startDate: new Date("2099-04-01T00:00:00.000Z"), endDate: new Date("2100-03-31T00:00:00.000Z") };
    expect(resolveDefaultAsOfDate(financialYear)).toBe("2099-04-01");
  });
});

describe("trialBalanceFiltersSchema", () => {
  it("accepts a valid filter set", () => {
    const result = trialBalanceFiltersSchema.safeParse({
      financialYearId: "11111111-1111-4111-8111-111111111111",
      asOfDate: "2026-04-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid financialYearId", () => {
    const result = trialBalanceFiltersSchema.safeParse({ financialYearId: "not-a-uuid", asOfDate: "2026-04-15" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed asOfDate", () => {
    const result = trialBalanceFiltersSchema.safeParse({
      financialYearId: "11111111-1111-4111-8111-111111111111",
      asOfDate: "15-04-2026",
    });
    expect(result.success).toBe(false);
  });
});
