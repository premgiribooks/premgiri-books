# 89 - Offline SQLite Local Cache & Cloud Sync (Future)

> Feature-spec file number 89 (sequential, never reused). **Documentation only — per
> explicit user instruction ("create this as feature-specs"), this spec is not
> implemented by this work item.** It formalizes `architecture-context.md`'s already-named
> Future Online Services entry "Multi-System Synchronization" into a real design, the same
> way spec 81 (Backup & Restore) formalized "Daily Automatic Backup." Per
> `ai-workflow-rules.md`'s Future Modules list ("Cloud Synchronization … must not be
> implemented until explicitly scheduled") this spec must not be started until a future
> session is explicitly told to build it.

## Goal

Design (not build) a **local SQLite offline cache** that lets a single install of
Premgiri Books ERP keep working when its primary local PostgreSQL server is briefly
unreachable (e.g. a laptop deployment where Postgres runs as a Windows service that
hasn't started yet, or a machine temporarily disconnected from a shared office-network
Postgres instance — see Scope Clarification below), queuing writes locally and
**synchronizing back to PostgreSQL once connectivity to it is restored** ("on internet
availability," per the user's own framing, generalized here to "on database
reachability" — see that clarification).

This is an **additive resilience layer**, not a replacement for PostgreSQL:
`architecture-context.md`'s Technology Stack row (`Database: PostgreSQL (Local)`) and
Database Standards (`code-standards.md`: "PostgreSQL is the single source of truth")
are unchanged by this spec. SQLite never becomes the system of record.

---

# Scope Clarification (must be resolved before implementation starts)

The user's request frames this as syncing "on internet availability," but
`architecture-context.md`'s Technology Stack already names the database as
**"PostgreSQL (Local)"** — every existing install already runs Postgres on the same
machine or local office network, with **no internet dependency for day-to-day
operation** (Offline Strategy: "No internet connection is required for … Sales …
Accounting … Inventory"). Two materially different features hide behind the single
word "offline," and a future implementer must pick one explicitly rather than assume:

1. **Local-Postgres-unreachable resilience** — the local Postgres service is briefly
   down/not-yet-started/misconfigured on the *same* machine or LAN the app already runs
   on. SQLite here is a short-lived write buffer until the local engine problem is fixed
   by a human. No actual "internet" involved.
2. **Multi-machine / cloud-central synchronization** — a genuinely new architecture where
   each install's local database is a *replica* that periodically syncs against a shared
   central (cloud) Postgres, e.g. for a business with multiple physical locations. This is
   the literal reading of "later will sync on server on internet availability" and is a
   **much larger** change: it implies a central server, per-record change tracking,
   conflict resolution across locations, and a sync protocol/schedule.

**This spec documents option 2** (the literal request), since the user's own wording
("sync on server on internet availability") only makes sense if the authoritative copy
lives somewhere reachable only via the internet. Option 1 would not need SQLite at all —
it would need PostgreSQL itself made more resilient (connection retry/backoff), a much
smaller, different fix. A future implementer must re-confirm this reading with the user
before writing code, per `ai-workflow-rules.md`'s Handling Missing Requirements rule
("If information is missing … stop implementation until clarified").

---

# Project Context

Before implementation (of a future, explicitly-scheduled session), review

- `architecture-context.md`'s Offline Strategy, Data Storage, and Future Online Services
  sections (this spec's entire justification)
- `ai-workflow-rules.md`'s Future Modules list — Cloud Synchronization is explicitly
  listed as out of scope until scheduled; this spec's existence records the design, not an
  authorization to build it now
- `code-standards.md`'s Database Standards ("PostgreSQL is the single source of truth")
  and Financial Rules ("Financial data is immutable … Posted vouchers cannot be edited")
  — any sync design must not let a locally-queued edit to a *posted* voucher escape into
  the synced database (Business Rules below)
- Spec 81 (Backup & Restore) — the closest existing precedent for "an offline-capable
  operation against the local Postgres install," including its `pg_dump`/`pg_restore`
  shell-out pattern and its Disambiguation reasoning for why this app currently assumes
  one shared local database, not a per-location one

---

# Module Responsibilities (proposed, not built)

The Offline Sync feature would be responsible for

- A local SQLite database (via `better-sqlite3` or equivalent — **new dependency**,
  confirmed absent from `package.json`) mirroring a **write-queue subset** of the schema:
  not a full copy of all ~60+ Prisma models, but a queue of pending mutations (create/
  update operations) captured while the central/cloud database is unreachable
- A background connectivity check against the configured central database
- A sync/flush routine that replays the queue against PostgreSQL once reachable, in
  original order, and clears successfully-applied entries
- Conflict detection when the same record was also changed centrally (or by another
  location) since the queued write was captured
- A visible "Offline — N changes pending sync" indicator so a user knows their work is
  queued, not yet durable centrally

The Offline Sync feature would **not** be responsible for

- Replacing PostgreSQL as the primary datastore for any existing module (Voucher Engine,
  Pricing Engine, Inventory Engine, GST Engine — all continue reading/writing Postgres
  directly when it is reachable, per every existing feature spec)
- Multi-master conflict resolution for **posted, immutable financial documents** — per
  `code-standards.md`'s Financial Rules, a posted voucher cannot be edited at all, so
  there is no "merge" case for it; the only conflict surface is **draft/unposted**
  documents and master data (Customers, Products, etc.) edited in two places before sync
- Encryption, compression, or any storage concern beyond what SQLite provides by default —
  out of scope unless a future spec adds it explicitly

---

# Open Design Questions (for the future implementer to resolve, not this spec)

1. **What is "the server" being synced to?** Today, `architecture-context.md` describes
   one local Postgres per install with no central server at all. This spec assumes a new
   central/cloud Postgres (or an API in front of one) would need to be stood up first —
   that is its own, larger infrastructure decision, out of scope here.
2. **Which tables are queueable offline vs. which require a live connection?** e.g.
   posting a voucher touches Ledger balances across potentially many rows — queuing a
   *posting* operation offline and replaying it later risks posting against stale ledger
   balances computed before other, meanwhile-posted transactions. A safe first cut would
   likely restrict offline queuing to **draft-only** operations (unposted quotations,
   draft invoices, master-data edits) and require a live connection for anything that
   posts a voucher — this must be decided and written into Business Rules before
   implementation, not discovered mid-build.
3. **Conflict resolution policy** — last-write-wins, central-wins, or an explicit
   merge-review UI for the operator. Not decided here.
4. **Sync trigger** — polling for reachability vs. OS-level network-change events vs.
   manual "Sync Now." Spec 81's launch-time catch-up pattern (for Daily Automatic Backup)
   is a plausible starting precedent but is not assumed here.
5. **New dependency approval** — `better-sqlite3` (or an equivalent) is a native module,
   which the Electron packaging pipeline has already had repeated, hard-won lessons about
   (see `progress-tracker.md`'s v1.0.4-v1.0.6 entries on Turbopack externals, symlink
   dereferencing, and dropping `sharp` rather than fighting a native dependency through
   the same pipeline). A future implementer must budget for the same class of packaging
   work spec 81 already flagged for `pg_dump`/`pg_restore`.

---

# Do Not

Do not implement, in this work item or any session that has not been explicitly told to
build this spec

- Any SQLite dependency, schema, or code
- Any central/cloud server or sync protocol
- Any change to how any existing module reads or writes PostgreSQL

---

# Success Criteria (for this spec, as documentation only)

- This document exists at `context/feature-specs/89-offline-sqlite-sync.md`, is linked
  from `progress-tracker.md`/`context/Phases/phase-tracker.md` per the Tracker Update
  Rule, and is listed under Future Roadmap / Future Online Services — not under any
  active Phase's implementation table.
- No source code, dependency, or migration is added by this spec.
- A future session asked to implement this must first resolve the Scope Clarification
  and Open Design Questions above with the user before writing any code.
