/**
 * The shape sent from the main process to the renderer over the
 * "updater:status" channel. Mirrored (not imported) in
 * src/types/electron.d.ts, since electron/ and src/ compile as separate
 * TypeScript projects (tsconfig.electron.json's rootDir excludes src) — keep
 * both definitions in sync when this shape changes.
 */
export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };
