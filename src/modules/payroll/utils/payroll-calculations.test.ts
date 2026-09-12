import { describe, expect, it } from "vitest";

import { computeNetSalary, computeWorkedDays, sumNetSalaryPaise, totalDaysInPeriod } from "@/modules/payroll/utils/payroll-calculations";

describe("totalDaysInPeriod", () => {
  it("is inclusive of both endpoints", () => {
    expect(totalDaysInPeriod(new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-31T00:00:00.000Z"))).toBe(31);
  });

  it("returns 1 for a single-day period", () => {
    expect(totalDaysInPeriod(new Date("2026-01-15T00:00:00.000Z"), new Date("2026-01-15T00:00:00.000Z"))).toBe(1);
  });
});

describe("computeWorkedDays", () => {
  it("counts a half day as 0.5", () => {
    expect(computeWorkedDays(20, 3)).toBe(21.5);
  });

  it("is zero when nothing is present or half-day", () => {
    expect(computeWorkedDays(0, 0)).toBe(0);
  });
});

describe("computeNetSalary", () => {
  it("computes the proportional salary, rounded half-up to paise", () => {
    // 30000 x 15 / 30 = 15000 exactly
    expect(computeNetSalary(30000, 15, 30)).toBe(15000);
  });

  it("rounds a fractional paise result half-up", () => {
    // 10000 x 10 / 31 = 3225.806451... -> rounds to 3225.81
    expect(computeNetSalary(10000, 10, 31)).toBe(3225.81);
  });

  it("returns zero worked-day salary as zero", () => {
    expect(computeNetSalary(30000, 0, 30)).toBe(0);
  });

  it("guards against a zero total-days divisor", () => {
    expect(computeNetSalary(30000, 0, 0)).toBe(0);
  });
});

describe("sumNetSalaryPaise", () => {
  it("sums every line's net salary in integer paise", () => {
    expect(sumNetSalaryPaise([{ netSalary: 100.5 }, { netSalary: 200.25 }])).toBe(30075);
  });

  it("returns zero for an empty line set", () => {
    expect(sumNetSalaryPaise([])).toBe(0);
  });
});
