# 102 - Backup Verification & Automated Restore Testing

> Feature-spec file number 102 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 3 — Architecture
> Hardening**, tracker item **#93 Backup Verification**.
>
> Depends On: Backup & Restore (v2 spec 81).

## Goal

Add an automated restore-and-verify script that runs after every backup completes,
confirms the backup file can actually be restored, and alerts the user if verification
fails. A backup that cannot be restored is worse than no backup — this feature removes
the silent failure risk.

---

## Project Context

Read before implementation:

1. `context/feature-specs/81-backup-restore.md` — Backup & Restore spec; this spec
   extends the backup completion flow.
2. `context/architecture-context.md` (v2) — "Daily Automatic Backup" under Security Model.

---

## Module Responsibilities

- Backup verification script (`scripts/verify-backup.ts`) — restores the latest backup
  into a temporary schema and runs integrity checks
- Electron IPC `backup:verify` — triggers the script from the desktop app
- Verification result persisted in a `BackupVerificationLog` table
- Notification to the user if verification fails (Electron tray notification or in-app toast)
- Automated scheduling: verification runs automatically 1 hour after every successful backup

---

## Data Model

```prisma
model BackupVerificationLog {
  id           String   @id @default(uuid())
  companyId    String
  backupFile   String   // path to the backup file verified
  verifiedAt   DateTime @default(now())
  success      Boolean
  errorMessage String?
  durationMs   Int

  company Company @relation(...)
}
```

---

## Verification Algorithm

```
1. Find the latest backup file for the company.
2. Create a temporary PostgreSQL schema: "backup_verify_<timestamp>"
3. Restore the backup into the temporary schema using pg_restore.
4. Run integrity checks:
   a. COUNT(*) on 5 critical tables (Voucher, SalesInvoice, Product, Customer, StockTransaction)
   b. Verify row counts are > 0 if the company has any data.
5. Drop the temporary schema.
6. Record the result in BackupVerificationLog.
7. If failed: send notification via Electron tray + in-app alert.
```

---

## Business Rules

1. Verification runs in a temporary schema — it never touches the live company data.
2. The temporary schema is always dropped after verification, success or failure.
3. If the temporary schema cannot be created (e.g., disk full), verification is marked
   failed and the error is logged.
4. Verification is non-blocking — the backup file is not deleted if verification fails
   (the failed backup may still be partially restorable by a DBA).
5. The last 30 verification results are retained; older records are pruned.

---

## UI

### Backup Settings Page Amendment
- "Last verification" badge: ✅ Verified 2h ago / ⚠️ Verification failed
- "Verify Now" button — triggers immediate verification
- Link to verification log: shows last 10 results with timestamps and status

### Notification
- Electron tray notification on verification failure: "Backup verification failed —
  your last backup may not be restorable. Click to view details."

---

## Testing Requirements

- Successful verification: creates temp schema, runs checks, drops schema, returns true
- Failed verification: corrupt backup file → returns false, logs error message
- Temp schema cleanup: schema is dropped even when verification throws
- Row count check: backup with empty critical tables fails verification
