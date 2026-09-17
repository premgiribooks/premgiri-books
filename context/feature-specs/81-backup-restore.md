# 81 - Backup & Restore

> Feature-spec file number 81 (sequential, never reused). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 11 — Productivity Features** item **#79
> Backup & Restore**, `Depends On: Database`. Turns `architecture-context.md`'s already-
> named "Daily Automatic Backup" (Security Model section) and "Backup Files" (Local File
> Storage category) from documentation into a real design. **This is the one spec in this
> whole initiative most likely to require genuinely new infrastructure/dependencies
> beyond the existing Next.js/Prisma stack — that is called out explicitly below, not
> hand-waved as "just a script."**

## Goal

Implement whole-database **Backup** (on demand and on a daily-automatic schedule) and
**Restore** for Premgiri Books ERP's local PostgreSQL database, stored to a configurable
local directory, entirely offline. Introduces a new `BackupJob` Prisma model to track
backup/restore history (the one genuinely new piece of persisted state this spec needs —
see Data Model for why this, unlike specs 52–55, *does* warrant a new table) and a new
service that shells out to the PostgreSQL client tools (`pg_dump`/`pg_restore`) already
required to be present wherever this application's own local Postgres server runs.

---

# Company-vs-Platform Disambiguation (resolved) — and why this one differs from Audit Logs

`src/constants/breadcrumbs.ts` already reserves `backup → "Backup"`, and
`src/app/administration/backup/page.tsx` **already exists** — read in full for this spec:

```tsx
export default async function BackupPage() {
  await requireSuperAdmin();
  return (
    <PlatformShell>
      <ComingSoon title="Backup & Restore" description="Backup and restore tooling is not implemented yet." />
    </PlatformShell>
  );
}
```

Feature-spec 80 (Audit Logs, drafted alongside this one) concluded that Audit Logs is a
**different**, Company-scoped feature from the Administration tree's reserved `audit` key,
because an audit trail is naturally per-company data. **Backup & Restore reaches the
opposite conclusion, for a technical reason specific to this feature**:

- This application uses **one shared local PostgreSQL database for the entire
  installation** — every tenant-scoped table (`Company`, `Product`, `Voucher`, …) carries
  a `companyId` column (the Tenant Isolation Rule), but there is **no per-company database
  or schema**. A Super Admin on a given installation can create multiple `Company` rows in
  that same one database (`architecture-Migration-Super-Admin-Administration.md`).
- `pg_dump`/`pg_restore` (see Mechanism below) operate on **an entire database**, not a
  filtered slice of it. A full database backup or restore on this architecture
  **necessarily covers every company on the installation at once** — there is no clean
  way to `pg_dump` "just one company's rows" without a bespoke per-table, per-`companyId`
  selective-export mechanism this spec does not build (and which would itself risk
  producing an inconsistent, non-restorable partial dump of a relationally-linked
  database).
