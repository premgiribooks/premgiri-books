import { startOfDay } from "date-fns";

import { logger } from "@/lib/logger";
import { backupJobRepository } from "@/modules/backup/repositories/backup-job-repository";
import { backupService } from "@/modules/backup/services/backup-service";

/**
 * The launch-time "is today's backup already done?" catch-up check
 * (81-backup-restore.md's Scheduling Mechanism) — called once from
 * `src/instrumentation.ts` on server startup, never from a user-triggered
 * Server Action. Deliberately not an always-running in-process timer or a
 * delegation to the host OS scheduler — see the spec's own reasoning for
 * why a launch-time check is the only mechanism an offline, not-always-open
 * desktop app can honestly promise "daily" from.
 *
 * `triggeredByUserId: null` — this run has no human actor; `SCHEDULED` is
 * its own trigger value precisely so the history screen can tell an
 * automatic run from one an admin explicitly asked for.
 */
export async function ensureDailyBackup(): Promise<void> {
  const existing = await backupJobRepository.findLatestSucceededBackupSince(startOfDay(new Date()));
  if (existing) {
    return;
  }

  const job = await backupService.runBackup("SCHEDULED", null);
  if (job.status !== "SUCCEEDED") {
    logger.error({ jobId: job.id, error: job.errorMessage }, "Scheduled daily backup failed");
  }
}
