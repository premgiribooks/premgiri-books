"use server";

import { runAction } from "@/lib/run-action";
import type { LedgerBalanceResult, PostedVoucher } from "@/engines/voucher/types";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";
import type { CreatePaymentVoucherInput } from "@/modules/manual-vouchers/validation/payment-voucher-schema";
import type { ActionResult } from "@/types/api";

const LIST_PATH = "/accounting/payment-vouchers";

function voucherPaths(id: string): string[] {
  return [LIST_PATH, `${LIST_PATH}/${id}`];
}

export async function createPaymentVoucherAction(
  input: CreatePaymentVoucherInput
): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => paymentVoucherService.postPaymentVoucher(input), [LIST_PATH]);
}

export async function cancelPaymentVoucherAction(id: string): Promise<ActionResult<PostedVoucher>> {
  return runAction(() => paymentVoucherService.cancelPaymentVoucher(id), voucherPaths(id));
}

// Read-only — no revalidation. Shared by both the Payment Voucher and
// Receipt Voucher forms' inline outstanding-balance display.
export async function getLedgerOutstandingBalanceAction(
  ledgerId: string
): Promise<ActionResult<LedgerBalanceResult>> {
  return runAction(() => paymentVoucherService.getLedgerOutstandingBalance(ledgerId), []);
}
