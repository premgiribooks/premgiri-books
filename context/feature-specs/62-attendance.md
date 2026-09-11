# 62 - Attendance

> Feature-spec file number 62 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 9 — Employee Management** item
> **#60 Attendance** — the second of three (#59 Employee Master → #60 Attendance → #61
> Payroll). Depends on Employee Master (`61-employee-master.md`) — **implement after it,
> not before**: every Attendance row references an existing `Employee`. Payroll
> (`63-payroll.md`) depends on this spec's records — **read this spec's Business Rules
> and query shape before writing that one**, the same "read the prior spec in this
> group first" discipline `39-sales-return.md` follows relative to `38-sales-invoice.md`.
> Documentation only, drafted 2026-09-11 — nothing in this spec is implemented yet.

## Goal

Implement **Attendance** for **Premgiri Books ERP** — the daily attendance record per
employee that Payroll (`63-payroll.md`) aggregates into a worked-day count for salary
calculation. `architecture-context.md`'s Employee module boundary names "Attendance" as
one of its four responsibilities (Employee Master, Attendance, Salary, Payroll); this
spec is the second of those four to land.

This is a simple, non-financial recording feature — no Voucher Engine, no GST, no stock.
Its only consumer downstream is Payroll's aggregation query.

---

# Project Context

Before implementation, review

- `61-employee-master.md` (**read this first in full** — the `Employee` model and its
  `listSelectableEmployees()` lookup this spec references; the User↔Employee decision
  is not relevant here, Attendance only ever references `Employee`, never `User`)
- `architecture-context.md` (Employee module boundary; Invariant 5 — modules
  communicate through shared services, never by reaching into another module's table
  directly)
