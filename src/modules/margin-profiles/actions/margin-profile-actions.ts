"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { marginProfileService } from "@/modules/margin-profiles/services/margin-profile-service";
import type {
  CreateMarginProfileInput,
  UpdateMarginProfileInput,
} from "@/modules/margin-profiles/validation/margin-profile-schema";
import type { ActionResult } from "@/types/api";
import type { MarginProfile, MarginProfileListFilters } from "@/types/margin-profile";

const LIST_PATH = "/masters/margin-profiles";

/** Infinite-scroll "load more" for the Margin Profiles list — a pure read,
 * so no paths are revalidated. */
export async function loadMoreMarginProfilesAction(
  filters: MarginProfileListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<MarginProfile>>> {
  return runAction(() => marginProfileService.listMarginProfilesPage(filters, { skip, take }), []);
}

export async function createMarginProfileAction(
  input: CreateMarginProfileInput
): Promise<ActionResult<MarginProfile>> {
  return runAction(() => marginProfileService.createMarginProfile(input), [LIST_PATH]);
}

export async function updateMarginProfileAction(
  id: string,
  input: UpdateMarginProfileInput
): Promise<ActionResult<MarginProfile>> {
  return runAction(() => marginProfileService.updateMarginProfile(id, input), [
    LIST_PATH,
    `/masters/margin-profiles/${id}/edit`,
  ]);
}

export async function activateMarginProfileAction(
  id: string
): Promise<ActionResult<MarginProfile>> {
  return runAction(() => marginProfileService.activateMarginProfile(id), [LIST_PATH]);
}

export async function deactivateMarginProfileAction(
  id: string
): Promise<ActionResult<MarginProfile>> {
  return runAction(() => marginProfileService.deactivateMarginProfile(id), [LIST_PATH]);
}
