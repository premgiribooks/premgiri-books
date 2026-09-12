import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// attendance-schema.ts's own private isValidCalendarDate/toUtcDate copy
// (63-payroll.md's own convention: every module keeps its own).

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `periodStart`/`periodEnd` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

// 63-payroll.md's Business Rules: `periodStart <= periodEnd`, re-verified
// again at posting time against current state — this schema only enforces
// the shape; the overlap-with-another-run check is a service-level read.
export const createPayrollRunSchema = z
  .object({
    periodStart: CALENDAR_DATE_SCHEMA,
    periodEnd: CALENDAR_DATE_SCHEMA,
    narration: NARRATION_SCHEMA,
  })
  .refine((data) => toUtcDate(data.periodStart) <= toUtcDate(data.periodEnd), {
    message: "The period's start date must not be after its end date.",
    path: ["periodEnd"],
  });

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const PAYROLL_RUN_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

export const payrollRunListFiltersSchema = z.object({
  search: z.string().trim().max(50).transform(emptyToUndefined).optional(),
  status: z.enum(PAYROLL_RUN_STATUS_VALUES).optional(),
  dateFrom: CALENDAR_DATE_SCHEMA.optional(),
  dateTo: CALENDAR_DATE_SCHEMA.optional(),
});

export type PayrollRunListFiltersInput = z.infer<typeof payrollRunListFiltersSchema>;

// 73-employee-reports.md's Payroll Register — the same filter shape plus a
// caller-suppliable `financialYearId` (the operational list above always
// resolves its own financial year from the active-FY cookie, never a raw
// client value, so it carries no such field). Validated here — defense in
// depth, security-review fix 2026-09-12 — rather than letting an
// unvalidated value reach `payrollRunRepository.findMany`'s `where` clause
// on the strength of its one caller's own pre-validation alone.
export const payrollRunReportFiltersSchema = payrollRunListFiltersSchema.extend({
  financialYearId: z.uuid("Select a valid financial year").optional(),
});

export type PayrollRunReportFiltersInput = z.infer<typeof payrollRunReportFiltersSchema>;
