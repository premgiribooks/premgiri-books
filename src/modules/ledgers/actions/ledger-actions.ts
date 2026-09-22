"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import type { CreateLedgerInput, UpdateLedgerInput } from "@/modules/ledgers/validation/ledger-schema";
import type { ActionResult } from "@/types/api";
import type { Ledger, LedgerListFilters, LedgerWithGroup } from "@/types/ledger";

const LIST_PATH = "/accounting/ledgers";

/** Infinite-scroll "load more" for the Ledgers list — a pure read, so no
 * paths are revalidated. */
export async function loadMoreLedgersAction(
  filters: LedgerListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<LedgerWithGroup>>> {
  return runAction(() => ledgerService.listLedgersPage(filters, { skip, take }), []);
}

export async function createLedgerAction(input: CreateLedgerInput): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.createLedger(input), [LIST_PATH]);
}

export async function updateLedgerAction(
  id: string,
  input: UpdateLedgerInput
): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.updateLedger(id, input), [
    LIST_PATH,
    `/accounting/ledgers/${id}/edit`,
  ]);
}

export async function activateLedgerAction(id: string): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.activateLedger(id), [LIST_PATH]);
}

export async function deactivateLedgerAction(id: string): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.deactivateLedger(id), [LIST_PATH]);
}
