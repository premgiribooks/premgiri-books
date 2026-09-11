import { z } from "zod";

// Pure validation — no I/O. Shared date-range/party/HSN/rate filter shape
// for every Phase 8 GST report screen (this spec's Registers, and specs
// 58-60's GSTR-1/GSTR-3B/HSN Summary). Mirrors
// physical-verification-schema.ts's isValidCalendarDate/toUtcDate
// convention (duplicated per-module by this codebase's own precedent,
// rather than centralized).

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, matching every source table's `@db.Date` columns. */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

const MAX_PAGE_SIZE = 200;
export const GST_REPORT_DEFAULT_PAGE_SIZE = 50;

// An unbounded report has no place in a "Report Generation < 5 seconds"
// performance goal — both `from`/`to` are required, never defaulted to an
// open-ended range.
export const gstReportFiltersSchema = z
  .object({
    from: CALENDAR_DATE_SCHEMA,
    to: CALENDAR_DATE_SCHEMA,
    partyId: z.uuid("Select a valid party").optional(),
    hsnCode: z.string().trim().min(1).optional(),
    ratePercent: z.number().nonnegative().max(100).optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().max(MAX_PAGE_SIZE, `Page size must be at most ${MAX_PAGE_SIZE}`).optional(),
  })
  .refine((data) => toUtcDate(data.to).getTime() >= toUtcDate(data.from).getTime(), {
    message: "'to' date must not be before 'from' date",
    path: ["to"],
  });

export type GstReportFiltersInput = z.infer<typeof gstReportFiltersSchema>;
