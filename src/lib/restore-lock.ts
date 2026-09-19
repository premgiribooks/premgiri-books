import { AppError } from "@/lib/app-error";

/**
 * Process-wide "a Restore is currently running" flag — the mechanism behind
 * 81-backup-restore.md's maintenance-mode requirement ("no concurrent
 * business-data writes may reach the database mid-restore"). Read by
 * `run-action.ts`'s shared Server Action wrapper to block every write
 * outright while a restore is running.
 *
 * `run-action.ts` is NOT the only mutation path in this codebase — a
 * security review found ~10 legacy action files (predating `runAction`'s
 * promotion; see that file's own history comment) still implement their
 * own inline try/catch instead of calling it. Those files call
 * `assertNotRestoring()` directly, at the top of each mutating action, as
 * the second enforcement point for the exact same flag.
 *
 * Lives in `@/lib`, not inside the backup module, specifically so
 * `run-action.ts` and those ~10 legacy action files — generic/unrelated
 * modules, not the backup module — can import it without an inverted
 * dependency on a feature module.
 *
 * Deliberately NOT read from `proxy.ts`: Next.js's own Proxy docs
 * explicitly warn against relying on shared modules/globals there ("Proxy
 * is meant to be invoked separately of your render code… you should not
 * attempt relying on shared modules or globals") — Proxy can run in a
 * separate execution context from the main render/action runtime even for
 * a self-hosted Node.js deployment, so a flag set in the main runtime is
 * not guaranteed visible there. `run-action.ts` has no such caveat — every
 * Server Action mutation genuinely executes in the same runtime this flag
 * is set in.
 *
 * Also deliberately NOT backed by the `BackupJob` row's own RUNNING status:
 * `pg_restore --clean` drops and recreates every object in the shared
 * database, including the `BackupJob` table itself, mid-operation — a
 * durability mechanism that lives inside the very database being wiped
 * cannot reliably answer "is a restore in progress" during the window that
 * matters most. This in-memory flag has no such circularity.
 *
 * Deliberately not persisted beyond that: if the server process itself
 * crashes mid-restore, the flag resets on next boot — the corresponding
 * `BackupJob` row stays stuck at RUNNING, which is itself the visible
 * signal (on the history screen) that something needs manual attention,
 * rather than this module trying to auto-recover a state it cannot safely
 * infer.
 */
let restoreInProgress = false;

export function isRestoreInProgress(): boolean {
  return restoreInProgress;
}

export function setRestoreInProgress(value: boolean): void {
  restoreInProgress = value;
}

/**
 * Throws a user-facing `AppError` if a restore is currently running —
 * for the legacy action files described above that don't go through
 * `run-action.ts`'s own guard. Call this as the first line inside each
 * mutating action's existing try block.
 */
export function assertNotRestoring(): void {
  if (restoreInProgress) {
    throw new AppError("A database restore is currently running. Please try again shortly.");
  }
}
