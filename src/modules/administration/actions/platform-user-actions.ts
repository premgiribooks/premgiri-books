"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { toActionErrorMessage } from "@/lib/action-error";
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/constants/password-policy";
import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { assertNotRestoring } from "@/lib/restore-lock";
import { platformUserService } from "@/modules/administration/services/platform-user-service";
import type { SaveCompanyAdminInput } from "@/modules/administration/validation/create-company-schema";
import type { ActionResult } from "@/types/api";
import type { CompanyAdminSummary } from "@/types/user";

/** Infinite-scroll "load more" for the Company Admins list — a pure read,
 * so no paths are revalidated. */
export async function loadMoreCompanyAdminsAction(
  skip: number,
  take: number
): Promise<ActionResult<Page<CompanyAdminSummary>>> {
  return runAction(() => platformUserService.listCompanyAdminsPage({ skip, take }), []);
}

const resetPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, "Password is too long")
  .refine((value) => PASSWORD_COMPLEXITY_REGEX.test(value), { message: PASSWORD_COMPLEXITY_MESSAGE });

export async function resetCompanyAdminPasswordAction(
  userId: string,
  newPassword: string
): Promise<ActionResult<undefined>> {
  try {
    assertNotRestoring();
    const parsed = resetPasswordSchema.parse(newPassword);
    await platformUserService.resetCompanyAdminPassword(userId, parsed);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  return { success: true };
}

export async function saveCompanyAdminAction(
  userId: string,
  input: SaveCompanyAdminInput
): Promise<ActionResult<undefined>> {
  try {
    assertNotRestoring();
    await platformUserService.saveCompanyAdmin(userId, input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/administration/company-admins");
  return { success: true };
}

export async function setCompanyAdminActiveAction(
  userId: string,
  isActive: boolean
): Promise<ActionResult<undefined>> {
  try {
    assertNotRestoring();
    await platformUserService.setCompanyAdminActive(userId, isActive);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/administration/company-admins");
  return { success: true };
}
