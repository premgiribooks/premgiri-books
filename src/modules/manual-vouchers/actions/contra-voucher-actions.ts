"use server";

import { runAction } from "@/lib/run-action";
import type { Page } from "@/lib/pagination";
import type { PostedVoucher, VoucherListFilters } from "@/engines/voucher/types";
import { contraVoucherService } from "@/modules/manual-vouchers/services/contra-voucher-service";
import type { CreateContraVoucherInput } from "@/modules/manual-vouchers/validation/contra-voucher-schema";
import type { ActionResult } from "@/types/api";

const LIST_PATH = "/accounting/contra-vouchers";

function voucherPaths(id: string): string[] {
  return [LIST_PATH, `${LIST_PATH}/${id}`];
}

/** Infinite-scroll "load more" for the Contra Vouchers list — a pure read,
 * so no paths are revalidated. */
export async function loadMoreContraVouchersAction(
  filters: Omit<VoucherListFilters, "voucherType">,
  skip: number,
  take: number
): Promise<ActionResult<Page<PostedVoucher>>> {
  return runAction(() => contraVoucherService.listContraVouchersPage(filters, { skip, take }), []);
}

export async function createContraVoucherAction(
  input: CreateContraVoucherInput
): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => contraVoucherService.postContraVoucher(input), [LIST_PATH]);
}

export async function cancelContraVoucherAction(id: string): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => contraVoucherService.cancelContraVoucher(id), voucherPaths(id));
}