- Therefore **Backup & Restore's true blast radius is the whole installation, not one
  company** — restoring is a Super-Admin-level, installation-wide operation by its very
  nature, exactly matching the tracker's `Depends On: Database` (not `Depends On:
  Company`), and exactly matching `/administration/backup`'s existing
  `requireSuperAdmin()`/`PlatformShell` gate.

**Conclusion: this spec *is* the feature `/administration/backup`'s existing stub
anticipates.** No new `/settings/backup` route is introduced (unlike Audit Logs' new
`/settings/audit-logs`) — this spec replaces `src/app/administration/backup/page.tsx`'s
`ComingSoon` body with the real screen, at the same route, under the same gate. The
`backup` breadcrumb key is reused as-is; no new breadcrumb key is needed.

**A named, deliberate v1 gap**: a Company Admin has no dedicated backup/restore screen of
their own in this spec. Most real installs of this offline, per-business desktop app will
have exactly one `Company` under one Super Admin anyway, so in practice the Super Admin
persona (which every installation already has, per the User Hierarchy — even a
single-business owner operates it, distinctly from their day-to-day Company Admin login)
is the natural owner of a whole-database operation. A future, smaller follow-up could add
a **read-only** "last backup status" indicator to the Company-side Settings hub without
conflicting with this design; not built now.

---

# Project Context

Before implementation, review

- `architecture-context.md`'s Technology Stack (`Database: PostgreSQL (Local)`,
  `File Storage: Local File System`), Security Model ("Daily Automatic Backup"), Local
  File Storage list ("Backup Files"), and Offline Strategy ("No internet connection is
  required for … Backup")
- `architecture-Migration-Super-Admin-Administration.md` and `src/lib/current-user.ts`'s
  `assertSuperAdmin()`/`requireSuperAdmin()` (the exact gate this spec's screen reuses,
  unchanged)
- `src/app/administration/backup/page.tsx`, `src/app/administration/page.tsx` (the
  Administration hub this screen's card lives on), and `src/components/layout/
  platform-shell.tsx` (the shell every Administration page — including this one — renders
  inside)
- `code-standards.md`'s Database Standards ("PostgreSQL is the single source of truth",
  "Never permanently delete financial data") and Offline-First Rules — this spec's design
  must not introduce any cloud dependency (Cloud Backup is explicitly listed under
  `architecture-context.md`'s Future Online Services — **out of scope**, not this spec)

---

# Module Responsibilities

The Backup & Restore feature is responsible for

- On-demand ("Backup Now") and daily-automatic whole-database backups to a configurable
  local directory
- A Restore workflow with an enforced pre-restore safety backup and an explicit,
  unambiguous confirmation step
- A history screen (Backup/Restore jobs, status, size, timestamp, triggered-by) under
  `/administration/backup`
- The launch-time "is a backup due today" scheduling check (see Scheduling Mechanism)

The Backup & Restore feature is **not** responsible for

- Cloud/off-site backup storage of any kind (`architecture-context.md`'s Future Online
  Services — explicitly deferred)
- Per-company selective backup/restore (see Disambiguation above — technically not
  meaningful on a shared single database without a bespoke export mechanism this spec
  does not build)
- Audit-logging its own operations into the `AuditLog` model this spec's sibling
  (feature-spec 80, Audit Logs) retrofits — Audit Logs' v1 scope is financial-transaction
  events only (voucher post/cancel); Backup/Restore events are a natural, **named** future
  addition to the Administration side's own 5-event `AuditLog` usage (a 6th/7th event:
  "Backup Created" / "Database Restored") but are not added by either this spec or spec 80
  — Pino logging (below) is this spec's own, sufficient v1 record
- Bundling, downloading, or installing the `pg_dump`/`pg_restore` binaries themselves (see
  Mechanism — this spec locates and shells out to them, it does not ship them)

---

# Mechanism Decision: shell out to `pg_dump`/`pg_restore`

**Decision: back up via `pg_dump` (custom/compressed format, `-Fc`) and restore via
`pg_restore`, invoked as child processes (Node's built-in `child_process.execFile`) from
the same Next.js server-side process every other Server Action already runs in** — not a
Prisma-level row-by-row export/import.

Reasoning:

- Postgres is explicitly named the single source of truth (`code-standards.md`:
  "PostgreSQL is the single source of truth"). `pg_dump`/`pg_restore` are Postgres's own,
  battle-tested, schema-and-data-consistent backup tools — a hand-rolled Prisma-level
  export (walking every model, serializing every row) would have to independently solve
  referential-integrity ordering, enum/type fidelity, and transactional consistency across
  ~60+ tables that `pg_dump` already solves correctly, violating this codebase's
  YAGNI/DRY posture (`coding-style.md`) by reinventing a tool that already exists and is
  already a hard dependency of this stack (every install already runs a local PostgreSQL
  server to run the app at all — per `architecture-context.md`'s Technology Stack; the
  matching client tools are the standard companion to that same server installation).
- A `pg_dump`/`pg_restore` shell-out runs entirely on the local machine against the local
  Postgres instance — no network call, satisfying the Offline-First Rules
  (`ai-workflow-rules.md`: "AI must never introduce dependencies that require internet
  connectivity for … Sales … Accounting … Reports"; backup is explicitly listed under
  Offline Strategy's "No internet connection is required for … Backup").
- Next.js Server Actions in this project already execute in a trusted local Node.js
  process (not a browser sandbox) — shelling out from a Service function there needs no
  separate Electron-main-process IPC bridge; it is the same execution context every other
  Service already runs in.

**Explicit new infrastructure/dependency, called out per this spec's own header note**:
`pg_dump`/`pg_restore` are **not** an npm package — they are native binaries that ship
with a PostgreSQL server or client-tools installation. This spec's service locates them
via an environment-configured path (`PG_DUMP_PATH`/`PG_RESTORE_PATH`, defaulting to
relying on the process `PATH`, consistent with `DATABASE_URL` already being an
environment-level, install-time configuration rather than a UI-editable setting) — **not**
a `CompanySettings` field, since this is an installation-wide concern, not a per-company
one (consistent with the Disambiguation above). The exact packaging story (does the
Electron installer bundle matching-version binaries, or does it require the same
PostgreSQL installer the app's own Postgres server already came from to also provide its
client tools on `PATH`) is an **implementation-time decision for whoever builds this
spec**, not resolved here — recorded as an open point in Do Not/Success Criteria rather
than assumed away. A version mismatch between the installed Postgres **server** and the
`pg_dump`/`pg_restore` **client** binaries is a known, real-world failure mode this spec
does not attempt to auto-detect or resolve; it is a deployment-time concern.

---

# Data Model

**One new Prisma model — deliberately, unlike specs 52–55's "no new model" precedent** —
because there is genuinely new state to persist that no existing model can hold: a
history of backup/restore attempts, their status, and their file location. A single model
with a `jobType` discriminator is used instead of two near-identical `BackupJob`/
`RestoreJob` tables (`coding-style.md`'s DRY principle):

```text
enum BackupJobType {
  BACKUP
  RESTORE
}