- `12-branch-management.md` (the optional-branch-link precedent this spec reuses, same
  as Employee Master's own `branchId`)
- `46-opening-stock.md` / `47-stock-adjustment.md` (the "thin document vs. real
  numbered document" distinction this spec resolves the same way Opening Stock did —
  Attendance needs **no** Document Number Engine numbering; see Module
  Responsibilities)

---

# Module Responsibilities

The Attendance module is responsible for

- Recording one attendance status per employee per calendar day
- Bulk/period entry (marking a whole day's attendance for many employees at once, or a
  single employee across a date range, without requiring N individual saves)
- A period-aggregation query — `getAttendanceSummary(employeeId, periodStart,
  periodEnd)` — returning the worked-day figures Payroll (`63-payroll.md`) consumes
  directly, so Payroll never re-derives attendance arithmetic itself (the same
  "engines/shared services own the arithmetic, callers just call it" posture this
  codebase applies everywhere else, even though Attendance is a module, not an engine
  — see the Granularity Decision below for why no `src/engines/attendance/` was
  introduced)

The Attendance module is **not** responsible for

- Employee Master (`61-employee-master.md`, already implemented by the time this runs)
- Salary computation or any Voucher Engine call (`63-payroll.md`)
- Leave-request workflows, approval chains, or leave-balance accrual/carry-forward (a
  full HR leave-management system is out of scope — see Do Not)
- Shift/timesheet management (clock-in/clock-out times) — this is a daily-status record,
  not a time-tracking system

---

# Granularity Decision — one row per employee per day

**Attendance is recorded as one row per `(employee, date)` pair, not a pre-aggregated
monthly summary row.** This is a real design decision, justified against Payroll's
actual query need (per this phase's design guidance), not assumed:

- Payroll (`63-payroll.md`) needs, per employee per pay period, a worked-day count.
  A monthly summary row (one row per employee per month, storing a pre-computed
  `presentDays` count directly) would make that read trivial — but it would mean any
  correction to a single day (an employee marked absent by mistake, corrected two weeks
  later) requires either editing a financial-adjacent aggregate in place (this
  codebase's "financial data is immutable, corrections are new entries, never edits"
  posture — `code-standards.md` Financial Rules — extends in spirit to anything payroll
  depends on) or recomputing the whole month's summary from some other source of truth
  that would then have to exist anyway.
- A daily row is the **atomic fact** ("this employee was Present on this date") the same
  way a `StockTransaction` row is the atomic fact behind a computed running stock level,
  or a `VoucherEntry` row is the atomic fact behind a computed ledger balance
  (`code-standards.md`: "Current stock is calculated from stock transactions"; spec 31:
  "Ledger balances are never manually updated"). Payroll's worked-day count is *derived*
  from these atomic rows via `getAttendanceSummary`, exactly as every other aggregate in
  this codebase is derived rather than stored redundantly.
- The storage cost (one row per employee per working day, versus one row per employee
  per month) is trivial at this ERP's scale (a single company's employee count × ~26–31
  rows/month) and buys correctability: a single day can be corrected by upserting that
  one row, with no recomputation of anything else, and a half-day is representable
  exactly instead of needing fractional bookkeeping bolted onto a monthly integer.
- **A monthly summary row is not reintroduced later as a cache** — no
  `AttendanceSummary` table exists in this spec's scope; `getAttendanceSummary` is a
  live aggregation query (a `groupBy`/`count` over `Attendance` rows for the period), not
  a materialized one. If a future phase's reporting needs demand a cached aggregate,
  that is its own scoped addition, not retrofitted here speculatively (YAGNI).

---

# Data Model

Add to `prisma/schema.prisma` (plus `attendanceRecords Attendance[]` back-relations on
`Company` and `Employee`; `Branch` back-relation optional — see below):

```text
enum AttendanceStatus {
  PRESENT
  ABSENT
  HALF_DAY
  ON_LEAVE
}

model Attendance {
  id           String           @id @default(uuid())
  companyId    String
  company      Company          @relation(fields: [companyId], references: [id])
  employeeId   String
  employee     Employee         @relation(fields: [employeeId], references: [id])
  branchId     String?
  branch       Branch?          @relation(fields: [branchId], references: [id])
  date         DateTime         @db.Date
  status       AttendanceStatus
  remarks      String?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@unique([companyId, employeeId, date])
  @@index([companyId, date])
  @@index([employeeId, date])
}
```

Decisions

- **`@@unique([companyId, employeeId, date])`** — at most one attendance status per
  employee per calendar day, enforced at the database level. Recording a second status
  for the same day is an **update** of the existing row (an upsert), never a second row
  — a day cannot simultaneously be two different statuses, unlike a `StockTransaction`
  ledger where multiple rows for the same day are normal and expected.
- **`branchId` is optional**, denormalized onto the row from the employee's own
  `branchId` at entry time (not a live join every time), mirroring how
  `PurchaseInvoiceItem.warehouseId` is stored per-line rather than derived — this lets a
  multi-branch company filter/report attendance by branch even if an employee's own
  branch assignment changes later, without retroactively reclassifying historical
  attendance. Optional because a company with no branches (or an employee with no
  branch assignment — see `61-employee-master.md`) still records attendance normally.
- **`AttendanceStatus` has four values, no more**: `PRESENT`, `ABSENT`, `HALF_DAY`,
  `ON_LEAVE`. No sub-typed leave categories (sick leave / casual leave / paid leave /
  unpaid leave) — a real leave-type taxonomy with balances and accrual rules is a
  distinct HR feature this ERP does not attempt in its first release (see Do Not);
  `ON_LEAVE` is a single undifferentiated status, and Payroll's MVP formula (see
  `63-payroll.md`) treats it as unpaid, the simplest defensible default absent a
  configured leave policy.
- **No numbered document, no Document Number Engine entry.** Attendance is a recurring
  operational record, not a business document with its own identity a party ever needs
  to reference (unlike an Invoice number or a Payroll run number) — it needs no
  `DocumentType` value, the same reasoning `46-opening-stock.md` used to justify no
  numbering for its own recording-only feature.
- No `financialYearId` — attendance is a calendar-date record, not an accounting-period
  one; Payroll (which *is* FY-scoped, like every financial document in this project)
  reads attendance by an explicit date range it computes from its own period, not by FY.
