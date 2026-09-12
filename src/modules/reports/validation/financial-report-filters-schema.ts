import { z } from "zod";

// Pure validation — no I/O. Shared filter shape for this batch's financial
// reports (64-trial-balance.md; 65/67 extend this same file with their own
// from/to variant rather than introducing a separate schema file). Mirrors
// gst-report-filters-schema.ts's isValidCalendarDate/toUtcDate convention
// (duplicated per-module by this codebase's own precedent, rather than
// centralized).

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, matching FinancialYear's own `startDate`/`endDate` columns. */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** UTC-midnight `Date` -> `YYYY-MM-DD`, the inverse of toUtcDate. */
export function toCalendarDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Today, clamped into the given Financial Year's own [startDate, endDate]
 * range — the Trial Balance's as-of-date default (64-trial-balance.md's
 * Business Rules): "today, clamped to the FY's endDate if the FY is a past,
 * closed year." Also clamps up to startDate for a future-dated financial
 * year, so the result always satisfies the same range the server validates
 * against.
 */
export function resolveDefaultAsOfDate(financialYear: { startDate: Date; endDate: Date }): string {
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const clamped = new Date(
    Math.min(Math.max(today.getTime(), financialYear.startDate.getTime()), financialYear.endDate.getTime())
  );
  return toCalendarDateString(clamped);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

// Trial Balance's own filter shape — a single as-of date, required (Balance
// Sheet, spec 66, reuses this same shape unmodified for its own as-of-date
// screen).
export const trialBalanceFiltersSchema = z.object({
  financialYearId: z.uuid("Select a valid financial year"),
  asOfDate: CALENDAR_DATE_SCHEMA,
});

export type TrialBalanceFiltersInput = z.infer<typeof trialBalanceFiltersSchema>;
