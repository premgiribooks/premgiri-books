import { z } from "zod";

import { GSTIN_REGEX, MOBILE_REGEX } from "@/lib/validation-patterns";

const BRANCH_NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Branch name must be at least 2 characters")
  .max(100, "Branch name must be at most 100 characters");

// Unique per company (schema's @@unique([companyId, branchCode])) — the
// server surfaces the duplicate as a friendly message, this only guards the
// shape (12-branch-management.md's Validation).
const BRANCH_CODE_SCHEMA = z
  .string()
  .trim()
  .min(2, "Branch code must be at least 2 characters")
  .max(20, "Branch code must be at most 20 characters");

// A trimmed-blank address normalizes to undefined (toPersistData then stores
// it as null), matching every other master's description-field convention —
// without this, clearing the field on the edit form would persist "".
const ADDRESS_SCHEMA = z
  .string()
  .trim()
  .max(500, "Address must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

// Same 10-digit Indian mobile format as user-schema.ts's MOBILE_REGEX
// (12-branch-management.md: "mirroring 10-user-management.md's mobile
// validation"). Blank normalizes to undefined so clearing the field persists
// null.
const CONTACT_NUMBER_SCHEMA = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => value === undefined || MOBILE_REGEX.test(value), {
    message: "Enter a valid 10-digit mobile number",
  });

// GSTIN is an uppercase-only shape (12-branch-management.md: "mirroring
// 08-company-management.md's GSTIN validation") — uppercased before
// validation so lowercase entry still passes.
const GST_REGISTRATION_SCHEMA = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => value === undefined || GSTIN_REGEX.test(value), {
    message: "Enter a valid 15-character GSTIN",
  });

export const createBranchSchema = z.object({
  branchName: BRANCH_NAME_SCHEMA,
  branchCode: BRANCH_CODE_SCHEMA,
  address: ADDRESS_SCHEMA,
  contactNumber: CONTACT_NUMBER_SCHEMA,
  gstRegistration: GST_REGISTRATION_SCHEMA,
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

// Create and Update share the same field set today. Kept as a separate named
// schema so a future spec can diverge them without touching callers, mirroring
// warehouse-schema.ts's identical convention.
export const updateBranchSchema = createBranchSchema;

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
