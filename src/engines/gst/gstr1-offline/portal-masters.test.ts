import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/app-error";

import { assertPortalRate, toPosLabel, toUqcLabel } from "./portal-masters";

describe("toPosLabel", () => {
  it("returns the portal's exact drop-down text for a state code", () => {
    expect(toPosLabel("27")).toBe("27-Maharashtra");
    expect(toPosLabel("26")).toBe("26-Dadra & Nagar Haveli & Daman & Diu");
    expect(toPosLabel("97")).toBe("97-Other Territory");
  });

  it("throws an AppError for a code the portal has no entry for", () => {
    expect(() => toPosLabel("28")).toThrow(AppError);
    expect(() => toPosLabel("")).toThrow(AppError);
  });
});

describe("toUqcLabel", () => {
  it("maps a UQC code to the portal's CODE-DESCRIPTION label, ignoring case and whitespace", () => {
    expect(toUqcLabel("NOS")).toBe("NOS-NUMBERS");
    expect(toUqcLabel(" pcs ")).toBe("PCS-PIECES");
  });

  it("falls back to OTH-OTHERS for an unknown code, a blank, or a missing value", () => {
    expect(toUqcLabel("XYZ")).toBe("OTH-OTHERS");
    expect(toUqcLabel("")).toBe("OTH-OTHERS");
    expect(toUqcLabel(null)).toBe("OTH-OTHERS");
    expect(toUqcLabel(undefined)).toBe("OTH-OTHERS");
  });
});

describe("assertPortalRate", () => {
  it("accepts every rate in the portal's rate list", () => {
    for (const rate of [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40]) {
      expect(assertPortalRate(rate)).toBe(rate);
    }
  });

  it("throws an AppError naming a rate the portal does not accept", () => {
    expect(() => assertPortalRate(14)).toThrow(AppError);
    expect(() => assertPortalRate(14)).toThrow(/14%/);
  });
});
