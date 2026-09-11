# 73 - Employee Reports

> Feature-spec file number 73 — the last of this batch. This feature is
> `context/Phases/phase-tracker.md`'s **Phase 10 — Reporting** item **#71 Employee
> Reports**. Depends on Employees (Phase 9, feature-specs 61–63: Employee Master,
> Attendance, Payroll — all three drafted 2026-09-11, not yet implemented as of this
> writing). Documentation only, drafted 2026-09-11. **Read `63-payroll.md` in full before
> continuing** — that spec explicitly names this one as its downstream consumer ("Employee
> Reports (`73-employee-reports.md`, Phase 10 tracker #71) depends on this spec's posted
> `PayrollRun`/`PayrollRunItem` data... noted forward here, not built until Phase 10") and
> this spec reads the exact voucher/record shape Payroll actually posts, never an invented
> one.

## Goal

Implement **Employee Reports** for **Premgiri Books ERP** — read-only presentation over
Phase 9's three Employee-module documents: Employee Master (`61-employee-master.md`),
Attendance (`62-attendance.md`), and Payroll (`63-payroll.md`). No new Prisma model, no
new worked-day or salary arithmetic — every figure this spec shows comes from
`attendanceService.getAttendanceSummary` (spec 62's own aggregation, never re-derived)
or from Payroll's already-posted `PayrollRun`/`PayrollRunItem` rows (spec 63's own
snapshot values, never recomputed).

**MVP scope decision, stated up front.**

**In scope (three views):**
1. Attendance Summary Report
2. Payroll Register
3. Salary Register (per-employee salary history)

A fourth, simpler view — **Employee Directory** — is included as a natural, low-cost
addition (a straight presentation of `employeeService.listEmployees`, the same shape
every other Reports spec in this batch includes as its simplest view).

**Explicitly deferred:**
- Any statutory payroll report (Form 16-equivalent, PF/ESI/TDS statements, or any
  deduction-breakdown report) — `63-payroll.md`'s own Do Not section excludes every
  deduction type (PF, ESI, TDS, loan recovery) from this codebase's first release
  entirely; there is no deduction data anywhere to report on, so building a statutory
  report screen here would either show empty columns or invent figures. Deferred until a
  future payroll-enhancement phase actually introduces deductions.
- Leave-balance or leave-type reporting — `62-attendance.md`'s own Do Not section
  excludes leave-type taxonomy, balances, and accrual entirely (a single undifferentiated
  `ON_LEAVE` status only); this spec's Attendance Summary Report can show *count of
  `ON_LEAVE` days*, which is all the underlying data supports, but nothing resembling a
  leave-balance ledger.
- Overtime, bonus, or branch-wise payroll splitting reports — none of this data exists;
  `63-payroll.md`'s own Do Not section explicitly excludes branch-wise payroll splitting
  from its first release.
- Excel/PDF export mechanics (#75/#76 — forward-note only)
- Any write to `Employee`, `Attendance`, or `PayrollRun`/`PayrollRunItem` (Invariant 3)

---

# Project Context

Before implementation, review

- `61-employee-master.md` (**read in full** — `Employee.basicSalary`,
  `employeeCode`/`fullName`/`designation`/`department`/`branchId`;
  `employeeService.listEmployees`/`listSelectableEmployees`)
- `62-attendance.md` (**read in full** — `getAttendanceSummary(employeeId, periodStart,
  periodEnd)` → `{presentDays, halfDays, absentDays, onLeaveDays, totalMarkedDays}`; the
  Granularity Decision explaining why this is a live aggregation, never a cached summary
  row — this spec must never introduce one either)
- `63-payroll.md` (**read in full and see the note above** — `PayrollRun`/
  `PayrollRunItem`'s exact posted shape: `payrollNumber`, `periodStart`/`periodEnd`,
  `status`, `totalNetSalary`; per line, `employeeId`, `basicSalary` (**snapshot, not
  live**), `totalDaysInPeriod`, `workedDays` (`Decimal(5,2)`, `presentDays + 0.5 x
  halfDays`), `netSalary`. `payrollRunService.listPayrollRuns(filters)`,
  `getPayrollRun(id)` — the methods this spec's Payroll Register reuses. **This spec
  reads these fields exactly as spec 63 defines them — it does not recompute
  `workedDays`/`netSalary` from `Employee.basicSalary` or `getAttendanceSummary` itself**,
  since a posted run's stored snapshot is deliberately immutable per spec 63's own
  "financial data is immutable" posture, independent of the employee's *current*
  `basicSalary` or attendance corrections made after the run posted.)
- `architecture-context.md` / `ai-workflow-rules.md` (Reporting Engine placement,
  Invariant 3 — same citations as every spec in this batch)

---

# Module Responsibilities

The Employee Reports module is responsible for

- Four read-only report views (Attendance Summary, Payroll Register, Salary Register,
  Employee Directory)
- One new **bulk** query method added to the Attendance module (see Service /
  Repository) — a batching optimization, not new arithmetic — and one new query method
  added to the Payroll module for per-employee salary history
- A `/reports/employees` section of the shared `/reports` hub

The Employee Reports module is **not** responsible for

- Any write to `Employee`, `Attendance`, or `PayrollRun`/`PayrollRunItem`
- Any worked-day or net-salary computation — `attendanceService.getAttendanceSummary`
  and Payroll's own stored `PayrollRunItem` snapshot values are the only sources of this
  data; this module never re-derives either
- Statutory/deduction reporting, leave-balance reporting, overtime/bonus/branch-wise
  payroll reporting (deferred — see Goal)
- Excel/PDF export mechanics (forward-note only, #75/#76)

---

# Data Model

**No new Prisma model, enum, or migration.** Every view reads `Employee` (spec 61),
`Attendance` (spec 62, exclusively through `attendanceService`'s own aggregation
functions), and `PayrollRun`/`PayrollRunItem` (spec 63, exclusively through
`payrollRunService`). Invariant 3 holds structurally — this module owns no table.

---

# Business Rules

All views are scoped to the requesting user's own company. Employee Master has no
`financialYearId` (a plain master, per spec 61) and Attendance has none either (a
calendar-date record, per spec 62's own decision) — only Payroll is FY-scoped (per spec
63, since it is a financial document). Each view's filter shape reflects this directly,
rather than forcing a uniform FY filter across all three data sources the way a naive
"one filter bar for everything" design might.

## 1. Attendance Summary Report

- Filters: date range (`periodStart`/`periodEnd`, **required** — `getAttendanceSummary`
  itself requires an explicit range, per spec 62's own signature), `employeeId`
  (optional — omitted shows every active employee), `branchId` (optional, since
  `Employee.branchId` and `Attendance.branchId` both exist per specs 61/62).
- Columns, one row per employee: Employee Name, Present Days, Half Days, Absent Days, On
  Leave Days, Total Marked Days, **Unmarked Days** (`(periodEnd − periodStart + 1) −
  totalMarkedDays` — a plain calendar-day count computed by this module's own
  composition layer, not attendance arithmetic; spec 62 itself documents that
  "`totalMarkedDays` can be less than the number of calendar days in the period" and
  leaves the meaning of an unmarked day to each consumer — this report simply *shows*
  the gap as its own column, exactly as it is, rather than assuming an unmarked day means
  present or absent, which would be inventing a business rule spec 62 explicitly declined
  to make).
- **New bulk query needed** (see Service / Repository) — calling
  `getAttendanceSummary(employeeId, periodStart, periodEnd)` once per employee in a loop
  would be N+1 for a company-wide report; this spec adds a batched variant to the
  Attendance module itself (the same aggregation, parameterized over many employees at
  once), not a second independent implementation of the counting logic.

## 2. Payroll Register

- Filters: `financialYearId` (optional, defaults to active FY — Payroll is FY-scoped),
  date range (`periodStart`/`periodEnd` overlap, optional), `status` (optional, defaults
  to `POSTED`; a user with `reports.view` may still include `DRAFT`/`CANCELLED` for
  reconciliation, the same register-specific override every other Register view in this
  batch allows).
- Columns: Payroll Number, Period (Start–End), Total Net Salary, Status.
- Reuses `payrollRunService.listPayrollRuns(filters)` (spec 63, already implemented with
  the required filter support per that spec's own UI section) — **no new repository
  method needed for this view.**

## 3. Salary Register (per-employee salary history)

- Filters: `employeeId` (**required**), `financialYearId` (optional — spans multiple FYs
  by default, since an employee's salary history is naturally a multi-year view, unlike
  Payroll Register's own single-FY default), date range (optional).
- Columns, one row per `PayrollRunItem` the employee appears in across **`POSTED`** runs
  only (a `CANCELLED` run's items reflect a reversed liability, per spec 63's own
  cancellation rule — showing them in a salary *history* would misrepresent what the
  employee was actually paid; a `DRAFT` run has not committed any figure yet): Payroll
  Number, Period, Basic Salary (the run's own snapshot, **not** `Employee`'s current
  value), Worked Days, Total Days In Period, Net Salary.
- **New repository method required** (see Service / Repository) — no existing Payroll
  query lists `PayrollRunItem` rows filtered/grouped by a single employee across many
  runs; `payrollRunService.listPayrollRuns`/`getPayrollRun` are run-scoped (one run at a
  time), not employee-scoped across runs.

## 4. Employee Directory

- Filters: `department`/`designation` (optional, free-text contains-match, since neither
  is an enum per spec 61's own deliberate decision), `branchId` (optional), `status`
  (optional, defaults to active).
- Columns: Employee Code, Name, Designation, Department, Branch, Status.
- Reuses `employeeService.listEmployees(filters)` (spec 61) directly — no new query
  needed.

---

# Service / Repository

**Amend** the existing Attendance and Payroll modules:

```text
src/modules/attendance/repositories/attendance-repository.ts  // + aggregateSummaryForEmployees
src/modules/attendance/services/attendance-service.ts          // + getAttendanceSummaryBulk
src/modules/payroll/repositories/payroll-run-repository.ts     // + listItemsForEmployee
src/modules/payroll/services/payroll-run-service.ts            // + getEmployeeSalaryHistory
```

- `attendanceRepository.aggregateSummaryForEmployees(companyId, employeeIds, periodStart,
  periodEnd)` — the same `groupBy`/`count` shape `getAttendanceSummary` already performs
  for one employee, parameterized to run once across many `employeeId`s (a single
  Prisma `groupBy` on `[employeeId, status]` within the date range, reshaped into one
  per-employee result map) — **the identical counting logic, batched, not a second
  implementation of it.**
- `attendanceService.getAttendanceSummaryBulk(employeeIds, periodStart, periodEnd)` — a
  thin pass-through exposing the new repository method as this module's public API,
  mirroring how `getAttendanceSummary` itself is exposed. **This is the method Employee
  Reports' Attendance Summary view calls** — never the repository directly.
- `payrollRunRepository.listItemsForEmployee(companyId, employeeId, filters)` — a query
  joining `PayrollRunItem` to its parent `PayrollRun` for the `employeeId`/status/FY/
  date filters, returning the row shape Business Rules #3 describes.
- `payrollRunService.getEmployeeSalaryHistory(employeeId, filters)` — thin pass-through,
  the same layering convention every module in this codebase already follows.

**Create**

```text
src/engines/reporting/employee-reports.ts       // buildAttendanceSummaryReport, buildPayrollRegister, buildSalaryRegister, buildEmployeeDirectory
src/modules/reports/employees/services/employee-report-service.ts
src/modules/reports/employees/actions/employee-report-actions.ts
src/modules/reports/employees/components/…
src/types/employee-report.ts
```

- `src/engines/reporting/employee-reports.ts` — pure composition functions:
  `buildAttendanceSummaryReport(companyId, filters)` (calls
  `employeeService.listSelectableEmployees` for the employee set, then
  `attendanceService.getAttendanceSummaryBulk`, then computes the Unmarked Days column),
  `buildPayrollRegister(companyId, filters)` (calls `payrollRunService.listPayrollRuns`
  directly — effectively a thin re-export, kept here for a single consistent import
  surface across all four views, the same pattern spec 71/72 use for their own
  Directory views), `buildSalaryRegister(companyId, employeeId, filters)` (calls
  `payrollRunService.getEmployeeSalaryHistory`), `buildEmployeeDirectory(companyId,
  filters)` (calls `employeeService.listEmployees`). No Prisma import anywhere in this
  file.
- `employeeReportService` — thin service validating filters and delegating to the
  matching engine function.

---

# Validation

Zod (`employee-report-schema.ts`): `employeeId` optional/required uuid depending on view
(required for Salary Register; server re-verifies same-company), `periodStart`/
`periodEnd`/`dateFrom`/`dateTo` calendar dates with the standard `start <= end` refine,
`financialYearId` optional uuid, `branchId` optional uuid, `department`/`designation`
optional free-text (≤ 100 characters, matching spec 61's own field bounds), `status`
optional enum matching the relevant document's own status enum.

---

# UI

Pages

- `/reports` — shared hub (same Assumption note as `68-sales-reports.md`).
- `/reports/employees` — Employee Reports section (four cards/tabs)
- `/reports/employees/attendance-summary` — Attendance Summary Report
- `/reports/employees/payroll-register` — Payroll Register
- `/reports/employees/salary-register` — Salary Register (employee picker required
  before the register table renders)
- `/reports/employees/directory` — Employee Directory

Components (`src/modules/reports/employees/components/`): shared `ReportFilterBar`
(reused), an Employee Picker (reused from spec 61's existing
`listSelectableEmployees()`-backed picker if one exists), four report tables.

Wire-up

- Add an "Employee Reports" card to `/reports`.
- Add `"reports/employees": "Employee Reports"` (parent/segment key, disambiguating
  against the existing bare `employees` key used by `/employees`, the Phase 9 operational
  hub — see `62-attendance.md`), `"attendance-summary": "Attendance Summary"`,
  `"payroll-register": "Payroll Register"`, `"salary-register": "Salary Register"`,
  `directory: "Directory"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `reports` permission module: `view`, `export` (reserved) — **not**
`employees`, per this batch's shared design decision that Reports are gated uniformly by
`reports` regardless of the domain they present (mirroring how `63-payroll.md`'s own
extended Company Settings section is gated by `settings`, not `employees` — a report is
a presentation concern with its own permission boundary, the same reasoning). No new
permission module or action. Company-scoped identically to every spec in this project.

---

# Database

No new model, enum, or migration.

---

# Code Standards

Strict TypeScript, no `any`, **zero worked-day or net-salary arithmetic outside
`attendanceService`/Payroll's own stored snapshot values** (this module's only
computation is the Attendance Summary's plain Unmarked Days subtraction, a calendar-day
count, not attendance-status arithmetic), vitest coverage for:

- `aggregateSummaryForEmployees`/`getAttendanceSummaryBulk` correctness against a seeded
  multi-employee fixture, confirmed to match calling `getAttendanceSummary` once per
  employee individually (a parity test proving the batched version is not a second,
  divergent implementation)
- the Unmarked Days computation against a fixture with partially-marked periods
- `listItemsForEmployee`/`getEmployeeSalaryHistory` correctly excludes `CANCELLED` runs
  and includes only `POSTED` ones, against a fixture with all three statuses
- the Salary Register shows each `PayrollRunItem`'s own stored `basicSalary` snapshot,
  not the employee's current (possibly since-changed) `Employee.basicSalary` — a test
  that changes the employee's salary after a run posts and asserts the register still
  shows the old, snapshotted figure
- cross-company `employeeId`/`financialYearId`/`branchId` rejection on every view
- no test or code path in this module calls `prisma` directly or duplicates
  `getAttendanceSummary`'s per-status counting logic

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration
- Any write to `Employee`, `Attendance`, or `PayrollRun`/`PayrollRunItem`
- Any worked-day or net-salary recomputation independent of `attendanceService`/
  Payroll's own stored values
- Statutory/deduction reporting (PF/ESI/TDS, Form 16-equivalent) — no deduction data
  exists anywhere in this codebase (deferred — see Goal)
- Leave-balance, leave-type, overtime, bonus, or branch-wise payroll splitting reports
  (deferred — see Goal; none of this data exists)
- Excel/PDF export mechanics (#75/#76 — forward-note only)

---

# Success Criteria

Verify

- The Attendance Summary Report's per-employee counts, produced via
  `getAttendanceSummaryBulk`, exactly match calling `getAttendanceSummary` once per
  employee individually, against a seeded multi-employee, multi-status fixture; the
  Unmarked Days column is correct.
- The Payroll Register matches `payrollRunService.listPayrollRuns`'s own output exactly,
  `POSTED`-only by default with a working status override.
- The Salary Register shows only `POSTED` runs for the selected employee, with each
  row's `basicSalary`/`workedDays`/`netSalary` exactly matching that run's own stored
  `PayrollRunItem` snapshot — never the employee's current live `basicSalary`, even when
  it has since changed.
- The Employee Directory matches `employeeService.listEmployees`'s own output.
- Every view rejects a cross-company `employeeId`/`financialYearId`/`branchId`.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/employees*` appears in the build route table.

Feature-spec 73 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #71 —
the last item in this six-spec batch (tracker #66–#71, spec files 68–73). Together with
the sibling batch's financial-reports specs (Trial Balance through GST Reports, tracker
#62–#65/#72, spec files 64–67/74), completing all ten Phase 10 specs closes the
Reporting phase's documentation stage in full.
