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
// every GST-taxed document (first consumer: Purchase Order, feature-spec 42).
// Validated against the statutory list, never a free-text guess.
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