enum BackupJobStatus {
  PENDING
  RUNNING
  SUCCEEDED
  FAILED
}

enum BackupJobTrigger {
  MANUAL
  SCHEDULED
  PRE_RESTORE_SAFETY
}

model BackupJob {
  id                String           @id @default(uuid())
  jobType           BackupJobType
  status            BackupJobStatus  @default(PENDING)
  trigger           BackupJobTrigger
  filePath          String?
  fileSizeBytes     BigInt?
  startedAt         DateTime         @default(now())
  completedAt       DateTime?
  errorMessage      String?
  triggeredByUserId String?
  triggeredBy       User?            @relation(fields: [triggeredByUserId], references: [id])
  restoredFromJobId String?
  restoredFromJob   BackupJob?       @relation("RestoreSource", fields: [restoredFromJobId], references: [id])
  restoreAttempts   BackupJob[]      @relation("RestoreSource")

  @@index([jobType, status])
  @@index([startedAt])
}
```

Decisions

- **Deliberately no `companyId` column** — per the Disambiguation above, a `BackupJob`
  describes an operation over the entire shared installation-wide database, not one
  company's slice of it. This is an intentional, explained deviation from "every business
  table carries `companyId`" (Tenant Isolation Rule) — that rule governs *business data*
  queries; `BackupJob` is Platform/installation-level metadata, the same posture
  `AuditLog.companyId` already takes as *optional* for its own Super-Admin-side events.
- `trigger: PRE_RESTORE_SAFETY` is its own enum value (not reused `MANUAL`) so the browse
  screen can visually distinguish an automatic safety backup the system took for you from
  one you explicitly asked for — both are still real, restorable backups.
- `restoredFromJobId` links a `RESTORE`-type job back to the `BACKUP`-type job whose file
  it restored, so the history screen can show "Restored from: <backup, timestamp>" rather
  than only a bare file path.
- `fileSizeBytes` is `BigInt` — a full database dump can exceed the 32-bit range Postgres's
  plain `Int` would allow.
- No `companyId`-scoped uniqueness or index is needed for the reason above; `@@index
  ([startedAt])` supports the history screen's default newest-first ordering, and
  `@@index([jobType, status])` supports "show me the most recent successful backup"
  (the scheduling check's own query — see below).

One new migration. No change to any other existing table.

---

# Business Rules

## Backup

- A backup runs `pg_dump -Fc` (custom format — required for `pg_restore`'s selective/
  parallel restore capability, and for the compression a plain SQL dump lacks) against
  the connection info already available from this app's own `DATABASE_URL`, writing to a
  file under the configured local backup directory, named with a timestamp (e.g.
  `premgiri-books-backup-2026-09-11T140500Z.dump`).
- A `BackupJob` row is created `PENDING` before the child process starts, flipped to
  `RUNNING` once it starts, and `SUCCEEDED`/`FAILED` (with `errorMessage` on failure) when
  it exits — every attempt is recorded, including failed ones, so a silent nightly failure
  is visible on the history screen rather than invisibly skipped.
- The configured backup directory (a local path — **not** cloud storage, per Local File
  Storage's "Backup Files" category and per Cloud Backup being explicitly out of scope) is
  an environment-level setting (see Mechanism), defaulting to a sensible per-OS
  application-data location if unset. It must exist and be writable before a backup
  attempt starts; a missing/unwritable directory fails the job with a clear
  `errorMessage`, never a silent no-op.

## Restore (destructive — the highest-risk operation in this spec)

- **Restore is Super-Admin-only**, gated identically to this spec's own screen
  (`requireSuperAdmin()`) — no Company Admin path exists to trigger a restore, matching
  the Disambiguation above.
- **Mandatory pre-restore safety backup**: before any restore proceeds, the service
  automatically runs a full backup of the **current** (about-to-be-overwritten) database
  state, recorded as its own `BackupJob` with `trigger: PRE_RESTORE_SAFETY`. If that
  safety backup itself fails, the restore is **aborted before it touches the live
  database** — a restore never proceeds without a fresh, successful safety net, since
  restoring is irreversible without one.
- **Explicit confirmation**: the UI requires the Super Admin to type the installation's
  own name (or an equivalent unambiguous confirmation phrase) before the restore button
  activates — a plain "Are you sure?" dialog is not enough for an operation this
  destructive (mirrors how this codebase already treats posted-voucher cancellation as a
  deliberate, explicit action, one step further since this one is irreversible without a
  prior backup).
- **Maintenance-mode requirement**: `pg_restore` against a database with active
  connections cannot cleanly drop/recreate objects. While a restore is running, the
  application must refuse new business-data mutations — the simplest correct
  implementation is a blocking, full-screen "Restoring — do not close the application"
  state that halts normal navigation until the restore's `BackupJob` reaches a terminal
  status, after which the app prompts for (or forces) a full reload so Prisma's own
  connection pool reconnects against the freshly-restored schema/data rather than holding
  stale cached connections. The exact mechanism for suspending the Prisma connection pool
  during the restore window (e.g., closing and recreating the `PrismaClient` instance
  around the `pg_restore` call) is an implementation-time detail, but the requirement —
  no concurrent business-data writes may reach the database mid-restore — is not optional.
- A restore replaces the **entire** database — every company on the installation reverts
  to the backup's point in time together (see Disambiguation); there is no partial/
  per-company restore.

## Scheduling ("Daily Automatic Backup")

**Decision: a launch-time "is today's backup already done?" catch-up check, run once each
time the application starts — not a continuously-running in-app scheduler, and not
delegation to the host OS's own task scheduler (Windows Task Scheduler / cron / launchd).**
Reasoning:

- Relying on the **OS's own scheduler** would require per-machine, per-OS setup outside
  this application's own installer (a different mechanism on Windows vs. macOS vs. Linux,
  each needing its own privilege/registration step) — this contradicts the Offline-First/
  self-contained posture of a distributable desktop app that should not depend on an
  administrator manually configuring an external OS feature just to get its own
  documented "Daily Automatic Backup" to actually run.
- Relying on an **always-running in-process daemon** (a `setInterval` waiting for
  midnight) assumes the application is continuously open, which is not a safe assumption
  for a small business's desktop ERP that is typically only running during business
  hours, if at all outside them — a timer waiting for a specific clock time that never
  arrives while the app is closed would simply never fire "daily," silently failing the
  feature's own name.
- A **launch-time catch-up check** (on `app.whenReady()`/the first authenticated request
  of a session — implementation's choice of exact hook, but conceptually "the next time
  the app is opened") queries `BackupJob` for the most recent `SUCCEEDED` `BACKUP`-type job
  and, if none exists for the current calendar day, triggers one automatically
  (`trigger: SCHEDULED`) before or alongside normal app usage resuming. This guarantees a
  backup runs at least once on any day the application is actually used — the only
  guarantee an offline, not-always-running desktop app can honestly make — rather than
  promising an exact time-of-day the app cannot always keep.
- This is a deliberate reinterpretation of "Daily Automatic" as "automatically, at least
  once per day of actual use," recorded here explicitly rather than silently redefining
  the architecture doc's phrase.

---

# Service / Repository

Create

```text
src/modules/backup/repositories/backup-job-repository.ts
src/modules/backup/services/backup-service.ts        // runBackup, runRestore — pg_dump/pg_restore orchestration
src/modules/backup/services/backup-scheduler.ts       // launch-time due-check (see Scheduling)
src/modules/backup/validation/backup-schema.ts
src/modules/backup/actions/backup-actions.ts
src/modules/backup/components/…
```

- `backupService.runBackup(trigger)`: creates the `PENDING` `BackupJob`, spawns
  `pg_dump -Fc`, updates the row through `RUNNING` → `SUCCEEDED`/`FAILED`, records
  `filePath`/`fileSizeBytes` on success.
- `backupService.runRestore(backupJobId, confirmingUserId)`: Super-Admin-only (asserted at
  the Server Action layer, re-asserted here defensively), runs the mandatory
  `PRE_RESTORE_SAFETY` backup first (aborting on its failure), then spawns
  `pg_restore --clean` against the selected backup's file, records a `RESTORE`-type
  `BackupJob` linked via `restoredFromJobId`.
- `backupJobRepository.list(filters)`, `getBackupJob(id)` — for the history screen.
- `backup-scheduler.ts`'s `ensureDailyBackup()`: the launch-time check described above,
  called once during app/server startup (not from a Server Action a user triggers) —
  queries for the latest `SUCCEEDED` `BACKUP` job and calls `backupService.runBackup
  ("SCHEDULED")` only if none exists for the current calendar day.
- No repository/service in this module ever touches business-domain tables directly
  (`Company`, `Voucher`, `Product`, …) — it only ever shells out to `pg_dump`/`pg_restore`
  against the whole database and manages its own `BackupJob` rows.

---

# Validation

Zod (`backup-schema.ts`): restore input requires `backupJobId` (uuid, must reference a
`SUCCEEDED` `BACKUP`-type job) and a `confirmationText` field that must exactly match the
server-computed expected confirmation phrase (re-verified server-side — never trust a
client-side "the button was enabled" signal alone for a destructive action).

---

# UI

Pages (replacing the existing stub, same route, same gate)

- `/administration/backup` — replaces `ComingSoon` with: current backup-directory path
  (read-only display; environment-configured, not editable here — see Mechanism), a
  "Backup Now" button, a history table (Type, Trigger, Status, Started/Completed, Size,
  Triggered By, and — for restores — "Restored From"), and a "Restore" action per
  `SUCCEEDED` `BACKUP`-type row that opens the confirmation-phrase dialog described in
  Business Rules.
- A blocking, full-screen "Restoring — do not close the application" state (rendered
  while any `BackupJob` of type `RESTORE` is `RUNNING`), per the Restore maintenance-mode
  requirement above.

Wire-up

- No new breadcrumb key — the existing `backup: "Backup"` entry already covers this route
  (see Disambiguation).
- The `/administration` hub page's existing card linking to `/administration/backup`
  (if any) needs no change beyond its description text no longer saying "not implemented."

---

# Security

**No new permission module.** Gated identically to every other Administration screen:
`requireSuperAdmin()` (`src/lib/current-user.ts`) — the single hardcoded Super-Admin
check, never `assertPermission`/`PERMISSION_MODULES` (per the User Hierarchy: Super Admin
is not a Role and is never RBAC-gated). Both "Backup Now" and "Restore" require this same
gate; there is no lesser Company-side permission tier for this feature (see
Disambiguation's named v1 gap).

---

# Database

New enums `BackupJobType`, `BackupJobStatus`, `BackupJobTrigger`; new model `BackupJob`.
One migration. No change to any existing table, no `companyId` column added to the new
model (see Data Model).

---

# Code Standards

Strict TypeScript, no `any`. Every `pg_dump`/`pg_restore` invocation uses
`child_process.execFile` (never `exec`) with an argument array (never a shell-interpolated
command string) to avoid shell-injection risk from any path/parameter — the local Postgres
connection parameters are read from `DATABASE_URL`, never rebuilt by string concatenation
from user input. Vitest coverage for:

- `backupService.runBackup`: job status transitions (`PENDING → RUNNING → SUCCEEDED`/
  `FAILED`), correct `pg_dump` argument construction (mocked child process), and
  directory-missing/unwritable rejection.
- `backupService.runRestore`: the pre-restore safety-backup-first ordering (a restore
  never spawns `pg_restore` before its own safety backup has reached `SUCCEEDED`), and
  abort-on-safety-backup-failure.
- `backup-scheduler.ts`'s `ensureDailyBackup`: triggers exactly once when no `SUCCEEDED`
  backup exists for the current calendar day, and does not trigger a second time on a
  same-day re-check.
- The confirmation-phrase server-side re-check (a client-forged "confirmed" flag without
  the matching text is rejected).
- The `requireSuperAdmin()` gate on both actions.

---

# Do Not

Do not implement

- Cloud/off-site backup storage of any kind (Future Online Services — out of scope)
- Per-company selective backup or restore (not meaningful on this shared-database
  architecture without a bespoke export mechanism this spec does not build)
- A Company-side backup/restore screen or permission module (see Disambiguation's named
  v1 gap)
- Bundling/downloading the `pg_dump`/`pg_restore` binaries themselves, or auto-detecting/
  reconciling a server/client version mismatch
- Routing Backup/Restore events through the Audit Logs feature (feature-spec 80) — Pino
  logging plus this spec's own `BackupJob` history is the v1 record; a future,
  separately-scoped addition could extend `auditLogService`'s existing 5-event
  Administration usage to include these
- A continuously-running in-process scheduler, or delegation to the host OS's own task
  scheduler — the launch-time catch-up check is the decided mechanism
- Allowing a restore to proceed without a successful pre-restore safety backup, or without
  the server-side confirmation-phrase check

---

# Success Criteria

Verify

- "Backup Now" produces a `.dump` file in the configured local directory and a matching
  `SUCCEEDED` `BackupJob` row with correct `fileSizeBytes`; a failure (e.g. missing
  directory) produces a `FAILED` row with a clear `errorMessage`, never a silent no-op.
- Launching the application with no `SUCCEEDED` backup recorded for the current calendar
  day automatically triggers one (`trigger: SCHEDULED`); launching it again the same day
  does not trigger a second one.
- Attempting a Restore always runs a `PRE_RESTORE_SAFETY` backup first; if that safety
  backup fails, the restore itself never starts.
- The Restore confirmation dialog's button stays disabled until the exact confirmation
  phrase is entered, and the server independently re-validates that phrase regardless of
  client-side state.
- While a Restore is `RUNNING`, the application shows the blocking maintenance state and
  refuses normal navigation/mutations until it reaches a terminal status.
- A user who is not the Super Admin cannot reach `/administration/backup`, cannot trigger
  a backup, and cannot trigger a restore.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/administration/backup` continues to appear in the build route table (same
  route, no longer a stub).

