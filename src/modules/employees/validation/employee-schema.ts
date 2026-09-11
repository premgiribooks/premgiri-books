import { z } from "zod";

import { EMAIL_REGEX, MOBILE_REGEX, PIN_CODE_REGEX } from "@/lib/validation-patterns";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// customer-schema.ts's structure; the calendar-date pair mirrors every other
// module's own private isValidCalendarDate/toUtcDate copy (e.g.
// sales-order-schema.ts) rather than a shared import.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 10) === value;
}

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `joiningDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

// Every blank optional string normalizes to undefined (the established
// convention since product-schema.ts), so clearing a field persists NULL.
const blankToUndefined = (value: string) => (value === "" ? undefined : value);

function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform(blankToUndefined)
    .optional();
}

function optionalPattern(regex: RegExp, message: string) {
  return z
    .string()
    .trim()
    .transform(blankToUndefined)
    .optional()
    .refine((value) => value === undefined || regex.test(value), { message });
}

const EMPLOYEE_CODE_SCHEMA = z
  .string()
  .trim()
  .min(1, "Employee code is required")
  .max(50, "Employee code must be at most 50 characters");

const FULL_NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters")
  .max(100, "Full name must be at most 100 characters");

// The server re-verifies company scope and active status for the branch —
// this only guards the shape (never trust a client-supplied branch id),
// mirroring warehouse-schema.ts's BRANCH_ID_SCHEMA.
const BRANCH_ID_SCHEMA = z.uuid("Select a valid branch").optional();

// The server re-verifies company scope, active status, and "not already
// linked to a different employee" for the user — this only guards the shape
// (61-employee-master.md's Validation section).
const USER_ID_SCHEMA = z.uuid("Select a valid user").optional();

// Prisma's `Decimal(14, 2)` column: 12 integer digits + 2 decimal places.
const MAX_AMOUNT = 999999999999.99;

// Same scaled-with-tolerance float check as customer-schema.ts/gst-rate-schema.ts.
function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

const BASIC_SALARY_SCHEMA = z
  .number("Basic salary must be a number")
  .positive("Basic salary must be greater than zero")
  .max(MAX_AMOUNT, "Basic salary is too large")
  .refine(hasAtMostTwoDecimals, { message: "Basic salary can have at most 2 decimal places" })
  .optional();

export const createEmployeeSchema = z.object({
  employeeCode: EMPLOYEE_CODE_SCHEMA,
  fullName: FULL_NAME_SCHEMA,
  designation: optionalText(100, "Designation"),
  department: optionalText(100, "Department"),
  joiningDate: CALENDAR_DATE_SCHEMA,
  mobileNumber: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  alternateMobile: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  email: optionalPattern(EMAIL_REGEX, "Enter a valid email address"),
  addressLine1: optionalText(200, "Address line 1"),
  addressLine2: optionalText(200, "Address line 2"),
  city: optionalText(100, "City"),
  state: optionalText(100, "State"),
  district: optionalText(100, "District"),
  country: optionalText(100, "Country"),
  pinCode: optionalPattern(PIN_CODE_REGEX, "Enter a valid 6-digit PIN code"),
  branchId: BRANCH_ID_SCHEMA,
  userId: USER_ID_SCHEMA,
  basicSalary: BASIC_SALARY_SCHEMA,
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// Create and Update accept the same field set (61-employee-master.md). Kept
// as a separate named schema so a future spec can diverge them without
// touching callers.
export const updateEmployeeSchema = createEmployeeSchema;

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
