import { z } from "zod";

import { isValidCalendarDate, toUtcDate } from "@/modules/reports/validation/financial-report-filters-schema";

export { toUtcDate };

// 72-supplier-reports.md's Validation section. Mirrors
// customer-report-schema.ts exactly, minus the customerType-equivalent
// field — `Supplier` has none. `status` defaults to "active" everywhere (a
// company-wide list view surfaces active suppliers only by default; a
// specific supplier, e.g. via Statement's picker, remains reachable
// regardless of status).

const CALENDAR_DATE = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

const SUPPLIER_STATUS_VALUES = ["all", "active", "inactive"] as const;

function refineDateRange<T extends { dateFrom: string; dateTo: string }>(schema: z.ZodType<T>) {
  return schema.refine((data) => toUtcDate(data.dateTo).getTime() >= toUtcDate(data.dateFrom).getTime(), {
    message: "To date must be on or after the From date",
    path: ["dateTo"],
  });
}

// Supplier Outstanding Report — mirrors trialBalanceFiltersSchema.ts's own
// shape exactly (both required at the schema level; the page resolves
// defaults — active financial year, today clamped into its range — before
// calling this service, the same Trial Balance precedent).
export const supplierOutstandingFiltersSchema = z.object({
  financialYearId: z.uuid("Select a valid financial year"),
  asOfDate: CALENDAR_DATE,
  status: z.enum(SUPPLIER_STATUS_VALUES).optional().default("active"),
});
export type SupplierOutstandingFiltersInput = z.input<typeof supplierOutstandingFiltersSchema>;

// Supplier Statement — supplierId required (Business Rules #2); server
// re-verifies same-company in supplier-report-service.ts.
export const supplierStatementFiltersSchema = refineDateRange(
  z.object({
    supplierId: z.uuid("Select a supplier"),
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
  })
);
export type SupplierStatementFiltersInput = z.infer<typeof supplierStatementFiltersSchema>;

// Supplier Purchase Summary — deliberately no `financialYearId` field, same
// reasoning as purchase-report-schema.ts's own note:
// `purchaseInvoiceService.getPartyWisePurchaseReport` already scopes to
// `getCurrentFinancialYear()` internally and has no caller-selectable
// financial year anywhere else.
export const supplierPurchaseSummaryFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
  })
);
export type SupplierPurchaseSummaryFiltersInput = z.infer<typeof supplierPurchaseSummaryFiltersSchema>;

// Supplier Directory
export const supplierDirectoryFiltersSchema = z.object({
  status: z.enum(SUPPLIER_STATUS_VALUES).optional().default("active"),
});
export type SupplierDirectoryFiltersInput = z.input<typeof supplierDirectoryFiltersSchema>;
