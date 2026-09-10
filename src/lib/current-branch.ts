import { cache } from "react";
import { cookies } from "next/headers";

import { AppError } from "@/lib/app-error";
import { COOKIE_KEYS } from "@/constants/cookie-keys";
import { getCurrentCompanyId } from "@/lib/current-company";
import { getCurrentUserOrNull, resolveFailingClosed } from "@/lib/current-user";
import { branchService } from "@/modules/branch/services/branch-service";
import type { Branch } from "@/types/branch";

const ACTIVE_BRANCH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function getCurrentBranchId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_KEYS.ACTIVE_BRANCH_ID)?.value ?? null;
}

export const getCurrentBranch = cache(async (): Promise<Branch | null> => {
  // See the matching short-circuit in current-company.ts — a PLATFORM user
  // never has tenant context. Checked before any cookie/DB access: this must
  // hold even when RootLayout renders for a PLATFORM user on /administration.
  const currentUser = await getCurrentUserOrNull();
  if (currentUser?.userType === "PLATFORM") {
    return null;
  }

  const branchId = await getCurrentBranchId();
  if (!branchId) {
    return null;
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return null;
  }

  // Fails closed — see the matching comment in current-company.ts. RootLayout
  // calls this for every page, including the public /login page, so a stale
  // active_branch_id cookie outliving its session must resolve to null rather
  // than throw AuthenticationError.
  const branch = await resolveFailingClosed(() => branchService.getBranch(branchId));

  // A branch selected earlier in the session that has since been
  // deactivated must resolve to null, not to a stale, no-longer-selectable
  // branch — mirroring getCurrentFinancialYear()'s identical "the active
  // context must never keep pointing at something that's no longer
  // eligible" rule. None of these are error conditions: "no branch selected"
  // is a normal, fully-supported state (12-branch-management.md).
  if (!branch || branch.companyId !== companyId || !branch.isActive) {
    return null;
  }

  return branch;
});

export async function setCurrentBranch(branchId: string): Promise<Branch> {
  const branch = await branchService.getBranch(branchId);
  if (!branch) {
    throw new AppError("Branch not found.");
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId || branch.companyId !== companyId) {
    throw new AppError("This branch does not belong to the active company.");
  }

  if (!branch.isActive) {
    throw new AppError("Inactive branches cannot be selected.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEYS.ACTIVE_BRANCH_ID, branch.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_BRANCH_COOKIE_MAX_AGE_SECONDS,
  });

  return branch;
}

export async function clearCurrentBranch(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_KEYS.ACTIVE_BRANCH_ID);
}
