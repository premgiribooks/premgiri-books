import { z } from "zod";

import { isValidGstStateCode } from "@/engines/gst/state-codes";
import {
  EMAIL_REGEX,
  GSTIN_REGEX,
  MOBILE_REGEX,
  PAN_REGEX,
  PIN_CODE_REGEX,
} from "@/lib/validation-patterns";

const WEBSITE_REGEX = /^https?:\/\/.+/i;

// The company's own GST state code (01-38, GST_STATE_CODES) — needed by the
// GST Engine's determineSupplyType() to decide intra- vs inter-state tax on
// every GST-taxed document (first consumer: Quotation, feature-spec 35; also
// needed by Purchase Order, feature-spec 42). Validated against the
// statutory list, never a free-text guess.
const STATE_CODE_SCHEMA = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || isValidGstStateCode(value), {
    message: "Select a valid GST state",
  });

function optionalText(): z.ZodOptional<z.ZodString> {
  return z.string().trim().optional();
}

function optionalPattern(regex: RegExp, message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || regex.test(value), { message });
}

export const companySchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters"),
  legalName: z.string().trim().min(2, "Legal name must be at least 2 characters"),
  displayName: optionalText(),
  businessType: optionalText(),
  gstin: optionalPattern(GSTIN_REGEX, "Enter a valid 15-character GSTIN"),
  pan: optionalPattern(PAN_REGEX, "Enter a valid 10-character PAN"),
  tan: optionalText(),
  cin: optionalText(),
  mobileNumber: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  alternateMobile: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  email: optionalPattern(EMAIL_REGEX, "Enter a valid email address"),
  website: optionalPattern(WEBSITE_REGEX, "Enter a valid website URL"),
  addressLine1: optionalText(),
  addressLine2: optionalText(),
  city: optionalText(),
  state: optionalText(),
  stateCode: STATE_CODE_SCHEMA,
  district: optionalText(),
  country: z.string().trim().min(1, "Country is required"),
  pinCode: optionalPattern(PIN_CODE_REGEX, "Enter a valid 6-digit PIN code"),
  currency: z.string().trim().min(1, "Currency is required"),
  currencySymbol: z.string().trim().min(1, "Currency symbol is required"),
  decimalPlaces: z.number().int().min(0).max(4),
  logo: optionalText(),
  // Printed as the Sales Invoice PDF's "Terms & Conditions" section — a
  // company-wide setting, not typed per invoice. Capped generously (a real
  // multi-clause terms block, unlike a one-line narration) rather than left
  // unbounded — renderHtmlToPdf's shared/reused Puppeteer instance
  // (pdf-generation.ts) serves every tenant from one process, so an
  // unbounded free-text field here would let one company's oversized
  // submission degrade PDF-render latency for every other tenant sharing
  // that instance, not just their own (security-review finding).
  termsAndConditions: z
    .string()
    .trim()
    .max(2000, "Terms & Conditions must be at most 2000 characters")
    .optional(),
});

export type CompanyInput = z.infer<typeof companySchema>;

// The subset of companySchema a Company Admin may edit for their own company
// via /company/[id]/edit — everything except the compliance-sensitive
// registration identifiers (legalName, gstin, pan, tan, cin) and the
// currency ISO code, which stay Super-Admin-only
// (/administration/companies/[id]/edit) per the Company Module split.
export const companyProfileSchema = companySchema.omit({
  legalName: true,
  gstin: true,
  pan: true,
  tan: true,
  cin: true,
  currency: true,
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const companySettingsSchema = z.object({
  defaultTheme: z.enum(["light", "dark", "system"]),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  timeFormat: z.enum(["12h", "24h"]),
  numberFormat: z.string().trim().min(1, "Number format is required"),
  currencyFormat: z.string().trim().min(1, "Currency format is required"),
  // The Inventory Engine's negative-stock gate (32-inventory-engine.md;
  // code-standards.md "Negative stock depends on company settings") — the
  // one piece of UI that spec ships.
  allowNegativeStock: z.boolean(),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

// Sales Invoice's (38-sales-invoice.md) and Purchase Invoice's
// (44-purchase-invoice.md) posting-time ledger mappings, combined into one
// "Sales & Purchase GST Ledgers" section/schema/action — a separate
// permission gate from companySettingsSchema above: this section is gated
// by "settings"/"edit" (spec 34's precedent), not "company"/"edit". All
// eleven optional so a partial save is allowed while drafting the mapping —
// postSalesInvoice/postPurchaseInvoice themselves enforce completeness of
// their own six fields each (roundOffLedgerId is shared between both).
export const salesLedgerMappingSchema = z.object({
  salesLedgerId: z.uuid("Select a valid ledger").optional(),
  outputCgstLedgerId: z.uuid("Select a valid ledger").optional(),
  outputSgstLedgerId: z.uuid("Select a valid ledger").optional(),
  outputIgstLedgerId: z.uuid("Select a valid ledger").optional(),
  outputCessLedgerId: z.uuid("Select a valid ledger").optional(),
  roundOffLedgerId: z.uuid("Select a valid ledger").optional(),
  purchaseLedgerId: z.uuid("Select a valid ledger").optional(),
  inputCgstLedgerId: z.uuid("Select a valid ledger").optional(),
  inputSgstLedgerId: z.uuid("Select a valid ledger").optional(),
  inputIgstLedgerId: z.uuid("Select a valid ledger").optional(),
  inputCessLedgerId: z.uuid("Select a valid ledger").optional(),
});

export type SalesLedgerMappingInput = z.infer<typeof salesLedgerMappingSchema>;

// GSTR-1/GSTR-3B period-selector granularity (58-gstr-1.md) — its own tiny
// schema/section, gated by "settings"/"edit" like salesLedgerMappingSchema
// above (matching every prior Company Settings extension's convention), not
// bundled into companySettingsSchema's "company"/"edit" gate.
export const gstFilingFrequencySchema = z.object({
  gstFilingFrequency: z.enum(["MONTHLY", "QUARTERLY"]),
});

export type GstFilingFrequencyInput = z.infer<typeof gstFilingFrequencySchema>;

// Payroll's (63-payroll.md) posting-time ledger mapping — its own section/
// schema/action, gated by "settings"/"edit" like salesLedgerMappingSchema
// above. Both optional so a partial save is allowed while configuring;
// postPayrollRun itself enforces both are configured before posting. No
// field shared with salesLedgerMappingSchema (payroll posting has no
// round-off concept — see the schema's Data Model Decisions).
export const payrollLedgerMappingSchema = z.object({
  salaryExpenseLedgerId: z.uuid("Select a valid ledger").optional(),
  salaryPayableLedgerId: z.uuid("Select a valid ledger").optional(),
});

export type PayrollLedgerMappingInput = z.infer<typeof payrollLedgerMappingSchema>;
