"use server";

import { assertSuperAdmin, getCurrentSuperAdmin } from "@/lib/current-user";
import { isRestoreInProgress } from "@/lib/restore-lock";
import { runAction } from "@/lib/run-action";
import { backupService } from "@/modules/backup/services/backup-service";
import { restoreSchema } from "@/modules/backup/validation/backup-schema";
import type { ActionResult } from "@/types/api";
import type { BackupJobWithRelations } from "@/types/backup";

const BACKUP_PATH = "/administration/backup";

export async function runBackupNowAction(): Promise<ActionResult<BackupJobWithRelations>> {
  return runAction(async () => {
    const actor = await getCurrentSuperAdmin();
    return backupService.runBackup("MANUAL", actor.id);
  }, [BACKUP_PATH]);
}

export async function runRestoreAction(rawInput: unknown): Promise<ActionResult<BackupJobWithRelations>> {
  return runAction(async () => {
    const actor = await getCurrentSuperAdmin();
    const input = restoreSchema.parse(rawInput);
    return backupService.runRestore(input.backupJobId, actor.id);
  }, [BACKUP_PATH]);
}

/**
 * Polled by the client while a Restore may be RUNNING — see
 * restoring-guard.tsx. Deliberately bypasses runAction's own restore guard:
 * this action's entire job is to report `isRestoring: true` WHILE that is
 * true, so the guard that blocks every other mutation must not also block
 * this one.
 */
export async function getRestoreStatusAction(): Promise<ActionResult<{ isRestoring: boolean }>> {
  return runAction(
    async () => {
      await assertSuperAdmin();
      return { isRestoring: isRestoreInProgress() };
    },
    [],
    { bypassRestoreGuard: true }
  );
}

