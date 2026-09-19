import { describe, expect, it } from "vitest";

import { getCell, getOptionalCell, parseBoolean, parseOptionalNumber, parseRequiredNumber } from "./import-cell-parsers";

describe("getCell / getOptionalCell", () => {
  it("trims whitespace and returns an empty string for a missing key", () => {
    expect(getCell({ name: "  Cash  " }, "name")).toBe("Cash");
    expect(getCell({}, "missing")).toBe("");
  });

  it("returns undefined for a blank cell, the trimmed value otherwise", () => {
    expect(getOptionalCell({ note: "  " }, "note")).toBeUndefined();
    expect(getOptionalCell({ note: " hello " }, "note")).toBe("hello");
  });
});

describe("parseOptionalNumber / parseRequiredNumber", () => {
  it("returns undefined for a blank optional value, with no error", () => {
    const errors: string[] = [];
    expect(parseOptionalNumber(undefined, "MRP", errors)).toBeUndefined();
    expect(parseOptionalNumber("", "MRP", errors)).toBeUndefined();
    expect(errors).toEqual([]);
  });

  it("parses a numeric string", () => {
    const errors: string[] = [];
    expect(parseOptionalNumber("450.50", "MRP", errors)).toBe(450.5);
    expect(errors).toEqual([]);
  });

  it("records an error for a non-numeric value", () => {
    const errors: string[] = [];
    expect(parseOptionalNumber("abc", "MRP", errors)).toBeUndefined();
    expect(errors).toEqual(["MRP must be a number."]);
  });

  it("parseRequiredNumber records an error when blank", () => {
    const errors: string[] = [];
    expect(parseRequiredNumber("", "Opening balance", errors)).toBeUndefined();
    expect(errors).toEqual(["Opening balance is required."]);
  });
});

describe("parseBoolean", () => {
  it.each(["true", "TRUE", "yes", "Y", "1"])("treats %s as true", (value) => {
    const errors: string[] = [];
    expect(parseBoolean(value, "Batch Tracked", errors)).toBe(true);
    expect(errors).toEqual([]);
  });

  it.each(["false", "no", "N", "0", "", undefined])("treats %s as false", (value) => {
    const errors: string[] = [];
    expect(parseBoolean(value, "Batch Tracked", errors)).toBe(false);
    expect(errors).toEqual([]);
  });

  it("records an error for an unrecognized value, defaulting to false", () => {
    const errors: string[] = [];
    expect(parseBoolean("maybe", "Batch Tracked", errors)).toBe(false);
    expect(errors).toEqual(["Batch Tracked must be Yes/No (or True/False)."]);
  });
});
