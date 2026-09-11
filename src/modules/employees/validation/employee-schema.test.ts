import { describe, expect, it } from "vitest";

import { createEmployeeSchema } from "@/modules/employees/validation/employee-schema";

const VALID_INPUT = {
  employeeCode: "EMP-001",
  fullName: "Ramesh Kumar",
  designation: "Sales Executive",
  department: "Sales",
  joiningDate: "2026-01-15",
  mobileNumber: "9876543210",
  alternateMobile: "9123456789",
  email: "ramesh@example.com",
  addressLine1: "12 MG Road",
  addressLine2: "Near Station",
  city: "Pune",
  state: "Maharashtra",
  district: "Pune",
  country: "India",
  pinCode: "411001",
  branchId: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
  userId: "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  basicSalary: 25000,
};

describe("createEmployeeSchema", () => {
  it("accepts a complete valid employee and trims employeeCode/fullName", () => {
    const result = createEmployeeSchema.parse({
      ...VALID_INPUT,
      employeeCode: "  EMP-001  ",
      fullName: "  Ramesh Kumar  ",
    });

    expect(result.employeeCode).toBe("EMP-001");
    expect(result.fullName).toBe("Ramesh Kumar");
    expect(result.basicSalary).toBe(25000);
  });

  it("accepts only the required fields (employeeCode, fullName, joiningDate)", () => {
    const result = createEmployeeSchema.parse({
      employeeCode: "EMP-002",
      fullName: "Suresh",
      joiningDate: "2026-02-01",
    });

    expect(result.designation).toBeUndefined();
    expect(result.department).toBeUndefined();
    expect(result.mobileNumber).toBeUndefined();
    expect(result.branchId).toBeUndefined();
    expect(result.userId).toBeUndefined();
    expect(result.basicSalary).toBeUndefined();
  });

  it("rejects a missing employeeCode, fullName, or joiningDate", () => {
    expect(
      createEmployeeSchema.safeParse({ fullName: "X", joiningDate: "2026-01-01" }).success
    ).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ employeeCode: "E1", joiningDate: "2026-01-01" }).success
    ).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ employeeCode: "E1", fullName: "X" }).success
    ).toBe(false);
  });

  it("rejects an out-of-bounds employeeCode or fullName", () => {
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, employeeCode: "" }).success).toBe(
      false
    );
    expect(
      createEmployeeSchema.safeParse({ ...VALID_INPUT, employeeCode: "x".repeat(51) }).success
    ).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, fullName: "R" }).success).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ ...VALID_INPUT, fullName: "x".repeat(101) }).success
    ).toBe(false);
  });

  it("rejects an invalid joiningDate", () => {
    expect(
      createEmployeeSchema.safeParse({ ...VALID_INPUT, joiningDate: "15-01-2026" }).success
    ).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ ...VALID_INPUT, joiningDate: "2026-13-40" }).success
    ).toBe(false);
  });

  it("normalizes blank optional strings to undefined", () => {
    const result = createEmployeeSchema.parse({
      ...VALID_INPUT,
      designation: "   ",
      department: "",
      mobileNumber: "  ",
      email: "",
      addressLine1: "",
    });

    expect(result.designation).toBeUndefined();
    expect(result.department).toBeUndefined();
    expect(result.mobileNumber).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.addressLine1).toBeUndefined();
  });

  it("rejects an invalid mobile number and email", () => {
    expect(
      createEmployeeSchema.safeParse({ ...VALID_INPUT, mobileNumber: "12345" }).success
    ).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ ...VALID_INPUT, mobileNumber: "1876543210" }).success
    ).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, email: "not-an-email" }).success).toBe(
      false
    );
  });

  it("rejects an invalid PIN code", () => {
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, pinCode: "1234" }).success).toBe(
      false
    );
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, pinCode: "011234" }).success).toBe(
      false
    );
  });

  it("rejects a non-uuid branchId or userId", () => {
    expect(
      createEmployeeSchema.safeParse({ ...VALID_INPUT, branchId: "not-a-uuid" }).success
    ).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, userId: "not-a-uuid" }).success).toBe(
      false
    );
  });

  it("rejects a zero, negative, or over-precision basicSalary", () => {
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, basicSalary: 0 }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, basicSalary: -100 }).success).toBe(
      false
    );
    expect(
      createEmployeeSchema.safeParse({ ...VALID_INPUT, basicSalary: 25000.567 }).success
    ).toBe(false);
  });

  it("accepts a valid basicSalary with exactly 2 decimals", () => {
    expect(createEmployeeSchema.safeParse({ ...VALID_INPUT, basicSalary: 25000.5 }).success).toBe(
      true
    );
  });
});
