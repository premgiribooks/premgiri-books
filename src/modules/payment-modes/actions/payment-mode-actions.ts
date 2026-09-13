"use server";

import { runAction } from "@/lib/run-action";
import { paymentModeService } from "@/modules/payment-modes/services/payment-mode-service";
import type {
  CreatePaymentModeInput,
  UpdatePaymentModeInput,
} from "@/modules/payment-modes/validation/payment-mode-schema";
import type { ActionResult } from "@/types/api";
import type { PaymentMode } from "@/types/payment-mode";

const LIST_PATH = "/accounting/payment-modes";

export async function createPaymentModeAction(
  input: CreatePaymentModeInput
): Promise<ActionResult<PaymentMode>> {
  return runAction(() => paymentModeService.createPaymentMode(input), [LIST_PATH]);
}

export async function updatePaymentModeAction(
  id: string,
  input: UpdatePaymentModeInput
): Promise<ActionResult<PaymentMode>> {
  return runAction(() => paymentModeService.updatePaymentMode(id, input), [
    LIST_PATH,
    `${LIST_PATH}/${id}/edit`,
  ]);
}

export async function activatePaymentModeAction(id: string): Promise<ActionResult<PaymentMode>> {
  return runAction(() => paymentModeService.activatePaymentMode(id), [LIST_PATH]);
}

export async function deactivatePaymentModeAction(id: string): Promise<ActionResult<PaymentMode>> {
  return runAction(() => paymentModeService.deactivatePaymentMode(id), [LIST_PATH]);
}
