"use server";

import { runAction } from "@/lib/run-action";
import { creditNoteService } from "@/modules/credit-notes/services/credit-note-service";
import type { CreateCreditNoteInput, UpdateCreditNoteInput } from "@/modules/credit-notes/validation/credit-note-schema";
import type { ActionResult } from "@/types/api";
import type { CreditNoteDetail } from "@/types/credit-note";

const LIST_PATH = "/sales/credit-notes";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export async function createCreditNoteDraftAction(input: CreateCreditNoteInput): Promise<ActionResult<CreditNoteDetail>> {
  return runAction(() => creditNoteService.createDraft(input), [LIST_PATH]);
}

export async function updateCreditNoteDraftAction(
  id: string,
  input: UpdateCreditNoteInput
): Promise<ActionResult<CreditNoteDetail>> {
  return runAction(() => creditNoteService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

export async function postCreditNoteAction(id: string): Promise<ActionResult<CreditNoteDetail>> {
  return runAction(() => creditNoteService.postCreditNote(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelCreditNoteAction(id: string): Promise<ActionResult<CreditNoteDetail>> {
  return runAction(() => creditNoteService.cancelCreditNote(id), [LIST_PATH, detailPath(id)]);
}
