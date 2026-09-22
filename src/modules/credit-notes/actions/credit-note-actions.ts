"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { creditNoteService } from "@/modules/credit-notes/services/credit-note-service";
import type { CreateCreditNoteInput, UpdateCreditNoteInput } from "@/modules/credit-notes/validation/credit-note-schema";
import type { ActionResult } from "@/types/api";
import type { CreditNoteDetail, CreditNoteListFilters, CreditNoteListRow } from "@/types/credit-note";

const LIST_PATH = "/sales/credit-notes";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Credit Notes list — a pure read, so
 * no paths are revalidated. */
export async function loadMoreCreditNotesAction(
  filters: CreditNoteListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<CreditNoteListRow>>> {
  return runAction(() => creditNoteService.listCreditNotesPage(filters, { skip, take }), []);
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
