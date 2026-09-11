"use server";

import { runAction } from "@/lib/run-action";
import { physicalVerificationService } from "@/modules/physical-verifications/services/physical-verification-service";
import type {
  CreatePhysicalVerificationInput,
  UpdatePhysicalVerificationInput,
} from "@/modules/physical-verifications/validation/physical-verification-schema";
import type { ActionResult } from "@/types/api";
import type { PhysicalVerificationDetail } from "@/types/physical-verification";

const LIST_PATH = "/inventory/verifications";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export async function createPhysicalVerificationDraftAction(
  input: CreatePhysicalVerificationInput
): Promise<ActionResult<PhysicalVerificationDetail>> {
  return runAction(() => physicalVerificationService.createDraft(input), [LIST_PATH]);
}

export async function updatePhysicalVerificationDraftAction(
  id: string,
  input: UpdatePhysicalVerificationInput
): Promise<ActionResult<PhysicalVerificationDetail>> {
  return runAction(() => physicalVerificationService.updateDraft(id, input), [
    LIST_PATH,
    detailPath(id),
    `${detailPath(id)}/edit`,
  ]);
}

export async function completePhysicalVerificationAction(id: string): Promise<ActionResult<PhysicalVerificationDetail>> {
  return runAction(() => physicalVerificationService.completePhysicalVerification(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelPhysicalVerificationAction(id: string): Promise<ActionResult<PhysicalVerificationDetail>> {
  return runAction(() => physicalVerificationService.cancelPhysicalVerification(id), [LIST_PATH, detailPath(id)]);
}

/** The line editor's live system-quantity preview fetch — a pure read, so
 * nothing to revalidate. */
export async function getWarehouseStockPreviewAction(warehouseId: string): Promise<ActionResult<Record<string, number>>> {
  return runAction(() => physicalVerificationService.getWarehouseStockPreview(warehouseId), []);
}
