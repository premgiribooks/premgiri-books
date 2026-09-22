"use server";

import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import type { Page } from "@/lib/pagination";
import { assertNotRestoring } from "@/lib/restore-lock";
import { runAction } from "@/lib/run-action";
import { userService } from "@/modules/users/services/user-service";
import type { UserFormInput } from "@/modules/users/validation/user-schema";
import type { ActionResult } from "@/types/api";
import type { UserListFilters, UserWithRole } from "@/types/user";

/** Infinite-scroll "load more" for the Users list — a pure read, so no
 * paths are revalidated. */
export async function loadMoreUsersAction(
  filters: UserListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<UserWithRole>>> {
  return runAction(() => userService.listUsersPage(filters, { skip, take }), []);
}

export async function createUserAction(
  input: UserFormInput
): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    assertNotRestoring();
    user = await userService.createUser(input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  return { success: true, data: user };
}

export async function updateUserAction(
  id: string,
  input: UserFormInput
): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    assertNotRestoring();
    user = await userService.updateUser(id, input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${id}/edit`);
  return { success: true, data: user };
}

export async function activateUserAction(id: string): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    assertNotRestoring();
    user = await userService.activateUser(id);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  return { success: true, data: user };
}

export async function deactivateUserAction(id: string): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    assertNotRestoring();
    user = await userService.deactivateUser(id);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  return { success: true, data: user };
}
