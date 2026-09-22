"use server";

import { runAction } from "@/lib/run-action";
import { purchaseCreditNoteService } from "@/modules/purchase-credit-notes/services/purchase-credit-note-service";
import type { CreatePurchaseCreditNoteInput, UpdatePurchaseCreditNoteInput } from "@/modules/purchase-credit-notes/validation/purchase-credit-note-schema";
import type { ActionResult } from "@/types/api";
import type { PurchaseCreditNoteDetail } from "@/types/purchase-credit-note";

const LIST_PATH = "/purchase/credit-notes";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export async function createPurchaseCreditNoteDraftAction(
  input: CreatePurchaseCreditNoteInput
): Promise<ActionResult<PurchaseCreditNoteDetail>> {
  return runAction(() => purchaseCreditNoteService.createDraft(input), [LIST_PATH]);
}

export async function updatePurchaseCreditNoteDraftAction(
  id: string,
  input: UpdatePurchaseCreditNoteInput
): Promise<ActionResult<PurchaseCreditNoteDetail>> {
  return runAction(() => purchaseCreditNoteService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

export async function postPurchaseCreditNoteAction(id: string): Promise<ActionResult<PurchaseCreditNoteDetail>> {
  return runAction(() => purchaseCreditNoteService.postPurchaseCreditNote(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelPurchaseCreditNoteAction(id: string): Promise<ActionResult<PurchaseCreditNoteDetail>> {
  return runAction(() => purchaseCreditNoteService.cancelPurchaseCreditNote(id), [LIST_PATH, detailPath(id)]);
}
