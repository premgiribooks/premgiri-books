"use server";

import { runAction } from "@/lib/run-action";
import type { PostedVoucher } from "@/engines/voucher/types";
import { journalVoucherService } from "@/modules/manual-vouchers/services/journal-voucher-service";
import type { CreateJournalVoucherInput } from "@/modules/manual-vouchers/validation/journal-voucher-schema";
import type { ActionResult } from "@/types/api";

const LIST_PATH = "/accounting/journal-vouchers";

function voucherPaths(id: string): string[] {
  return [LIST_PATH, `${LIST_PATH}/${id}`];
}

export async function createJournalVoucherAction(
  input: CreateJournalVoucherInput
): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => journalVoucherService.postJournalVoucher(input), [LIST_PATH]);
}

export async function cancelJournalVoucherAction(id: string): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => journalVoucherService.cancelJournalVoucher(id), voucherPaths(id));
}
