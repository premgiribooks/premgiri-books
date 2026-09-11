"use server";

import { runAction } from "@/lib/run-action";
import type { PostedVoucher } from "@/engines/voucher/types";
import { receiptVoucherService } from "@/modules/manual-vouchers/services/receipt-voucher-service";
import type { CreateReceiptVoucherInput } from "@/modules/manual-vouchers/validation/receipt-voucher-schema";
import type { ActionResult } from "@/types/api";

const LIST_PATH = "/accounting/receipt-vouchers";

function voucherPaths(id: string): string[] {
  return [LIST_PATH, `${LIST_PATH}/${id}`];
}

export async function createReceiptVoucherAction(
  input: CreateReceiptVoucherInput
): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => receiptVoucherService.postReceiptVoucher(input), [LIST_PATH]);
}

export async function cancelReceiptVoucherAction(id: string): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => receiptVoucherService.cancelReceiptVoucher(id), voucherPaths(id));
}
