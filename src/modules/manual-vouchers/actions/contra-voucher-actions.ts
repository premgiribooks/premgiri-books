"use server";

import { runAction } from "@/lib/run-action";
import type { PostedVoucher } from "@/engines/voucher/types";
import { contraVoucherService } from "@/modules/manual-vouchers/services/contra-voucher-service";
import type { CreateContraVoucherInput } from "@/modules/manual-vouchers/validation/contra-voucher-schema";
import type { ActionResult } from "@/types/api";

const LIST_PATH = "/accounting/contra-vouchers";

function voucherPaths(id: string): string[] {
  return [LIST_PATH, `${LIST_PATH}/${id}`];
}

export async function createContraVoucherAction(
  input: CreateContraVoucherInput
): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => contraVoucherService.postContraVoucher(input), [LIST_PATH]);
}

export async function cancelContraVoucherAction(id: string): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => contraVoucherService.cancelContraVoucher(id), voucherPaths(id));
}
