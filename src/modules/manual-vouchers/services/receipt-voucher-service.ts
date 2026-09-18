import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertLedgersAreCashOrBank } from "@/lib/ledger-class";
import { assertPaymentModeMatchesLedger } from "@/lib/payment-mode-validation";
import { assertPermission } from "@/lib/permissions";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import { toPaise } from "@/engines/voucher/voucher-validation";
import type { PostedVoucher, VoucherListFilters } from "@/engines/voucher/types";
import { prisma } from "@/lib/prisma";
import {
  createReceiptVoucherSchema,
  type CreateReceiptVoucherInput,
} from "@/modules/manual-vouchers/validation/receipt-voucher-schema";

const NOT_FOUND_MESSAGE = "Receipt voucher not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with receipt vouchers.";

// Gated by the `accounting` permission module, matching where Payment
// Vouchers already live (53-receipt-voucher.md's Security section, mirroring
// 52-payment-voucher.md).
const MODULE = "accounting";

/** Sums a set of rupee amounts in integer paise before dividing back down — avoids the float drift plain addition of rupee amounts can introduce (mirrors voucher-validation.ts's own paise convention). */
function sumAmounts(amounts: readonly number[]): number {
  const totalPaise = amounts.reduce((sum, amount) => sum + toPaise(amount), 0);
  return totalPaise / 100;
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

export const receiptVoucherService = {
  async listReceiptVouchers(filters: Omit<VoucherListFilters, "voucherType"> = {}): Promise<PostedVoucher[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return voucherEngine.listVouchers(user.companyId, {
      ...filters,
      voucherType: "RECEIPT",
      financialYearId: financialYear.id,
    });
  },

  // A voucher belonging to a different company, or one that isn't a Receipt
  // Voucher, resolves identically to "not found" — never distinguish
  // "exists but isn't yours/isn't this type" (this codebase's standing
  // convention for every module).
  async getReceiptVoucher(id: string): Promise<PostedVoucher | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const voucher = await voucherEngine.getVoucher(user.companyId, id);
    if (!voucher || voucher.voucherType !== "RECEIPT") {
      return null;
    }
    return voucher;
  },

  /**
   * Validates the Receipt-specific entry shape (53-receipt-voucher.md's
   * Business Rules) on top of what `voucherEngine.postVoucher` itself
   * re-enforces — exactly one Debit entry restricted to a Cash-in-Hand or
   * BankAccount-linked ledger, one or more Credit entries against any other
   * active ledger — then shapes and posts the balanced `PostVoucherInput`.
   * The Debit entry's amount is always the sum of the Credit lines, computed
   * here, never trusted from the client.
   */
  async postReceiptVoucher(input: CreateReceiptVoucherInput): Promise<PostedVoucher> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "create");
    const financialYear = await requireFinancialYear();

    const data = createReceiptVoucherSchema.parse(input);
    await assertLedgersAreCashOrBank(prisma, user.companyId, [data.debitLedgerId], "this receipt");
    await assertPaymentModeMatchesLedger(prisma, data.paymentModeId, data.debitLedgerId, user.companyId);

    const totalAmount = sumAmounts(data.creditLines.map((line) => line.amount));

    return voucherEngine.postVoucher(user.companyId, {
      financialYearId: financialYear.id,
      voucherType: "RECEIPT",
      voucherDate: data.voucherDate,
      narration: data.narration,
      paymentModeId: data.paymentModeId,
      entries: [
        { ledgerId: data.debitLedgerId, entryType: "DEBIT", amount: totalAmount },
        ...data.creditLines.map((line) => ({
          ledgerId: line.ledgerId,
          entryType: "CREDIT" as const,
          amount: line.amount,
        })),
      ],
    });
  },

  /** Thin pass-through to `voucherEngine.cancelVoucher`, scoped to this voucher type — rejects an id belonging to some other voucher type reaching this screen's cancel action. */
  async cancelReceiptVoucher(id: string): Promise<PostedVoucher> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "approve");

    const voucher = await voucherEngine.getVoucher(user.companyId, id);
    if (!voucher || voucher.voucherType !== "RECEIPT") {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return voucherEngine.cancelVoucher(user.companyId, id);
  },
};
