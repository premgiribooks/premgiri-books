import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertLedgersAreCashOrBank } from "@/lib/ledger-class";
import type { Page, PageParams } from "@/lib/pagination";
import { assertPaymentModeMatchesLedger } from "@/lib/payment-mode-validation";
import { assertPermission } from "@/lib/permissions";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import type { PostedVoucher, VoucherListFilters } from "@/engines/voucher/types";
import { prisma } from "@/lib/prisma";
import { voucherRepository } from "@/modules/vouchers/repositories/voucher-repository";
import {
  createContraVoucherSchema,
  type CreateContraVoucherInput,
} from "@/modules/manual-vouchers/validation/contra-voucher-schema";

const NOT_FOUND_MESSAGE = "Contra voucher not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with contra vouchers.";

// Gated by the `accounting` permission module, matching where Payment/Receipt
// Vouchers already live (54-contra-voucher.md's Security section).
const MODULE = "accounting";

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

export const contraVoucherService = {
  async listContraVouchers(filters: Omit<VoucherListFilters, "voucherType"> = {}): Promise<PostedVoucher[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return voucherEngine.listVouchers(user.companyId, {
      ...filters,
      voucherType: "CONTRA",
      financialYearId: financialYear.id,
    });
  },

  /** Infinite-scroll page for the Contra Vouchers list. */
  async listContraVouchersPage(
    filters: Omit<VoucherListFilters, "voucherType">,
    page: PageParams
  ): Promise<Page<PostedVoucher>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return { items: [], hasMore: false };
    }
    return voucherRepository.findManyPage(
      user.companyId,
      { ...filters, voucherType: "CONTRA", financialYearId: financialYear.id },
      page
    );
  },

  // A voucher belonging to a different company, or one that isn't a Contra
  // Voucher, resolves identically to "not found" — never distinguish
  // "exists but isn't yours/isn't this type" (this codebase's standing
  // convention for every module).
  async getContraVoucher(id: string): Promise<PostedVoucher | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const voucher = await voucherEngine.getVoucher(user.companyId, id);
    if (!voucher || voucher.voucherType !== "CONTRA") {
      return null;
    }
    return voucher;
  },

  /**
   * Validates the Contra-specific entry shape (54-contra-voucher.md's
   * Business Rules) on top of what `voucherEngine.postVoucher` itself
   * re-enforces — exactly one Debit and one Credit entry, both restricted to
   * a Cash-in-Hand or BankAccount-linked ledger, source ≠ destination
   * (already rejected by the schema's own refine) — then posts the single
   * balanced entry pair. Unlike Payment/Receipt Voucher, the amount is a
   * single client-supplied value, not a sum of lines, since there is only
   * ever one entry per side.
   */
  async postContraVoucher(input: CreateContraVoucherInput): Promise<PostedVoucher> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "create");
    const financialYear = await requireFinancialYear();

    const data = createContraVoucherSchema.parse(input);
    await assertLedgersAreCashOrBank(prisma, user.companyId, [data.fromLedgerId, data.toLedgerId], "this contra voucher");
    // Validated against fromLedgerId (the credited/source side) — see this
    // schema's own comment: both sides are guaranteed Cash/Bank, so an
    // "ANY"-class mode always matches regardless of which side is checked.
    await assertPaymentModeMatchesLedger(prisma, data.paymentModeId, data.fromLedgerId, user.companyId);

    return voucherEngine.postVoucher(user.companyId, {
      financialYearId: financialYear.id,
      voucherType: "CONTRA",
      voucherDate: data.voucherDate,
      narration: data.narration,
      paymentModeId: data.paymentModeId,
      entries: [
        { ledgerId: data.toLedgerId, entryType: "DEBIT", amount: data.amount },
        { ledgerId: data.fromLedgerId, entryType: "CREDIT", amount: data.amount },
      ],
    });
  },

  /** Thin pass-through to `voucherEngine.cancelVoucher`, scoped to this voucher type — rejects an id belonging to some other voucher type reaching this screen's cancel action. */
  async cancelContraVoucher(id: string): Promise<PostedVoucher> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "approve");

    const voucher = await voucherEngine.getVoucher(user.companyId, id);
    if (!voucher || voucher.voucherType !== "CONTRA") {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return voucherEngine.cancelVoucher(user.companyId, id);
  },
};
