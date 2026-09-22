"use server";

import { runAction } from "@/lib/run-action";
import type { Page } from "@/lib/pagination";
import type { PostedVoucher, VoucherListFilters } from "@/engines/voucher/types";
import { journalVoucherService } from "@/modules/manual-vouchers/services/journal-voucher-service";
import type { CreateJournalVoucherInput } from "@/modules/manual-vouchers/validation/journal-voucher-schema";
import type { ActionResult } from "@/types/api";

const LIST_PATH = "/accounting/journal-vouchers";

function voucherPaths(id: string): string[] {
  return [LIST_PATH, `${LIST_PATH}/${id}`];
}

/** Infinite-scroll "load more" for the Journal Vouchers list — a pure read,
 * so no paths are revalidated. */
export async function loadMoreJournalVouchersAction(
  filters: Omit<VoucherListFilters, "voucherType">,
  skip: number,
  take: number
): Promise<ActionResult<Page<PostedVoucher>>> {
  return runAction(() => journalVoucherService.listJournalVouchersPage(filters, { skip, take }), []);
}

export async function createJournalVoucherAction(
  input: CreateJournalVoucherInput
): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => journalVoucherService.postJournalVoucher(input), [LIST_PATH]);
}

export async function cancelJournalVoucherAction(id: string): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => journalVoucherService.cancelJournalVoucher(id), voucherPaths(id));
}
