import { z } from "zod";

import { isValidCalendarDate, toUtcDate } from "@/modules/reports/validation/financial-report-filters-schema";

export { toUtcDate };

// 70-inventory-reports.md's Validation section. Unlike the Sales/Purchase
// Reports batch, every date field here is optional — Business Rules
// explicitly states no view takes a required date range (StockTransaction
// carries no financialYearId, so there is no FY-scoped default to fall back
// to either; an omitted range means "full history").

const CALENDAR_DATE = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

/** Accepts a query-string boolean ("true"/"1"/"on") or an actual boolean; anything else (including "false", absent, empty) is false. */
const BOOLEAN_QUERY_PARAM = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "1" || value === "on")
  .default(false);

export const currentStockFiltersSchema = z.object({
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  includeZeroStock: BOOLEAN_QUERY_PARAM,
});
export type CurrentStockFiltersInput = z.input<typeof currentStockFiltersSchema>;

export const stockLedgerFiltersSchema = z
  .object({
    // Required — getStockLedger's own signature is per-product (70-inventory-
    // reports.md's Business Rules #2); this view has no cross-product mode.
    productId: z.uuid("Select a product"),
    warehouseId: z.uuid().optional(),
    dateFrom: CALENDAR_DATE.optional(),
    dateTo: CALENDAR_DATE.optional(),
  })
  .refine(
    (data) => !data.dateFrom || !data.dateTo || toUtcDate(data.dateTo).getTime() >= toUtcDate(data.dateFrom).getTime(),
    { message: "To date must be on or after the From date", path: ["dateTo"] }
  );
export type StockLedgerFiltersInput = z.infer<typeof stockLedgerFiltersSchema>;

export const stockValuationFiltersSchema = z.object({
  warehouseId: z.uuid().optional(),
});
export type StockValuationFiltersInput = z.infer<typeof stockValuationFiltersSchema>;

export const lowStockFiltersSchema = z.object({
  warehouseId: z.uuid().optional(),
});
export type LowStockFiltersInput = z.infer<typeof lowStockFiltersSchema>;
