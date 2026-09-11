import type { CompanySettings } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRecordNotFoundError } from "@/modules/company/utils/prisma-errors";
import type {
  CompanySettingsInput,
  GstFilingFrequencyInput,
  SalesLedgerMappingInput,
} from "@/modules/company/validation/company-schema";

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

  /** Sales Invoice's (38-sales-invoice.md) and Purchase Invoice's
   * (44-purchase-invoice.md) combined ledger mapping — a partial update of
   * these eleven fields, separate from `update` above's full-shape write (a
   * different form, gated by a different permission). */
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
          purchaseLedgerId: data.purchaseLedgerId ?? null,
          inputCgstLedgerId: data.inputCgstLedgerId ?? null,
          inputSgstLedgerId: data.inputSgstLedgerId ?? null,
          inputIgstLedgerId: data.inputIgstLedgerId ?? null,
          inputCessLedgerId: data.inputCessLedgerId ?? null,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  /** GSTR-1/GSTR-3B period-selector granularity (58-gstr-1.md) — its own
   * single-field partial update, mirroring updateSalesLedgerMapping's
   * separate-section-from-`update`-above shape. */
  async updateGstFilingFrequency(companyId: string, data: GstFilingFrequencyInput): Promise<CompanySettings | null> {
    try {
      return await prisma.companySettings.update({
        where: { companyId },
        data: { gstFilingFrequency: data.gstFilingFrequency },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },
};
