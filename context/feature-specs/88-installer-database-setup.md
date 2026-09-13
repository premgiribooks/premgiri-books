# 88 - Installer Database Setup & Conditional Seeding

> Feature-spec file number 88 (sequential, never reused). Not tied to a numbered Phase —
> installer/build infrastructure, not an ERP business module, same precedent as spec 01
> (Electron setup) and the undocumented-by-number Desktop Packaging & Auto-Update work in
> `context/Phases/phase-tracker.md`. Closes the known limitation recorded in that section
> and in `progress-tracker.md`'s v1.0.4/v1.0.5 entries: *"runtime config (`DATABASE_URL`
> etc.) must be a real OS environment variable on the end-user machine, no first-run
> config screen yet."*

## Goal

Give every machine that builds or installs this application (a developer's machine, a
release/CI runner preparing a build, or an operator setting up a new install) a single,
repeatable script that:

1. Resolves the `DATABASE_URL` to use (from the local `.env`, an existing OS environment
   variable, or an interactive prompt — see Resolution Order) and persists it as a
   **Windows user environment variable** (`HKCU\Environment`, via `setx`), so the packaged
   Electron app (which has no `.env` file — `scripts/prepare-standalone.mjs` already strips
   it, and `package.json`'s `extraResources` filter excludes it) can read
   `process.env.DATABASE_URL` without any manual `setx`/System Properties step.
2. Applies any pending Prisma migrations (`prisma migrate deploy`) against that database.
3. Runs the existing, already-idempotent `prisma/seed.ts` (`prisma db seed`), which
   bootstraps the Super Admin (`superadmin`) and the first Company Admin (`admin`) **only
   if a database is new** — an existing database with a `PLATFORM` user and an `admin`
   user already present is left untouched (`prisma/seed.ts` lines 44-84, unchanged by this
   spec).

This spec does **not** change `prisma/seed.ts`'s bootstrap logic — that idempotency and
the `admin`/`superadmin` credential scheme already exist exactly as documented in
`progress-tracker.md`'s Login Credentials section. This spec's job is to make sure the
environment variable and migration/seed steps actually run, on the right machine, instead
of being manual steps an operator has to remember.

---

# Project Context

Before implementation, review

- `progress-tracker.md`'s Environment Variables table (`DATABASE_URL`,
  `SEED_ADMIN_PASSWORD`, `SEED_SUPER_ADMIN_PASSWORD`) and Login Credentials section (the
  exact `admin`/`superadmin` bootstrap contract this spec must not duplicate or diverge
  from)
- `prisma/seed.ts` and `prisma.config.ts` (`migrations.seed: "tsx prisma/seed.ts"` — this
  is what `prisma db seed` already runs)
- `scripts/prepare-standalone.mjs` and `package.json`'s `build.extraResources` filter
  (`"!.env"`, `"!.env.*"`) — confirms why the packaged app has no `.env` and must get
  `DATABASE_URL` from a real OS environment variable
- The v1.0.4/v1.0.5 entries in `progress-tracker.md` — the exact manual step
  (`setx DATABASE_URL ...` done by hand, then a manual `pnpm prisma db seed`) this spec
  replaces with one script

---

# Module Responsibilities

This feature is responsible for

- Resolving and persisting `DATABASE_URL` as a Windows user environment variable
- Running `prisma migrate deploy` (never `migrate dev` — this is an operational/install
  step, not a development workflow that should prompt for new migration names)
- Invoking `prisma db seed` (which already contains 100% of the "is this database new"
  decision — see Goal)
- Never printing the raw connection string (which embeds a username/password) to the
  console or to any log file

This feature is **not** responsible for

- Changing `prisma/seed.ts`'s bootstrap logic, default passwords, or production-password
  enforcement (`SEED_ADMIN_PASSWORD`/`SEED_SUPER_ADMIN_PASSWORD` — unchanged)
- A first-run in-app configuration screen (a GUI wizard inside the Electron app itself is
  a separate, larger feature — out of scope here; this spec is the scriptable/operator-run
  path)
- Configuring a *system-level* (`HKLM`) environment variable, or requesting elevation —
  the user explicitly asked for a **user** environment variable, and `setx` (without `/M`)
  writes `HKCU\Environment`, requiring no admin rights
- macOS/Linux persistence mechanisms beyond a printed instruction (this codebase's
  desktop target and this session's environment are Windows-first — see `build.win`/
  `build.mac`/`build.linux` in `package.json`; a non-Windows contributor gets a clear
  "add this to your shell profile" message instead of a silent no-op)

---

# Resolution Order (where `DATABASE_URL` comes from)

1. An already-set `process.env.DATABASE_URL` in the shell the script is invoked from.
2. Otherwise, the `DATABASE_URL` line in the project's local `.env` (via `dotenv`, already
   a dependency) — this is "the latest database URL" for a developer/build machine that
   already has one configured for local work.
