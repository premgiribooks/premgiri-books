import {
  createMarginProfileSchema,
  type CreateMarginProfileInput,
} from "@/modules/margin-profiles/validation/margin-profile-schema";
import { marginProfileService } from "@/modules/margin-profiles/services/margin-profile-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell, parseRequiredNumber } from "@/modules/bulk-import/targets/import-cell-parsers";

// Margin Profile has no natural-key references to another master —
// resolveRow is just cell-parsing through the master's own existing Zod
// create schema, the same shape as gst-rate-import-target.ts. The schema's
// own superRefine (capping the 4 tiers below 100 only in MARGIN mode) is
// left to `.safeParse` rather than duplicated here.
export const MARGIN_PROFILE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Name", required: true, example: "Retail Margin Profile" },
  { key: "calculationMode", header: "Calculation Mode (MARGIN/MARKUP)", required: true, example: "MARGIN" },
  { key: "retailPercent", header: "Retail Percent", required: true, example: "20" },
  { key: "wholesalePercent", header: "Wholesale Percent", required: true, example: "15" },
  { key: "dealerPercent", header: "Dealer Percent", required: true, example: "10" },
  { key: "distributorPercent", header: "Distributor Percent", required: true, example: "8" },
  { key: "description", header: "Description", required: false, example: "" },
];

export const marginProfileImportTarget: ImportTarget<CreateMarginProfileInput> = {
  key: "margin-profiles",
  label: "Margin Profiles",
  columns: MARGIN_PROFILE_IMPORT_COLUMNS,

  async resolveRow(rawRow): Promise<ResolvedRowResult<CreateMarginProfileInput>> {
    const errors: string[] = [];

    const candidate = {
      name: getCell(rawRow, "name"),
      calculationMode: getCell(rawRow, "calculationMode").toUpperCase(),
      retailPercent: parseRequiredNumber(getCell(rawRow, "retailPercent"), "Retail percent", errors),
      wholesalePercent: parseRequiredNumber(getCell(rawRow, "wholesalePercent"), "Wholesale percent", errors),
      dealerPercent: parseRequiredNumber(getCell(rawRow, "dealerPercent"), "Dealer percent", errors),
      distributorPercent: parseRequiredNumber(getCell(rawRow, "distributorPercent"), "Distributor percent", errors),
      description: getOptionalCell(rawRow, "description"),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createMarginProfileSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const marginProfile = await marginProfileService.createMarginProfile(resolvedInput);
    return { id: marginProfile.id };
  },
};
