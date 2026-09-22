import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertPermission } from "@/lib/permissions";
import type { Page, PageParams } from "@/lib/pagination";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import { voucherRepository } from "@/modules/vouchers/repositories/voucher-repository";
import type { PostedVoucher, VoucherListFilters } from "@/engines/voucher/types";
import {
  createJournalVoucherSchema,
  type CreateJournalVoucherInput,
} from "@/modules/manual-vouchers/validation/journal-voucher-schema";

const NOT_FOUND_MESSAGE = "Journal voucher not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with journal vouchers.";

// Gated by the `accounting` permission module, matching where
// Payment/Receipt/Contra Vouchers already live (55-journal-voucher.md's
// Security section).
const MODULE = "accounting";

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

export const journalVoucherService = {
  async listJournalVouchers(filters: Omit<VoucherListFilters, "voucherType"> = {}): Promise<PostedVoucher[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return voucherEngine.listVouchers(user.companyId, {
      ...filters,
      voucherType: "JOURNAL",
      financialYearId: financialYear.id,
    });
  },

  /** Infinite-scroll page for the Journal Vouchers list. */
  async listJournalVouchersPage(
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
      { ...filters, voucherType: "JOURNAL", financialYearId: financialYear.id },
      page
    );
  },

  // A voucher belonging to a different company, or one that isn't a Journal
  // Voucher, resolves identically to "not found" — never distinguish
  // "exists but isn't yours/isn't this type" (this codebase's standing
  // convention for every module).
  async getJournalVoucher(id: string): Promise<PostedVoucher | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const voucher = await voucherEngine.getVoucher(user.companyId, id);
    if (!voucher || voucher.voucherType !== "JOURNAL") {
      return null;
    }
    return voucher;
  },

  /**
   * Posts the given entry set unmodified — no additional entry-shape
   * narrowing beyond what `voucherEngine.postVoucher` itself already
   * requires (≥2 entries, sum Debit === sum Credit, every amount > 0). Since
   * an unrestricted debit/credit entry against any ledger is a plausible
   * error/fraud surface with no structural safeguard otherwise
   * (55-journal-voucher.md's Goal), posting requires `approve`, not merely
   * `create` — the one deliberate divergence from Payment/Receipt/Contra
   * Voucher's permission shape.
   */
  async postJournalVoucher(input: CreateJournalVoucherInput): Promise<PostedVoucher> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "approve");
    const financialYear = await requireFinancialYear();

    const data = createJournalVoucherSchema.parse(input);

    return voucherEngine.postVoucher(user.companyId, {
      financialYearId: financialYear.id,
      voucherType: "JOURNAL",
      voucherDate: data.voucherDate,
      narration: data.narration,
      entries: data.entries.map((entry) => ({
        ledgerId: entry.ledgerId,
        entryType: entry.entryType,
        amount: entry.amount,
      })),
    });
  },

  /** Thin pass-through to `voucherEngine.cancelVoucher`, scoped to this voucher type — rejects an id belonging to some other voucher type reaching this screen's cancel action. Gated by `approve`, same as Post (see postJournalVoucher). */
  async cancelJournalVoucher(id: string): Promise<PostedVoucher> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "approve");

    const voucher = await voucherEngine.getVoucher(user.companyId, id);
    if (!voucher || voucher.voucherType !== "JOURNAL") {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return voucherEngine.cancelVoucher(user.companyId, id);
  },
};
