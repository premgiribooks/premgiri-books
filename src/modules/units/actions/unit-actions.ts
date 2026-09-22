"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { unitService } from "@/modules/units/services/unit-service";
import type { CreateUnitInput, UpdateUnitInput } from "@/modules/units/validation/unit-schema";
import type { ActionResult } from "@/types/api";
import type { Unit, UnitListFilters } from "@/types/unit";

const LIST_PATH = "/masters/units";

/** Infinite-scroll "load more" for the Units list — a pure read, so no
 * paths are revalidated. */
export async function loadMoreUnitsAction(
  filters: UnitListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<Unit>>> {
  return runAction(() => unitService.listUnitsPage(filters, { skip, take }), []);
}

export async function createUnitAction(input: CreateUnitInput): Promise<ActionResult<Unit>> {
  return runAction(() => unitService.createUnit(input), [LIST_PATH]);
}

export async function updateUnitAction(
  id: string,
  input: UpdateUnitInput
): Promise<ActionResult<Unit>> {
  return runAction(() => unitService.updateUnit(id, input), [
    LIST_PATH,
    `/masters/units/${id}/edit`,
  ]);
}

export async function activateUnitAction(id: string): Promise<ActionResult<Unit>> {
  return runAction(() => unitService.activateUnit(id), [LIST_PATH]);
}

export async function deactivateUnitAction(id: string): Promise<ActionResult<Unit>> {
  return runAction(() => unitService.deactivateUnit(id), [LIST_PATH]);
}
