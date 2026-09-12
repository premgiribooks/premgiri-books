import { z } from "zod";

import { PURCHASE_INVOICE_STATUS_VALUES } from "@/modules/purchase-invoices/validation/purchase-invoice-schema";
import { isValidCalendarDate, toUtcDate } from "@/modules/reports/validation/financial-report-filters-schema";
import { PURCHASE_RETURN_STATUS_VALUES } from "@/modules/purchase-returns/validation/purchase-return-schema";

export { toUtcDate };

// 69-purchase-reports.md's Validation section: identical shape to
// sales-report-schema.ts with `supplierId` in place of `customerId` and no
// `customerMode`-equivalent status field. No client-submitted totals or
// grouped figures of any kind — every number in the response is
// server-computed (see the Reporting Engine, purchase-reports.ts).
//
// Deliberately no `financialYearId` field — same reasoning as
// sales-report-schema.ts's own note: every query this batch's views read
// from already scopes to `getCurrentFinancialYear()` internally and has no
// caller-selectable financial year anywhere else in the Purchase module.

const CALENDAR_DATE = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

function refineDateRange<T extends { dateFrom: string; dateTo: string }>(schema: z.ZodType<T>) {
  return schema.refine((data) => toUtcDate(data.dateTo).getTime() >= toUtcDate(data.dateFrom).getTime(), {
    message: "To date must be on or after the From date",
    path: ["dateTo"],
  });
}

export const purchaseRegisterFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
    supplierId: z.uuid().optional(),
    status: z.enum(PURCHASE_INVOICE_STATUS_VALUES).optional().default("POSTED"),
  })
);
// z.input (not z.infer/z.output) — callers may omit `status` entirely and
// let the schema's own .default("POSTED") fill it in at parse time; the
// output type (status always present) is only ever seen after `.parse`.
export type PurchaseRegisterFiltersInput = z.input<typeof purchaseRegisterFiltersSchema>;

export const itemWisePurchaseFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
    productId: z.uuid().optional(),
    warehouseId: z.uuid().optional(),
    supplierId: z.uuid().optional(),
  })
);
export type ItemWisePurchaseFiltersInput = z.infer<typeof itemWisePurchaseFiltersSchema>;

export const partyWisePurchaseFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
  })
);
export type PartyWisePurchaseFiltersInput = z.infer<typeof partyWisePurchaseFiltersSchema>;

export const purchaseReturnSummaryFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
    supplierId: z.uuid().optional(),
    status: z.enum(PURCHASE_RETURN_STATUS_VALUES).optional().default("POSTED"),
  })
);
// z.input, matching purchaseRegisterFiltersSchema's own note above.
export type PurchaseReturnSummaryFiltersInput = z.input<typeof purchaseReturnSummaryFiltersSchema>;
