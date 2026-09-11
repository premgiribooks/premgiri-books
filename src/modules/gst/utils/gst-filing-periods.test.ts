import { describe, expect, it } from "vitest";

import { getMonthlyPeriodOptions, getQuarterlyPeriodOptions } from "@/modules/gst/utils/gst-filing-periods";

const FY_START = new Date("2026-04-01T00:00:00.000Z");
const FY_END = new Date("2027-03-31T00:00:00.000Z");

describe("getMonthlyPeriodOptions", () => {
  it("returns 12 months spanning the financial year, April first", () => {
    const options = getMonthlyPeriodOptions(FY_START, FY_END);
    expect(options).toHaveLength(12);
    expect(options[0]).toMatchObject({ label: "April 2026", from: "2026-04-01", to: "2026-04-30" });
    expect(options[11]).toMatchObject({ label: "March 2027", from: "2027-03-01", to: "2027-03-31" });
  });

  it("crosses the calendar year boundary correctly (December to January)", () => {
    const options = getMonthlyPeriodOptions(FY_START, FY_END);
    const december = options.find((o) => o.label === "December 2026");
    const january = options.find((o) => o.label === "January 2027");
    expect(december).toMatchObject({ from: "2026-12-01", to: "2026-12-31" });
    expect(january).toMatchObject({ from: "2027-01-01", to: "2027-01-31" });
  });
});

describe("getQuarterlyPeriodOptions", () => {
  it("returns the 4 Indian fiscal quarters spanning the financial year", () => {
    const options = getQuarterlyPeriodOptions(FY_START, FY_END);
    expect(options).toHaveLength(4);
    expect(options[0]).toMatchObject({ from: "2026-04-01", to: "2026-06-30" });
    expect(options[1]).toMatchObject({ from: "2026-07-01", to: "2026-09-30" });
    expect(options[2]).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
    expect(options[3]).toMatchObject({ from: "2027-01-01", to: "2027-03-31" });
  });
});
