import { logger } from "@/lib/logger";
import { getSafeErrorMessage } from "@/lib/redact-error";

/**
 * Next.js's `register()` runs once when a new server instance starts —
 * identically in `next dev` and in the packaged Electron app's spawned
 * `.next/standalone/server.js` (both are "a new Next.js server instance").
 * This is 81-backup-restore.md's decided "launch-time catch-up check"
 * mechanism for "Daily Automatic Backup" — see backup-scheduler.ts's own
 * reasoning for why this, and not an in-process timer or the host OS's
 * scheduler.
 *
 * Deliberately not awaited here: `register()` must complete before the
 * server accepts requests, and a full `pg_dump` should not delay every
 * request on the one day it runs. Any failure is caught and logged —
 * ensureDailyBackup() itself already records the attempt as its own
 * FAILED `BackupJob` row; this catch only guards against something going
 * wrong before that (e.g. the database being briefly unreachable at
 * startup).
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  void import("@/modules/backup/services/backup-scheduler")
    .then(({ ensureDailyBackup }) => ensureDailyBackup())
    .catch((error: unknown) => {
      // Never `err: error` — a Prisma connection-validation error can echo
      // a raw connection string back in `.message`, and this catch is
      // reachable before backup-service.ts's own internal try/catch (e.g.
      // `backupJobRepository.create`/`findLatestSucceededBackupSince`
      // failing outright). Same redaction requirement as backup-service.ts.
      logger.error({ error: getSafeErrorMessage(error) }, "Daily backup catch-up check failed at startup");
    });
}
