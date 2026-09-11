import { z } from "zod";

import { isValidCalendarDate, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";

// Pure validation — no I/O. The read side (getGstr1Return's period) reuses
// gst-report-filters-schema.ts's from/to calendar-date validation directly
// (58-gstr-1.md's Validation section) — see gstr1-service.ts. This file
// covers only the write side: marking/reopening a filing period.

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

export const markPeriodFiledSchema = z
  .object({
    periodStart: CALENDAR_DATE_SCHEMA,
    periodEnd: CALENDAR_DATE_SCHEMA,
    arn: z.string().trim().max(50, "ARN must be at most 50 characters").optional(),
  })
  .refine((data) => toUtcDate(data.periodEnd).getTime() >= toUtcDate(data.periodStart).getTime(), {
    message: "'periodEnd' must not be before 'periodStart'",
    path: ["periodEnd"],
  });

export type MarkPeriodFiledSchemaInput = z.infer<typeof markPeriodFiledSchema>;
