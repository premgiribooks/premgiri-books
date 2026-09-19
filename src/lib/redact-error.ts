/**
 * A spawn/exec failure's connection-string argument leaks into more than
 * just `.message` — Node attaches the full command line to `cmd`/
 * `spawnargs` on the Error object itself, which a naive `logger.error({
 * err: error }, ...)` would serialize wholesale, embedding a database
 * connection string's credentials into the log stream (this is a real,
 * previously-shipped leak in 81-backup-restore.md's `pg_dump`/`pg_restore`
 * shell-outs — see `backup-service.ts`). This redacts any Postgres
 * connection string (not one exact known value, as defense-in-depth
 * against a differently-formatted string reaching here) out of any text
 * before it is logged or persisted anywhere a Super Admin later reads it
 * on-screen (e.g. `BackupJob.errorMessage`).
 *
 * Lives in `@/lib` (shared infrastructure, like `logger.ts`) rather than
 * inside the backup module, specifically so `src/instrumentation.ts` — a
 * generic startup hook, not a backup-module file — can reuse it without an
 * inverted dependency on a feature module.
 */
const POSTGRES_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s"')]+/gi;

export function redactConnectionStrings(message: string): string {
  return message.replace(POSTGRES_URL_PATTERN, "[REDACTED_DATABASE_URL]");
}

/** Extracts a safe-to-log/persist message from an unknown thrown value — never the raw Error object. */
export function getSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "An unknown error occurred.";
  return redactConnectionStrings(message);
}