3. Otherwise, an interactive prompt (stdin) asking for the connection string. Never a
   hardcoded default — this project's `.env` is git-ignored precisely because
   `DATABASE_URL` carries live credentials (`security.md`: "NEVER hardcode secrets in
   source code"), so no committed script may embed one.

The resolved value is validated (must parse as a `postgres://`/`postgresql://` URL) before
being persisted or used, failing fast with a clear message otherwise
(`code-standards.md`'s Input Validation rule).

---

# Mechanism

`scripts/setup-database.mjs` (Node, run via `pnpm setup:db`):

```text
1. Resolve DATABASE_URL (see Resolution Order above).
2. If running on win32: persist it via `setx DATABASE_URL "<value>"` (HKCU\Environment —
   user-level, no elevation). Also set it on `process.env` for the remainder of this
   script's own process, since `setx` only affects *future* shells/processes, not the
   current one.
   If not win32: print the resolved variable name (never the value) and an instruction to
   export it from the shell profile / launch environment instead.
3. Spawn `npx prisma migrate deploy` (child_process, inherited stdio, env includes the
   resolved DATABASE_URL) — applies any migrations not yet recorded in
   `_prisma_migrations` for this database; a no-op, zero-exit-code success if the schema is
   already current.
4. Spawn `npx prisma db seed` the same way — delegates entirely to the existing
   `prisma/seed.ts` idempotency (Goal, item 3).
5. Exit non-zero and stop immediately if either step 3 or step 4 fails — never silently
   continue past a failed migration or seed.
```

Both child-process calls use `execFileSync` with an argument array (never a
shell-interpolated string), matching this codebase's existing shell-out convention (spec
81, Backup & Restore, Code Standards section) to avoid any injection risk from the
resolved connection string.

**Never logged**: the full `DATABASE_URL` value. Where the script needs to confirm which
database it targeted, it logs only the parsed host/port/database name (credentials
stripped), matching `code-standards.md`'s Logging rule ("Do not log … Personal Secrets").

---

# Wiring

- `package.json` gains one script: `"setup:db": "node scripts/setup-database.mjs"`.
- Deliberately **not** wired into `build`, `dist`, or `predist` — running a migration/seed
  against whatever database happens to be configured on every `pnpm build` (including a
  plain CI typecheck/build run, per `.github/workflows/build.yml`) would be a surprising,
  potentially destructive side effect of a command whose name promises only "build the
  app." `pnpm setup:db` is an explicit, separate, operator-run step — documented as the
  first step of the install/release runbook, run once per machine (or again, harmlessly,
  after a schema update — both `migrate deploy` and `prisma db seed` are idempotent).
- `.env.example` gains the previously-undocumented `SEED_SUPER_ADMIN_PASSWORD` variable
  (already consumed by `prisma/seed.ts`, already documented in `progress-tracker.md`'s
  Environment Variables table, but missing from `.env.example` itself — a pre-existing
  documentation gap fixed alongside this spec since it's directly in scope for "seed the
  database").

---

# Security

- The resolved connection string is never printed, committed, or logged in full — see
  Mechanism.
- No new permission module, no application-level (RBAC) surface — this is a local,
  operator-run script outside the running application, executed with whatever OS-user
  privileges already run `pnpm` commands on that machine.
- `execFileSync` with argument arrays only, never a shell string built by concatenation —
  `security.md`'s injection-prevention posture, same as spec 81.

---

# Do Not

Do not implement

- Any change to `prisma/seed.ts`'s bootstrap contract, default passwords, or
  production-password enforcement
- A GUI/first-run wizard inside the Electron app (separate, future scope)
- Auto-invocation of `setup:db` from `build`/`dist`/CI
- Persisting to `HKLM` (system-wide) or requesting elevated privileges
- Printing the resolved `DATABASE_URL` (or any substring containing its credentials) to
  the console or a log file

---

# Success Criteria

Verify

- Running `pnpm setup:db` with `DATABASE_URL` already present in `.env` persists it as a
  Windows user environment variable (`setx` exit code 0) without prompting, and without
  printing the credential portion of the connection string.
- Running `pnpm setup:db` with no `DATABASE_URL` anywhere prompts interactively and
  rejects an empty/malformed value with a clear error before attempting to persist or use
  it.
- Against a brand-new database: `pnpm setup:db` applies all migrations and creates both
  the `superadmin` and `admin` bootstrap users (per `prisma/seed.ts`'s existing behavior).
- Re-running `pnpm setup:db` against that same, now-seeded database applies zero new
  migrations, creates no duplicate users, and exits 0 — matching the existing
  `prisma/seed.ts` idempotency logs ("already exists — skipping bootstrap").
- A failed migration or seed step stops the script with a non-zero exit code and a clear
  error, never a silent partial success.
- `npx tsc --noEmit`, `npx eslint scripts`, and `next build` all remain green.
