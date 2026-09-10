import type { CompanySettings } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRecordNotFoundError } from "@/modules/company/utils/prisma-errors";
import type { CompanySettingsInput, SalesLedgerMappingInput } from "@/modules/company/validation/company-schema";

export const companySettingsRepository = {
  findByCompanyId(companyId: string): Promise<CompanySettings | null> {
    return prisma.companySettings.findUnique({ where: { companyId } });
  },

  async update(companyId: string, data: CompanySettingsInput): Promise<CompanySettings | null> {
    try {
      return await prisma.companySettings.update({
        where: { companyId },
        data,
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  /** Sales Invoice's ledger mapping (38-sales-invoice.md) — a partial update
   * of just these six fields, separate from `update` above's full-shape
   * write (a different form, gated by a different permission). */
  async updateSalesLedgerMapping(companyId: string, data: SalesLedgerMappingInput): Promise<CompanySettings | null> {
    try {
      return await prisma.companySettings.update({
        where: { companyId },
        data: {
          salesLedgerId: data.salesLedgerId ?? null,
          outputCgstLedgerId: data.outputCgstLedgerId ?? null,
          outputSgstLedgerId: data.outputSgstLedgerId ?? null,
          outputIgstLedgerId: data.outputIgstLedgerId ?? null,
          outputCessLedgerId: data.outputCessLedgerId ?? null,
          roundOffLedgerId: data.roundOffLedgerId ?? null,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },
};
