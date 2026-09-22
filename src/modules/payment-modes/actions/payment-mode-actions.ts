"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { paymentModeService } from "@/modules/payment-modes/services/payment-mode-service";
import type {
  CreatePaymentModeInput,
  UpdatePaymentModeInput,
} from "@/modules/payment-modes/validation/payment-mode-schema";
import type { ActionResult } from "@/types/api";
import type { PaymentMode, PaymentModeListFilters } from "@/types/payment-mode";

const LIST_PATH = "/accounting/payment-modes";

/** Infinite-scroll "load more" for the Payment Modes list — a pure read, so
 * no paths are revalidated. */
export async function loadMorePaymentModesAction(
  filters: PaymentModeListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<PaymentMode>>> {
  return runAction(() => paymentModeService.listPaymentModesPage(filters, { skip, take }), []);
}

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
