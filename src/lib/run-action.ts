import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { logger } from "@/lib/logger";
import { isRestoreInProgress } from "@/lib/restore-lock";
import type { ActionResult } from "@/types/api";

export interface RunActionOptions {
  /**
   * 81-backup-restore.md's maintenance-mode requirement — while a database
   * Restore is running, every Server Action mutation in the app must be
   * refused. Since every module's actions already call this one shared
   * wrapper, checking `isRestoreInProgress()` here (rather than in each of
   * the ~40 call sites) blocks writes app-wide from one chokepoint. The one
   * deliberate exception is `getRestoreStatusAction` itself, which must
   * keep succeeding — with `isRestoring: true` in its own data — precisely
   * while this is true, so the client can detect and display it.
   */
  bypassRestoreGuard?: boolean;
}

/**
 * Shared wrapper for Server Actions: runs the service operation, revalidates
 * the given routes on success, and translates any error through the standard
 * toActionErrorMessage envelope. Lives outside the "use server" files because
 * those may only export async Server Actions, not helpers.
 *
 * Originally src/modules/ledgers/actions/run-ledger-action.ts (16-expense-heads.md
 * review fixes); promoted here by 19-unit-management.md so modules other than
 * ledgers can share it without a cross-module import.
 *
 * Only operation() failures are reported as failures. Once the operation has
 * committed, a revalidatePath() throw must not mark the action failed — the
 * mutation already persisted, and reporting failure would invite a "retry"
 * of work that succeeded. It is logged server-side instead; the affected
 * screens simply serve cached data until their next natural revalidation.
 */
export async function runAction<T>(
  operation: () => Promise<T>,
  revalidatePaths: readonly string[],
  options: RunActionOptions = {}
): Promise<ActionResult<T>> {
  if (!options.bypassRestoreGuard && isRestoreInProgress()) {
    return { success: false, error: "A database restore is currently running. Please try again shortly." };
  }

  let data: T;
  try {
    data = await operation();
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  for (const path of revalidatePaths) {
    try {
      revalidatePath(path);
    } catch (error) {
      logger.warn({ err: error, path }, "revalidatePath failed after a committed action");
    }
  }

  return { success: true, data };
}
