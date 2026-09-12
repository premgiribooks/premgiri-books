import { z } from "zod";

import { SALES_INVOICE_STATUS_VALUES } from "@/modules/sales-invoices/validation/sales-invoice-schema";
import { isValidCalendarDate, toUtcDate } from "@/modules/reports/validation/financial-report-filters-schema";
import { SALES_RETURN_STATUS_VALUES } from "@/modules/sales-returns/validation/sales-return-schema";

export { toUtcDate };

// 68-sales-reports.md's Validation section: a shared filter shape across all
// four views (`dateFrom`/`dateTo` calendar dates, object-level refine
// `dateFrom <= dateTo`; optional uuid filters; `status` matching the
// relevant document's own status enum). No client-submitted totals or
// grouped figures of any kind — every number in the response is
// server-computed (see the Reporting Engine, sales-reports.ts).
//
// Deliberately no `financialYearId` field, despite the spec's own Business
// Rules section listing one as "optional — defaults to the active FY": every
// query this batch's views read from (salesInvoiceService.listSalesInvoices,
// salesReturnService.listSalesReturns, and the two new aggregate methods)
// already scopes to `getCurrentFinancialYear()` internally and has no
// caller-selectable financial year anywhere else in the Sales module —
// unlike the financial-reports batch (Trial Balance et al.), whose ledger
// data is not FY-partitioned in the same structural way. Introducing a
// selector here that the underlying reads can't actually honor would be
// worse than not offering one; recorded here rather than silently omitted.

const CALENDAR_DATE = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

function refineDateRange<T extends { dateFrom: string; dateTo: string }>(schema: z.ZodType<T>) {
  return schema.refine((data) => toUtcDate(data.dateTo).getTime() >= toUtcDate(data.dateFrom).getTime(), {
    message: "To date must be on or after the From date",
    path: ["dateTo"],
  });
}

export const salesRegisterFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
    customerId: z.uuid().optional(),
    status: z.enum(SALES_INVOICE_STATUS_VALUES).optional().default("POSTED"),
  })
);
// z.input (not z.infer/z.output) — callers may omit `status` entirely and
// let the schema's own .default("POSTED") fill it in at parse time; the
// output type (status always present) is only ever seen after `.parse`.
export type SalesRegisterFiltersInput = z.input<typeof salesRegisterFiltersSchema>;

export const itemWiseSalesFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
    productId: z.uuid().optional(),
    warehouseId: z.uuid().optional(),
    customerId: z.uuid().optional(),
  })
);
export type ItemWiseSalesFiltersInput = z.infer<typeof itemWiseSalesFiltersSchema>;

export const partyWiseSalesFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
  })
);
export type PartyWiseSalesFiltersInput = z.infer<typeof partyWiseSalesFiltersSchema>;

export const salesReturnSummaryFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
    customerId: z.uuid().optional(),
    status: z.enum(SALES_RETURN_STATUS_VALUES).optional().default("POSTED"),
  })
);
// z.input, matching salesRegisterFiltersSchema's own note above.
export type SalesReturnSummaryFiltersInput = z.input<typeof salesReturnSummaryFiltersSchema>;
