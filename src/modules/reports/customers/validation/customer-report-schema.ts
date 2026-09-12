import { z } from "zod";

import { isValidCalendarDate, toUtcDate } from "@/modules/reports/validation/financial-report-filters-schema";
import { CUSTOMER_TYPE_VALUES } from "@/modules/customers/validation/customer-schema";

export { toUtcDate };

// 71-customer-reports.md's Validation section. `status` defaults to
// "active" everywhere (Business Rules — a company-wide list view surfaces
// active customers only by default; a specific customer, e.g. via
// Statement's picker, remains reachable regardless of status).

const CALENDAR_DATE = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

const CUSTOMER_STATUS_VALUES = ["all", "active", "inactive"] as const;

function refineDateRange<T extends { dateFrom: string; dateTo: string }>(schema: z.ZodType<T>) {
  return schema.refine((data) => toUtcDate(data.dateTo).getTime() >= toUtcDate(data.dateFrom).getTime(), {
    message: "To date must be on or after the From date",
    path: ["dateTo"],
  });
}

// Customer Outstanding Report — mirrors trialBalanceFiltersSchema.ts's own
// shape exactly (both required at the schema level; the page resolves
// defaults — active financial year, today clamped into its range — before
// calling this service, the same Trial Balance precedent).
export const customerOutstandingFiltersSchema = z.object({
  financialYearId: z.uuid("Select a valid financial year"),
  asOfDate: CALENDAR_DATE,
  status: z.enum(CUSTOMER_STATUS_VALUES).optional().default("active"),
});
export type CustomerOutstandingFiltersInput = z.input<typeof customerOutstandingFiltersSchema>;

// Customer Statement — customerId required (Business Rules #2); server
// re-verifies same-company in customer-report-service.ts.
export const customerStatementFiltersSchema = refineDateRange(
  z.object({
    customerId: z.uuid("Select a customer"),
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
  })
);
export type CustomerStatementFiltersInput = z.infer<typeof customerStatementFiltersSchema>;

// Customer Sales Summary — deliberately no `financialYearId` field, same
// reasoning as sales/purchase-report-schema.ts's own note:
// `salesInvoiceService.getPartyWiseSalesReport` already scopes to
// `getCurrentFinancialYear()` internally and has no caller-selectable
// financial year anywhere else.
export const customerSalesSummaryFiltersSchema = refineDateRange(
  z.object({
    dateFrom: CALENDAR_DATE,
    dateTo: CALENDAR_DATE,
  })
);
export type CustomerSalesSummaryFiltersInput = z.infer<typeof customerSalesSummaryFiltersSchema>;

// Customer Directory
export const customerDirectoryFiltersSchema = z.object({
  customerType: z.enum(CUSTOMER_TYPE_VALUES).optional(),
  status: z.enum(CUSTOMER_STATUS_VALUES).optional().default("active"),
});
export type CustomerDirectoryFiltersInput = z.input<typeof customerDirectoryFiltersSchema>;
