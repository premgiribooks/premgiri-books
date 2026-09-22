"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { debitNoteService } from "@/modules/debit-notes/services/debit-note-service";
import type { CreateDebitNoteInput, UpdateDebitNoteInput } from "@/modules/debit-notes/validation/debit-note-schema";
import type { ActionResult } from "@/types/api";
import type { DebitNoteDetail, DebitNoteListFilters, DebitNoteListRow } from "@/types/debit-note";

const LIST_PATH = "/sales/debit-notes";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Debit Notes list — a pure read, so
 * no paths are revalidated. */
export async function loadMoreDebitNotesAction(
  filters: DebitNoteListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<DebitNoteListRow>>> {
  return runAction(() => debitNoteService.listDebitNotesPage(filters, { skip, take }), []);
}

export async function createDebitNoteDraftAction(input: CreateDebitNoteInput): Promise<ActionResult<DebitNoteDetail>> {
  return runAction(() => debitNoteService.createDraft(input), [LIST_PATH]);
}

export async function updateDebitNoteDraftAction(
  id: string,
  input: UpdateDebitNoteInput
): Promise<ActionResult<DebitNoteDetail>> {
  return runAction(() => debitNoteService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

export async function postDebitNoteAction(id: string): Promise<ActionResult<DebitNoteDetail>> {
  return runAction(() => debitNoteService.postDebitNote(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelDebitNoteAction(id: string): Promise<ActionResult<DebitNoteDetail>> {
  return runAction(() => debitNoteService.cancelDebitNote(id), [LIST_PATH, detailPath(id)]);
}
