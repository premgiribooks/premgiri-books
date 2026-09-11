import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertLedgersAreCashOrBank } from "@/lib/ledger-class";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import { toPaise } from "@/engines/voucher/voucher-validation";
import type { PostedVoucher, VoucherListFilters } from "@/engines/voucher/types";
import { CASH_IN_HAND_GROUP_NAME } from "@/modules/ledger-groups/constants/default-groups";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";
import {
  createPaymentVoucherSchema,
  type CreatePaymentVoucherInput,
} from "@/modules/manual-vouchers/validation/payment-voucher-schema";
import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";

const NOT_FOUND_MESSAGE = "Payment voucher not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with payment vouchers.";

// Gated by the `accounting` permission module, matching where Ledger
// Groups/Ledger Master/Bank Management already live (52-payment-voucher.md's
// Security section).
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

export const paymentVoucherService = {
  async listPaymentVouchers(filters: Omit<VoucherListFilters, "voucherType"> = {}): Promise<PostedVoucher[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return voucherEngine.listVouchers(user.companyId, {
      ...filters,
      voucherType: "PAYMENT",
      financialYearId: financialYear.id,
    });
  },

  // A voucher belonging to a different company, or one that isn't a Payment
  // Voucher, resolves identically to "not found" — never distinguish
  // "exists but isn't yours/isn't this type" (this codebase's standing
  // convention for every module).
  async getPaymentVoucher(id: string): Promise<PostedVoucher | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const voucher = await voucherEngine.getVoucher(user.companyId, id);
    if (!voucher || voucher.voucherType !== "PAYMENT") {
      return null;
    }
    return voucher;
  },

  /**
   * The Create form's ledger pickers — every active company ledger, each
   * flagged `isCashOrBank` so the UI can present the Credit-side picker
   * restricted to that subset while the Debit-side picker offers the full
   * list. Gated on `view` like every other picker read in this codebase
   * (`ledgerService.listSelectableLedgers`'s identical posture) — the
   * stricter `create` gate applies only to actually posting a voucher.
   */
  async listLedgerOptions(): Promise<ManualVoucherLedgerOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const [ledgers, groups] = await Promise.all([
      prisma.ledger.findMany({
        where: { companyId: user.companyId, isActive: true },
        select: { id: true, name: true, ledgerGroupId: true, bankAccount: { select: { id: true } } },
        orderBy: { name: "asc" },
      }),
      ledgerGroupRepository.findMany(user.companyId),
    ]);
    const cashGroupIds = getGroupSubtreeIds(groups, [CASH_IN_HAND_GROUP_NAME]);

    return ledgers.map((ledger) => ({
      id: ledger.id,
      name: ledger.name,
      isCashOrBank: cashGroupIds.has(ledger.ledgerGroupId) || ledger.bankAccount !== null,
    }));
  },

  /**
   * Validates the Payment-specific entry shape (52-payment-voucher.md's
   * Business Rules) on top of what `voucherEngine.postVoucher` itself
   * re-enforces — exactly one Credit entry restricted to a Cash-in-Hand or
   * BankAccount-linked ledger, one or more Debit entries against any other
   * active ledger — then shapes and posts the balanced `PostVoucherInput`.
   * The Credit entry's amount is always the sum of the Debit lines,
   * computed here, never trusted from the client.
   */
  async postPaymentVoucher(input: CreatePaymentVoucherInput): Promise<PostedVoucher> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "create");
    const financialYear = await requireFinancialYear();

    const data = createPaymentVoucherSchema.parse(input);
    await assertLedgersAreCashOrBank(prisma, user.companyId, [data.creditLedgerId], "this payment");

    const totalAmount = sumAmounts(data.debitLines.map((line) => line.amount));

    return voucherEngine.postVoucher(user.companyId, {
      financialYearId: financialYear.id,
      voucherType: "PAYMENT",
      voucherDate: data.voucherDate,
      narration: data.narration,
      entries: [
        { ledgerId: data.creditLedgerId, entryType: "CREDIT", amount: totalAmount },
        ...data.debitLines.map((line) => ({
          ledgerId: line.ledgerId,
          entryType: "DEBIT" as const,
          amount: line.amount,
        })),
      ],
    });
  },

  /** Thin pass-through to `voucherEngine.cancelVoucher`, scoped to this voucher type — rejects an id belonging to some other voucher type reaching this screen's cancel action. */
  async cancelPaymentVoucher(id: string): Promise<PostedVoucher> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "approve");

    const voucher = await voucherEngine.getVoucher(user.companyId, id);
    if (!voucher || voucher.voucherType !== "PAYMENT") {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return voucherEngine.cancelVoucher(user.companyId, id);
  },
};
