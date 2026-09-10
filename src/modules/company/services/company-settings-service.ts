import type { CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentUser, getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { companySettingsRepository } from "@/modules/company/repositories/company-settings-repository";
import {
  companySettingsSchema,
  salesLedgerMappingSchema,
  type CompanySettingsInput,
  type SalesLedgerMappingInput,
} from "@/modules/company/validation/company-schema";

export const companySettingsService = {
  async getSettings(companyId: string): Promise<CompanySettings | null> {
    const user = await getCurrentUser();
    if (user.userType !== "PLATFORM" && user.companyId !== companyId) {
      return null;
    }

    return companySettingsRepository.findByCompanyId(companyId);
  },

  // Operational settings (theme/date format/currency display, etc.) are a
  // Company Admin capability per the original spec's Company Module split
  // ("Company Admin may only modify operational settings. Legal business
  // information is managed only by Super Admin.") — gated by permission,
  // not assertSuperAdmin(); legal/business info lives on Company itself and
  // is edited only via companyService.updateCompany() (Super Admin only).
  async updateSettings(companyId: string, input: CompanySettingsInput): Promise<CompanySettings> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "company", "edit");
    if (user.companyId !== companyId) {
      throw new AppError("Company settings not found.");
    }

    const data = companySettingsSchema.parse(input);
    const settings = await companySettingsRepository.update(companyId, data);
    if (!settings) {
      throw new AppError("Company settings not found.");
    }
    return settings;
  },

  // Sales Invoice's ledger mapping (38-sales-invoice.md) — gated by
  // "settings"/"edit" (spec 34's Document Numbering precedent), NOT
  // "company"/"edit" like updateSettings above, since this section lives
  // under /settings, not the Company Admin's own Profile page.
  async updateSalesLedgerMapping(companyId: string, input: SalesLedgerMappingInput): Promise<CompanySettings> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "settings", "edit");
    if (user.companyId !== companyId) {
      throw new AppError("Company settings not found.");
    }

    const data = salesLedgerMappingSchema.parse(input);
    const settings = await companySettingsRepository.updateSalesLedgerMapping(companyId, data);
    if (!settings) {
      throw new AppError("Company settings not found.");
    }
    return settings;
  },
};
