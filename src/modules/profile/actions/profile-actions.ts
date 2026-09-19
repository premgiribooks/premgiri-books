"use server";

import { toActionErrorMessage } from "@/lib/action-error";
import { assertNotRestoring } from "@/lib/restore-lock";
import { profileService } from "@/modules/profile/services/profile-service";
import type { ChangePasswordInput } from "@/modules/profile/validation/change-password-schema";
import type { ActionResult } from "@/types/api";

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  try {
    assertNotRestoring();
    await profileService.changeOwnPassword(input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  return { success: true };
}