Feature-spec 81 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #79.

---

## v3 Compatibility Note — Spec 102 (Backup Verification)

v3 spec 102 (`context-v3/feature-specs/102-backup-verification.md`) **extends** this
spec, not replaces it. The two specs are additive:

| This spec (81) | v3 spec 102 |
|---|---|
| `pg_dump` on-demand + scheduled | Adds automated restore-and-verify step |
| `BackupJob` model | Adds `verifiedAt`, `verificationStatus` columns |
| Manual "Download" of backup files | Adds integrity hash check |
| `SUCCEEDED`/`FAILED` status | Adds `VERIFIED`/`VERIFY_FAILED` status |

**Implementation order:** This spec (81) must be implemented before v3 spec 102.
Spec 102 explicitly extends `BackupJob` and `backupService`.

---

## ⚠️ v4 Supersession Note — Per-Tenant Database Architecture

This spec assumes a **single shared PostgreSQL database** for all tenants on the
installation — `pg_dump` backs up the whole database including every company's data.

In v4, each company has its **own PostgreSQL database** (spec 123 — Per-Tenant
Database). The backup strategy must change:

**v3 → v4 migration for this feature:**
1. In v3 (this spec): `pg_dump` the single shared database — unchanged.
2. In v4 (spec 123): each company's database is backed up independently. The
   `BackupJob` model gains a nullable `companyId` (per-company backup) and the
   backup service becomes multi-tenant aware.
3. The Super Admin backup screen in v4 shows per-company backup status, not a
   single installation-wide backup.

**v3 data:** the v3 `BackupJob` table (single-database, null `companyId`) is migrated
to v4 as historical records. New backups in v4 are per-company.

**Design constraint:** the v3 `BackupJob` model should include a nullable `companyId`
field even in v3, set to `null` for the whole-database backups this spec performs, so
that the v4 migration does not require a schema change — only new values.

```prisma
// v3 BackupJob — add nullable companyId for v4-readiness:
model BackupJob {
  // existing fields...
  companyId String? // null = whole-database backup (v3); populated = per-company backup (v4)
}
```