- No `createdByUserId` — this codebase's `createdBy` convention (spec 31) is reserved
  for financial/voucher-adjacent audit trail; a daily attendance mark is neither (see
  known gap #4 in `architecture-context.md` — not retrofitted here).

---

# Business Rules

- **One status per `(employee, date)`** — enforced by the unique constraint; the
  service exposes an upsert (`markAttendance`), never an insert-only create, so
  correcting a day's mistaken entry is idempotent and does not require a separate
  "edit" concept.
- **`date` must not be in the future** — mirrors this codebase's existing
  future-date-rejection convention (Stock Adjustment/Physical Verification's own
  future-date rule) applied here for the same reason: attendance is a record of what
  already happened, not a forward schedule.
- **`employeeId` must belong to the active company and be active** at the time of
  entry — a deactivated employee can still have their historical attendance viewed, but
  marking *new* attendance against an inactive employee is rejected with a friendly
  error (mirrors every other "inactive references reject at the point of new use, not
  retroactively" rule in this codebase, e.g. Purchase Invoice's inactive-ledger check).
- **Bulk entry**: marking a single day for N employees at once (a roster page) or a
  single employee across a date range both resolve to the same underlying per-row
  upsert, executed inside one transaction so a partial-batch failure never leaves half a
  day's roster recorded and half not.
- **`getAttendanceSummary(employeeId, periodStart, periodEnd)`** — the query Payroll
  consumes. Returns, for the given inclusive date range: `presentDays` (count of
  `PRESENT` rows), `halfDays` (count of `HALF_DAY` rows), `absentDays` (count of
  `ABSENT`), `onLeaveDays` (count of `ON_LEAVE`), and `totalMarkedDays` (sum of all
  four) — deliberately returning raw counts per status rather than a single
  pre-blended "worked days" number, so Payroll's own formula (which status counts as
  how much pay) stays entirely inside Payroll's spec and is never silently duplicated
  here. Days in the period with **no** Attendance row at all are not implicitly treated
  as any status — they are simply absent from every count (`totalMarkedDays` can be
  less than the number of calendar days in the period); Payroll's own Business Rules
  decide what an unmarked day means for pay (see `63-payroll.md`).
- Company-scoped for every user via `getCurrentCompanyUser()`; cross-company resolves as
  not-found.
- No delete — a mistaken entry is corrected via the same upsert (`markAttendance`
  overwrites the existing row's `status`/`remarks`), never removed, so a historical
  audit trail of what was last recorded remains simple (no separate history table is
  introduced in this first release — only the current status per day is kept, matching
  this feature's stated non-financial, non-audited scope).

---

# Service / Repository

Create

```text
src/modules/attendance/repositories/attendance-repository.ts
src/modules/attendance/services/attendance-service.ts
src/modules/attendance/validation/attendance-schema.ts
src/modules/attendance/actions/attendance-actions.ts
src/modules/attendance/components/…
src/types/attendance.ts
```

- `attendanceService`:
  - `markAttendance(employeeId, date, status, remarks?)` — single-row upsert
  - `markAttendanceBulk(entries[])` — the roster-page batch upsert, one transaction
  - `listAttendance(filters)` — by employee, branch, date range, status (for the list/
    roster UI)
  - `getAttendanceSummary(employeeId, periodStart, periodEnd)` — the Payroll-consumed
    aggregation query described above
- No repository method is ever called by a component or Server Action directly — the
  service is the only entry point, matching Repository → Service → Server Action → UI
  layering used everywhere else in this project.

---

# Validation

Zod (`attendance-schema.ts`):

- `employeeId` — required uuid (server re-verifies same-company, active)
- `date` — required calendar date, not in the future
- `status` — required enum (`PRESENT | ABSENT | HALF_DAY | ON_LEAVE`)
- `remarks` — optional, ≤ 250 characters
- Bulk entry — array of the above, 1–500 entries (a generous but bounded roster-page
  batch size), each validated identically; the whole batch rejected together on any
  single invalid entry (no partial-batch save)

---

# UI

Pages (a new `/employees` hub, since Employee Master (`61-employee-master.md`) lives
under `/masters` but Attendance and Payroll are day-to-day operational screens, not
master-data CRUD — mirrors how `/inventory` and `/purchase` are their own hubs distinct
from `/masters`)

- `/employees` — hub page (cards: Attendance, and — once implemented — Payroll)
- `/employees/attendance` — Attendance roster (date picker + employee list, mark
  Present/Absent/Half Day/On Leave per row, bulk-save)
- `/employees/attendance/history` — per-employee attendance history (date range filter,
  read-only)

Components (`src/modules/attendance/components/`): Attendance Roster Table (editable
status cells for the selected date), Attendance Status Badge, Attendance History Table,
Date Range Picker (shared, if one does not already exist elsewhere in the codebase by
the time this is implemented — reuse rather than duplicate).

Wire-up

- Add a new "Employees" entry to the Sidebar (`src/components/layout/sidebar.tsx`)
  linking to `/employees`, alongside Masters/Sales/Purchase/Inventory/Accounting —
  `architecture-context.md` already lists Employee as its own module boundary, distinct
  from Masters, so it gets its own top-level nav entry rather than living under
  Masters or Settings (Employee Master itself stays under `/masters/employees` per its
  own spec — only the operational Attendance/Payroll screens live under the new
  `/employees` hub; this mirrors how Branch Management's *master* lives under
  `/masters` while Branch *Selection* is its own top-level flow).
- Add `employees: "Employees"`, `"employees/attendance": "Attendance"`, and
  `"attendance/history": "History"` to `src/constants/breadcrumbs.ts` (the
  "parent/segment" disambiguation pattern, since `attendance` as a bare segment could
  otherwise collide with a future differently-parented route).

---

# Security

Gated by the existing `employees` permission module: `view` for reads/history,
`create`/`edit` for marking attendance (a single roster save uses `create` — there is
no separate "edit an existing day" action distinct from re-marking it, per the upsert
design above), `export`. No catalog changes needed.

All reads/writes scoped to the requesting user's own company — never accept a company
id from the client.

---

# Database

New model `Attendance`, new enum `AttendanceStatus`. One migration. Back-relations on
`Company`, `Employee`, `Branch`. No seeding.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business
logic in components, Zod validation at the boundary, vitest coverage for:

- the upsert behavior (marking the same employee/date twice overwrites, never creates a
  second row)
- future-date rejection
- inactive/cross-company employee rejection
- bulk entry's all-or-nothing transactional behavior (one invalid entry in a batch
  rejects the whole batch, no partial write)
- `getAttendanceSummary`'s per-status count correctness against a seeded fixture
  spanning all four statuses plus unmarked days within the period

---

# Do Not

Do not implement

- Employee Master (`61-employee-master.md`, already implemented by the time this runs)
- Salary computation or any Voucher Engine call (`63-payroll.md`)
- Leave-type taxonomy, leave balances, leave accrual/carry-forward, or any approval
  workflow (a single undifferentiated `ON_LEAVE` status only — see Data Model)
- Shift management, clock-in/clock-out timestamps, or overtime tracking
- A materialized/cached monthly summary table (see Granularity Decision — derive
  always, never store an aggregate)
- Any numbered document or Document Number Engine entry (see Data Model)
- A history/audit trail of prior values for a corrected day (only the current status per
  day is kept — see Business Rules)

---

# Success Criteria

Verify

- Marking attendance for an employee/date upserts a single row; a second mark for the
  same employee/date overwrites the first rather than creating a duplicate.
- A future-dated entry is rejected; an inactive or cross-company employee is rejected.
- Bulk roster entry commits atomically — an injected failure partway through a batch
  leaves no partial rows from that batch.
- `getAttendanceSummary(employeeId, periodStart, periodEnd)` returns correct per-status
  counts against a fixture mixing all four statuses and unmarked days, matching
  hand-computed expectations.
- `/employees` hub shows an Attendance card; `/employees/attendance` and
  `/employees/attendance/history` render correctly; breadcrumbs label them "Attendance"
  and "History".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 62 (this spec) is `context/Phases/phase-tracker.md`'s Phase 9 item #60.
Feature-spec 63 (Payroll, tracker #61) depends on it and must be implemented next, in
order, consuming `getAttendanceSummary` directly rather than re-deriving attendance
arithmetic.
