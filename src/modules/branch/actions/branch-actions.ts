"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toActionErrorMessage } from "@/lib/action-error";
import { clearCurrentBranch, getCurrentBranchId, setCurrentBranch } from "@/lib/current-branch";
import { runAction } from "@/lib/run-action";
import { branchService } from "@/modules/branch/services/branch-service";
import type { CreateBranchInput, UpdateBranchInput } from "@/modules/branch/validation/branch-schema";
import type { ActionResult } from "@/types/api";
import type { Branch } from "@/types/branch";

const LIST_PATH = "/branch";

export async function createBranchAction(input: CreateBranchInput): Promise<ActionResult<Branch>> {
  return runAction(() => branchService.createBranch(input), [LIST_PATH]);
}

export async function updateBranchAction(
  id: string,
  input: UpdateBranchInput
): Promise<ActionResult<Branch>> {
  return runAction(() => branchService.updateBranch(id, input), [
    LIST_PATH,
    `/branch/${id}/edit`,
  ]);
}

export async function activateBranchAction(id: string): Promise<ActionResult<Branch>> {
  return runAction(() => branchService.activateBranch(id), [LIST_PATH]);
}

export async function deactivateBranchAction(id: string): Promise<ActionResult<Branch>> {
  const wasSelected = (await getCurrentBranchId()) === id;
  const result = await runAction(() => branchService.deactivateBranch(id), [LIST_PATH]);

  // getCurrentBranch() would already resolve this branch to null once
  // deactivated (its isActive check), but clearing the cookie here avoids a
  // lingering dead selection and matches closeFinancialYearAction's identical
  // post-mutation cookie cleanup.
  if (result.success && wasSelected) {
    await clearCurrentBranch();
    revalidatePath("/", "layout");
  }

  return result;
}

// Not runAction — this writes a cookie and redirects, mirroring
// selectFinancialYearAction/selectCompanyAction exactly.
export async function selectBranchAction(branchId: string): Promise<ActionResult> {
  try {
    await setCurrentBranch(branchId);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
