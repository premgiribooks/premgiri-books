"use server";

import { runAction } from "@/lib/run-action";
import { quotationService } from "@/modules/quotations/services/quotation-service";
import type {
  CreateQuotationInput,
  PreviewQuotationInput,
  UpdateQuotationInput,
} from "@/modules/quotations/validation/quotation-schema";
import type { ActionResult } from "@/types/api";
import type { QuotationDetail, QuotationPreview, ResolvedLinePrice } from "@/types/quotation";

const LIST_PATH = "/sales/quotations";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export async function createQuotationAction(
  input: CreateQuotationInput
): Promise<ActionResult<QuotationDetail>> {
  return runAction(() => quotationService.createQuotation(input), [LIST_PATH]);
}

export async function updateQuotationAction(
  id: string,
  input: UpdateQuotationInput
): Promise<ActionResult<QuotationDetail>> {
  return runAction(() => quotationService.updateQuotation(id, input), [
    LIST_PATH,
    detailPath(id),
    `${detailPath(id)}/edit`,
  ]);
}

export async function sendQuotationAction(id: string): Promise<ActionResult<QuotationDetail>> {
  return runAction(() => quotationService.sendQuotation(id), [LIST_PATH, detailPath(id)]);
}

export async function acceptQuotationAction(id: string): Promise<ActionResult<QuotationDetail>> {
  return runAction(() => quotationService.acceptQuotation(id), [LIST_PATH, detailPath(id)]);
}

export async function rejectQuotationAction(id: string): Promise<ActionResult<QuotationDetail>> {
  return runAction(() => quotationService.rejectQuotation(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelQuotationAction(id: string): Promise<ActionResult<QuotationDetail>> {
  return runAction(() => quotationService.cancelQuotation(id), [LIST_PATH, detailPath(id)]);
}

// Read-only — no revalidation. Wraps the Pricing Engine's resolvePrice so a
// new line's rate prefills without the browser touching pricing logic
// itself (35-quotations.md's UI: "Engine Driven applies to Server Actions,
// not just Prisma access").
export async function resolveLinePriceAction(input: {
  productId: string;
  quantity: number;
  customerId?: string;
  asOfDate?: string;
}): Promise<ActionResult<ResolvedLinePrice>> {
  return runAction(() => quotationService.resolveLinePrice(input), []);
}

// Read-only — no revalidation. Wraps the GST Engine composition for the
// live-editing line/totals preview; never persists anything.
export async function previewQuotationAction(
  input: PreviewQuotationInput
): Promise<ActionResult<QuotationPreview>> {
  return runAction(() => quotationService.previewQuotation(input), []);
}
