import { describe, expect, it } from "vitest";

import { createBranchSchema } from "@/modules/branch/validation/branch-schema";

const VALID_INPUT = {
  branchName: "Pune Branch",
  branchCode: "PUNE",
  address: "12 Industrial Estate, Pune",
  contactNumber: "9876543210",
  gstRegistration: "27AAPFU0939F1ZV",
};

describe("createBranchSchema", () => {
  it("accepts a complete valid branch and trims branchName and branchCode", () => {
    const result = createBranchSchema.parse({
      ...VALID_INPUT,
      branchName: "  Pune Branch  ",
      branchCode: "  PUNE  ",
    });

    expect(result.branchName).toBe("Pune Branch");
    expect(result.branchCode).toBe("PUNE");
  });

  it("accepts omitted optional fields (a company with no branches is fully supported)", () => {
    const result = createBranchSchema.parse({ branchName: "Main", branchCode: "MAIN" });

    expect(result.address).toBeUndefined();
    expect(result.contactNumber).toBeUndefined();
    expect(result.gstRegistration).toBeUndefined();
  });

  it("rejects out-of-bounds branchName and branchCode lengths", () => {
    expect(createBranchSchema.safeParse({ ...VALID_INPUT, branchName: "P" }).success).toBe(false);
    expect(
      createBranchSchema.safeParse({ ...VALID_INPUT, branchName: "x".repeat(101) }).success
    ).toBe(false);
    expect(createBranchSchema.safeParse({ ...VALID_INPUT, branchCode: "P" }).success).toBe(false);
    expect(
      createBranchSchema.safeParse({ ...VALID_INPUT, branchCode: "x".repeat(21) }).success
    ).toBe(false);
  });

  it("rejects an invalid contact number and accepts a valid one", () => {
    expect(
      createBranchSchema.safeParse({ ...VALID_INPUT, contactNumber: "12345" }).success
    ).toBe(false);
    // Indian mobile numbers start with 6-9.
    expect(
      createBranchSchema.safeParse({ ...VALID_INPUT, contactNumber: "1876543210" }).success
    ).toBe(false);
    expect(
      createBranchSchema.safeParse({ ...VALID_INPUT, contactNumber: "6123456789" }).success
    ).toBe(true);
  });

  it("uppercases GST registration before validating its format", () => {
    const result = createBranchSchema.parse({
      ...VALID_INPUT,
      gstRegistration: "27aapfu0939f1zv",
    });

    expect(result.gstRegistration).toBe("27AAPFU0939F1ZV");
    expect(
      createBranchSchema.safeParse({ ...VALID_INPUT, gstRegistration: "INVALID" }).success
    ).toBe(false);
  });

  it("normalizes blank optional strings to undefined", () => {
    const result = createBranchSchema.parse({
      ...VALID_INPUT,
      address: "   ",
      contactNumber: "  ",
      gstRegistration: "  ",
    });

    expect(result.address).toBeUndefined();
    expect(result.contactNumber).toBeUndefined();
    expect(result.gstRegistration).toBeUndefined();
  });

  it("rejects an over-long address", () => {
    expect(
      createBranchSchema.safeParse({ ...VALID_INPUT, address: "x".repeat(501) }).success
    ).toBe(false);
  });
});
