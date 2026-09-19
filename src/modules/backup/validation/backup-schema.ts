import { z } from "zod";

/**
 * The "type this to confirm" phrase for Restore's confirmation dialog
 * (81-backup-restore.md's Business Rules — a plain "Are you sure?" is not
 * enough for an irreversible, whole-installation operation). A fixed,
 * server-known literal rather than "the installation's own name" — this app
 * has no single "installation name" concept (one installation's shared
 * database can hold several Company rows), so a fixed unambiguous phrase is
 * the equivalent, unambiguous alternative the spec itself allows for.
 */
export const RESTORE_CONFIRMATION_PHRASE = "RESTORE DATABASE";

export const restoreSchema = z.object({
  backupJobId: z.string().uuid(),
  // z.literal, not z.string() + a service-side comparison, so a mismatched
  // phrase is rejected by validation itself — the server independently
  // re-verifies this regardless of whether the client's own button was
  // enabled.
  confirmationText: z.literal(
    RESTORE_CONFIRMATION_PHRASE,
    `You must type "${RESTORE_CONFIRMATION_PHRASE}" exactly to confirm.`
  ),
});

export type RestoreInput = z.infer<typeof restoreSchema>;
