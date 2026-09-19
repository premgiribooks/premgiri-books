import { execFile } from "node:child_process";
import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { format } from "date-fns";

import { AppError } from "@/lib/app-error";
import { assertSuperAdmin } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getSafeErrorMessage } from "@/lib/redact-error";
import { isRestoreInProgress, setRestoreInProgress } from "@/lib/restore-lock";
import { backupJobRepository } from "@/modules/backup/repositories/backup-job-repository";
import type { BackupJobTrigger, BackupJobWithRelations } from "@/types/backup";

const execFileAsync = promisify(execFile);

/**
 * Installation-wide, environment-level configuration (never a
 * `CompanySettings` field — see the spec's Mechanism section: this is a
 * concern of the one shared database, not of any one company). Defaults
 * mirror `company-logo-service.ts`'s own `process.cwd()`-relative storage
 * convention — this codebase has no existing per-OS app-data-directory
 * helper to reuse instead.
 */
function resolveBackupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
}

function resolvePgDumpPath(): string {
  return process.env.PG_DUMP_PATH ?? "pg_dump";
}

function resolvePgRestorePath(): string {
  return process.env.PG_RESTORE_PATH ?? "pg_restore";
}

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new AppError("DATABASE_URL is not configured.");
  }
  return databaseUrl;
}

/**
 * Connects `pg_dump`/`pg_restore` via `PG*` environment variables instead
 * of passing the full `DATABASE_URL` (credentials included) as a plain
 * argv element — code review finding: a CLI argument is visible for the
 * spawned process's lifetime via the OS process list (`ps`/Process
 * Explorer/`/proc/<pid>/cmdline`), which env vars passed only to the
 * child's own environment are not. `PGDATABASE` is still passed to
 * `pg_restore` as a plain `-d <name>` argument (never the credentials) —
 * `pg_restore` requires `-d` to connect at all, but a bare database name
 * carries nothing sensitive.
 */
function buildPgEnv(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: resolveDatabaseName(databaseUrl),
  };
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode) {
    env.PGSSLMODE = sslmode;
  }
  return env;
}

/** The bare database name only — never the credentials — safe to pass to `pg_restore -d` as a plain argv element. */
function resolveDatabaseName(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
}

function buildBackupFileName(startedAt: Date): string {
  return `premgiri-books-backup-${format(startedAt, "yyyy-MM-dd'T'HHmmss'Z'")}.dump`;
}

/** Throws (never returns a FAILED job) — the directory must exist and be
 * writable before a `BackupJob` row is even worth creating in RUNNING state. */
async function ensureBackupDirWritable(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.access(dir, fsConstants.W_OK);
  } catch (error) {
    throw new AppError(
      `The backup directory "${dir}" does not exist or is not writable: ${getSafeErrorMessage(error)}`
    );
  }
}

export const backupService = {
  /** Read-only display on the history screen — see the spec's UI section. */
  getBackupDirectory(): string {
    return resolveBackupDir();
  },

  listJobs(): Promise<BackupJobWithRelations[]> {
    return backupJobRepository.findMany();
  },

  /**
   * Runs `pg_dump -Fc` against the whole database. Never throws for an
   * operational failure (missing directory, pg_dump exiting non-zero) —
   * every attempt, including failed ones, is recorded as its own
   * terminal-status `BackupJob` row (81-backup-restore.md: "a silent
   * nightly failure is visible on the history screen rather than invisibly
   * skipped"). This method itself performs no permission check (it is
   * called both from Super-Admin-gated actions and from the unattended
   * daily scheduler) — every caller gates its own access.
   */
  async runBackup(
    trigger: BackupJobTrigger,
    triggeredByUserId: string | null
  ): Promise<BackupJobWithRelations> {
    const job = await backupJobRepository.create({ jobType: "BACKUP", trigger, triggeredByUserId });

    const dir = resolveBackupDir();
    try {
      await ensureBackupDirWritable(dir);
    } catch (error) {
      const message = getSafeErrorMessage(error);
      logger.error({ jobId: job.id, error: message }, "Backup directory unavailable");
      return backupJobRepository.markFailed(job.id, message);
    }

    await backupJobRepository.markRunning(job.id);

    const filePath = path.join(dir, buildBackupFileName(job.startedAt));
    try {
      await execFileAsync(resolvePgDumpPath(), ["-Fc", "-f", filePath], {
        env: buildPgEnv(resolveDatabaseUrl()),
      });
      const stats = await fs.stat(filePath);
      return backupJobRepository.markSucceeded(job.id, {
        filePath,
        fileSizeBytes: BigInt(stats.size),
      });
    } catch (error) {
      // Deliberately never `err: error` here — a spawn/exit failure's Error
      // object carries the full pg_dump command line (`cmd`/`spawnargs`),
      // which could still embed credentials if resolveDatabaseUrl() were
      // ever passed as an argv element again; only the already-redacted
      // message string is safe to log. See getSafeErrorMessage's own comment.
      const message = getSafeErrorMessage(error);
      logger.error({ jobId: job.id, error: message }, "pg_dump failed");
      return backupJobRepository.markFailed(job.id, message);
    }
  },

  /**
   * Super-Admin-only, re-asserted here defensively (the Server Action layer
   * already gates this too). Always runs a mandatory pre-restore safety
   * backup first and aborts before touching the live database if that
   * safety backup itself fails — a restore never proceeds without a fresh,
   * successful safety net.
   */
  async runRestore(backupJobId: string, confirmingUserId: string): Promise<BackupJobWithRelations> {
    await assertSuperAdmin();

    // Re-entrancy guard: without this, two Restore requests (two tabs, two
    // admins, or a double-submit) both read `false` here and both proceed —
    // see the CRITICAL finding this fixes: setRestoreInProgress used to be
    // set only after the safety backup below completed, leaving the entire
    // safety-backup window (a full pg_dump — seconds to minutes) with no
    // guard against a second concurrent runRestore call.
    if (isRestoreInProgress()) {
      throw new AppError("A restore is already running. Please wait for it to finish before starting another.");
    }

    const backup = await backupJobRepository.findById(backupJobId);
    if (!backup || backup.jobType !== "BACKUP" || backup.status !== "SUCCEEDED" || !backup.filePath) {
      throw new AppError("Select a successfully completed backup to restore from.");
    }

    // Engaged BEFORE the safety backup starts, not after it succeeds — the
    // whole point is to hold exclusive access for the entire operation,
    // including the safety backup's own multi-second-to-minute runtime.
    setRestoreInProgress(true);
    let restoreJob: BackupJobWithRelations | undefined;
    try {
      const safetyJob = await backupService.runBackup("PRE_RESTORE_SAFETY", confirmingUserId);
      if (safetyJob.status !== "SUCCEEDED") {
        throw new AppError(
          `Restore aborted: the mandatory pre-restore safety backup failed (${safetyJob.errorMessage ?? "unknown error"}). No changes were made to the database.`
        );
      }

      restoreJob = await backupJobRepository.create({
        jobType: "RESTORE",
        trigger: "MANUAL",
        triggeredByUserId: confirmingUserId,
        restoredFromJobId: backup.id,
      });
      await backupJobRepository.markRunning(restoreJob.id);

      // pg_restore against a database with active connections cannot
      // cleanly drop/recreate objects — release this process's own pool
      // before spawning it. Prisma reconnects lazily on the next query
      // (markSucceeded/markFailed below), once pg_restore has finished.
      const databaseUrl = resolveDatabaseUrl();
      await prisma.$disconnect();
      await execFileAsync(
        resolvePgRestorePath(),
        ["--clean", "--if-exists", "-d", resolveDatabaseName(databaseUrl), backup.filePath],
        { env: buildPgEnv(databaseUrl) }
      );
      return await backupJobRepository.markSucceeded(restoreJob.id);
    } catch (error) {
      if (!restoreJob) {
        // Failed before a RESTORE row was ever created (e.g. the safety
        // backup itself failed) — nothing to mark FAILED, and the AppError
        // thrown above already carries the right message.
        throw error;
      }
      // Same redaction requirement as runBackup's catch above.
      const message = getSafeErrorMessage(error);
      logger.error({ jobId: restoreJob.id, error: message }, "pg_restore failed");
      return await backupJobRepository.markFailed(restoreJob.id, message);
    } finally {
      setRestoreInProgress(false);
    }
  },
};
