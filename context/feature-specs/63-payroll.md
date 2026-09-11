# 63 - Payroll

> Feature-spec file number 63 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 9 — Employee Management** item
> **#61 Payroll** — the third and last of three (#59 Employee Master → #60 Attendance →
> #61 Payroll). Depends on Attendance (`62-attendance.md`), which depends on Employee
> Master (`61-employee-master.md`) — **implement last, in this order**. **Read
> `31-voucher-engine.md`, `52-payment-voucher.md`, and `44-purchase-invoice.md` in full
> before this spec** — Payroll is a **financial transaction**
> (`architecture-context.md` Invariant 1: "every financial transaction must generate
> vouchers") and posts through the Voucher Engine exactly the way Purchase Invoice does,
> never inventing its own ledger-posting logic. Documentation only, drafted 2026-09-11 —
> nothing in this spec is implemented yet.

## Goal

Implement **Payroll** for **Premgiri Books ERP** — the period-based, numbered document
that aggregates Attendance (`62-attendance.md`) for a chosen period, computes each
active employee's salary for that period from `Employee.basicSalary`
(`61-employee-master.md`) and their worked-day ratio, and posts one balanced accounting
voucher for the whole run through the Voucher Engine (`31-voucher-engine.md`) — closing
out `architecture-context.md`'s Employee module boundary ("Employee Master, Attendance,
Salary, Payroll").

This is the pivotal spec of Phase 9, the same way Sales Invoice/Purchase Invoice are the
pivotal specs of Phases 3/4: the first Employee-module document with a real financial
consequence. Employee Master and Attendance are pure recording features with no
Voucher Engine call; this one is not.

**First-release scope is deliberately minimal**: one salary component
(`Employee.basicSalary`), a single worked-day ratio formula, one aggregate voucher per
run. No deductions (PF/ESI/TDS/loan recovery), no overtime, no bonuses, no
multi-component salary structure (HRA/DA/allowances) — all explicitly out of scope (see
Do Not) and deferred to a future payroll-enhancement phase once a real requirement names
them. Employee Reports (`73-employee-reports.md`, Phase 10 tracker #71) will read this
spec's posted data once that phase lands — noted forward, not built here.

---

# Project Context

Before implementation, review

- `61-employee-master.md`, `62-attendance.md` (**read both in full** — the `Employee`
  model, its `basicSalary` field and the "Payroll snapshots it, never reads it live"
  rule; `getAttendanceSummary`, the aggregation query this spec consumes directly rather
  than re-deriving)
- `31-voucher-engine.md` (**read in full** — `postVoucher`/`cancelVoucher`, the balance
  rule, the immutability rule, the `VoucherType` enum this spec extends)
- `52-payment-voucher.md` (**read in full** — the precedent for settling a pooled
  liability ledger via the existing manual-voucher screens rather than this spec
  inventing its own disbursement logic; see Ledger Posting below)
- `44-purchase-invoice.md` (**read its posting orchestration and Ledger Mapping
  Validation sections closely** — this spec's own posting orchestration and Company
  Settings ledger-mapping validation mirror that shape almost exactly: compute, validate
  mappings, call the engine, never invent ad hoc posting logic)
- `34-document-number-engine.md` (`DocumentType` — this spec appends new values, see
  Data Model)
- `16-expense-heads.md` (the Expense Head pattern this spec's Salary Expense mapping
  reuses conceptually — a Salary Expense ledger is just an Expense Head under "Indirect
  Expenses"; no new reserved ledger group is introduced)
- `13-ledger-groups.md` (the seeded "Indirect Expenses" and "Current Liabilities" groups
  this spec's two new Company Settings mappings validate against)

---

# Module Responsibilities

The Payroll module is responsible for

- Payroll Run Master (Create/Post/View/Cancel, scoped to the active company and
  financial year) — **no Edit after posting**, matching every posted document in this
  codebase
- Aggregating Attendance into a per-employee worked-day ratio for the chosen period via
  `attendanceService.getAttendanceSummary` — **never re-implementing that arithmetic**
- Computing each included employee's net salary for the period from their snapshotted
  `basicSalary` and worked-day ratio
- Orchestrating, at posting time, one balanced voucher covering the whole run's total
  liability, via `voucherEngine.postVoucher` — **unmodified**, the same posture Payment
  Voucher and Purchase Invoice take
- Payroll Run numbering via the Document Number Engine
- A new Company Settings section: the Salary Expense / Salary Payable ledger mapping
  posting depends on

The Payroll module is **not** responsible for

- Employee Master or Attendance (`61`/`62`, already implemented by the time this runs)
- Actual disbursement of the posted Salary Payable balance to any individual employee —
  see Ledger Posting: settling that pooled liability (writing a cheque, a bank
  transfer) is **Payment Voucher's** job (`52-payment-voucher.md`), exactly the way
  Payment Voucher already "can pay an expense, settle a Sundry Creditor balance outside
  invoice billing" against any active ledger — Salary Payable is just another ledger a
  Payment Voucher can debit. This spec never writes a payment-side entry itself.
- Any deduction, overtime, bonus, or multi-component salary calculation (see Do Not)
- Leave-type policy (Attendance's own scope — this spec only consumes
  `getAttendanceSummary`'s raw counts, per its own documented worked-day formula below)
- GST (payroll has no GST implication) or Inventory (no stock movement)

---

# VoucherType Decision — `VoucherType.SALARY` is added, not reused

**This spec adds a new `VoucherType.SALARY` value** (appended to the existing
`PAYMENT, RECEIPT, CONTRA, JOURNAL, SALES, PURCHASE, CREDIT_NOTE, DEBIT_NOTE,
SALES_RETURN, PURCHASE_RETURN` list, never renumbering/reordering the existing ten),
**rather than reusing `JOURNAL` or `PAYMENT` semantics.** This is a real open
architectural decision, recorded with its reasoning per this project's standing
practice of recording such decisions explicitly (the way spec 49 recorded its own
sanity-check flags) rather than silently picking one:

- **Considered: reuse `VoucherType.JOURNAL`.** Journal Voucher (`55-journal-voucher.md`)
  is this codebase's fully-freeform manual entry type — any Debit/Credit combination
  against any ledger, balance-only. Payroll's posting *is* structurally a journal entry
  (Debit Salary Expense, Credit Salary Payable — no cash movement at posting time).
  **Rejected** because every other document-generating feature in this codebase that
  has its own recognizable business shape gets its own `VoucherType` — Sales Invoice
  posts `SALES`, not `JOURNAL`; Purchase Invoice posts `PURCHASE`, not `JOURNAL` — even
  though a Sales Invoice's entries are, mechanically, also just a balanced Debit/Credit
  set a Journal Voucher's engine call could equally represent. Reusing `JOURNAL` here
  would make every future GST/financial report or ledger inquiry screen that wants to
  say "show me payroll postings specifically" unable to filter by voucher type alone —
  it would have to inspect `referenceType`/`narration` instead, a strictly worse query
  surface than the one every other document already gets for free via its own type.
- **Considered: reuse `VoucherType.PAYMENT`.** Rejected for the same reason, plus a
  correctness problem: Payment Voucher's own Business Rules (`52-payment-voucher.md`)
  require exactly one Credit entry restricted to a Cash-in-Hand-or-`BankAccount`-linked
  ledger. Payroll's posting credits **Salary Payable** (a `Current Liabilities`
  ledger), not Cash/Bank — it is not a cash outflow at posting time at all (see Ledger
  Posting). Forcing it through `PAYMENT`'s shape would either violate that shape's own
  rule or require weakening it for this one caller, neither acceptable.
- **Decision: add `VoucherType.SALARY`.** This follows exactly the same precedent
  `34-document-number-engine.md` already established for every other document type:
  "every one of spec 31's ten `VoucherType`s maps 1:1 to its own dedicated `*_VOUCHER`
  entry ... one series per thing that displays a number." Payroll is a new "thing that
  displays a number" (its own Payroll Run number) that *also* generates its own voucher
  (its own Salary Voucher number) — the same two-numbers-per-document shape Sales
  Invoice and Purchase Invoice already have (an invoice number and a separate
  `*_VOUCHER` series). Adding one new `VoucherType` value and one new `DocumentType`
  value (see Data Model) is a strictly additive, non-breaking schema change, consistent
  with how every prior phase in this project has extended these two enums.

---

# Data Model

Add to `prisma/schema.prisma`:

```text
// Append to the existing VoucherType enum (never reorder/renumber the existing ten):
enum VoucherType {
  PAYMENT
  RECEIPT
  CONTRA
  JOURNAL
  SALES
  PURCHASE
  CREDIT_NOTE
  DEBIT_NOTE
  SALES_RETURN
  PURCHASE_RETURN
  SALARY // new — this spec, see VoucherType Decision above
}

// Append to the existing DocumentType enum (never reorder/renumber the existing list,
// which currently ends at PHYSICAL_VERIFICATION):
enum DocumentType {
  // ...existing values unchanged...
  PAYROLL          // this run's own document number series
  SALARY_VOUCHER   // the voucher this run generates — mirrors SALES_VOUCHER/PURCHASE_VOUCHER
}
```

```text
enum PayrollRunStatus {
  DRAFT
  POSTED
  CANCELLED
}

model PayrollRun {
  id              String           @id @default(uuid())
  companyId       String
  company         Company          @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear    @relation(fields: [financialYearId], references: [id])
  payrollNumber   String?          // this system's own number — null until posted, see Decisions
  periodStart     DateTime         @db.Date
  periodEnd       DateTime         @db.Date
  status          PayrollRunStatus @default(DRAFT)
  narration       String?
  totalNetSalary  Decimal          @db.Decimal(14, 2) @default(0)
  voucherId       String?          @unique
  voucher         Voucher?         @relation(fields: [voucherId], references: [id])
  createdByUserId String?
  createdBy       User?            @relation(fields: [createdByUserId], references: [id])
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  items PayrollRunItem[]

  @@unique([companyId, financialYearId, payrollNumber])
  @@index([companyId, status])
  @@index([companyId, periodStart, periodEnd])
}

model PayrollRunItem {
  id                String     @id @default(uuid())
  payrollRunId      String
  payrollRun        PayrollRun @relation(fields: [payrollRunId], references: [id])
  lineNumber        Int
  employeeId        String
  employee          Employee   @relation(fields: [employeeId], references: [id])
  basicSalary       Decimal    @db.Decimal(14, 2) // snapshot at run time — see Decisions
  totalDaysInPeriod Int
  workedDays        Decimal    @db.Decimal(5, 2)  // presentDays + 0.5 x halfDays — see Business Rules
  netSalary         Decimal    @db.Decimal(14, 2) // basicSalary x (workedDays / totalDaysInPeriod), rounded to paise

  @@unique([payrollRunId, lineNumber])
  @@unique([payrollRunId, employeeId])
  @@index([employeeId])
}

// Add to existing model CompanySettings (alongside spec 38/44's Sales/Purchase GST
// mapping and the shared roundOffLedgerId — no field reused across these two, since
// payroll posting has no round-off concept, see Ledger Posting):
salaryExpenseLedgerId String?
salaryExpenseLedger   Ledger?  @relation("CompanySettingsSalaryExpense", fields: [salaryExpenseLedgerId], references: [id])
salaryPayableLedgerId String?
salaryPayableLedger   Ledger?  @relation("CompanySettingsSalaryPayable", fields: [salaryPayableLedgerId], references: [id])
```

Decisions

- **`payrollNumber` is nullable, assigned only at posting** — identical two-step
  contract to Purchase Invoice's `invoiceNumber` (`44-purchase-invoice.md`'s Decisions):
  a `DRAFT` run has no committed identity yet, multiple drafts coexist safely (Postgres
  treats `NULL` as distinct in the composite unique index), and the Document Number
  Engine's `generateNumber` runs inside `postPayrollRun`'s own transaction.
- **`PayrollRunItem.basicSalary` is a snapshot**, copied from `Employee.basicSalary` at
  posting time, never a live reference — the same "financial data is immutable" posture
  every other posted document's line items already follow (Sales/Purchase Invoice
  snapshot `rate`, not a live `product.purchasePrice` join). A later edit to an
  employee's `basicSalary` never retroactively changes a posted run's stored figure.
- **`workedDays` is `Decimal(5,2)`**, not an integer — `HALF_DAY` contributes `0.5`, so
  a period's worked-day count is not always whole.
- **One `PayrollRunItem` per included employee per run** (`@@unique([payrollRunId,
  employeeId])`) — an employee cannot appear twice in the same run.
- **`@@unique([payrollRunId, lineNumber])`** mirrors every other line-item table's
  convention in this codebase (`PurchaseInvoiceItem`, `VoucherEntry`, etc.).
- **Two new `CompanySettings` columns**, no shared field reused from Sales/Purchase
  Invoice's mapping (unlike Purchase Invoice reusing Sales Invoice's `roundOffLedgerId`)
  — payroll posting has no round-off line (see Ledger Posting: the two amounts are
  identical by construction, nothing to round).
- **No `PurchaseInvoicePayment`-equivalent payment-lines table.** Unlike Sales/Purchase
  Invoice, a Payroll Run never records a partial or full immediate payment at posting
  time — see Module Responsibilities and Ledger Posting: disbursement is Payment
  Voucher's job, entirely outside this spec's own tables.
- No `branchId` on `PayrollRun` — payroll in this first release is a whole-company run
  (an employee's own `branchId`, if set, is available for reporting via the `Employee`
  join; this spec does not filter or split runs by branch — see Do Not).

---

# Business Rules

## Creating a run (`DRAFT`)

- `periodStart`/`periodEnd` required, `periodStart <= periodEnd`, and the range must not
  overlap any other **non-cancelled** run for the same company (a `@@unique` cannot
  express a range-overlap rule, so this is a service-level check, re-verified again at
  posting time against current state — the same "re-validate at post, don't trust
  draft-time state" posture every document spec in this project follows). This prevents
  double-paying the same period.
- `createDraft` selects every **active** `Employee` with a non-null `basicSalary` as
  candidate lines (an employee with no `basicSalary` set is silently excluded from the
  run, not a hard error — onboarding an employee before their salary is finalized is a
  normal state; the draft's own line list shows who was excluded and why, for the
  preparer's visibility, but nothing blocks draft creation over it).
- For each candidate employee, call `attendanceService.getAttendanceSummary(employeeId,
  periodStart, periodEnd)` and compute:
  - `totalDaysInPeriod` = the number of calendar days between `periodStart` and
    `periodEnd` inclusive
  - `workedDays` = `presentDays + 0.5 x halfDays` (`ABSENT` and `ON_LEAVE` contribute
    zero — **this MVP formula treats unpaid leave and marked absence identically, and
    an unmarked day within the period identically to an absence**; a paid-leave policy,
    weekly-offs, or holiday calendar are explicitly deferred, see Do Not)
  - `netSalary` = `round(basicSalary x workedDays / totalDaysInPeriod, 2)` (rounded to
    paise, half-up — the same rounding convention as every other money computation in
    this codebase)
- A draft can be recomputed/refreshed against current Attendance data as many times as
  needed before posting (attendance for the period may still be getting corrected while
  the draft sits unposted) — recomputing replaces each line's stored
  `workedDays`/`netSalary`, it does not accumulate.

## Posting (`postPayrollRun`, one transaction)

Mirrors `44-purchase-invoice.md`'s orchestration shape, adapted — no GST, no stock, no
payment-lines step:

1. Re-validate every business rule against current state (every included employee still
   active, FY open, no overlapping non-cancelled run for the period, both ledger
   mappings valid — see Ledger Mapping Validation below).
2. **Recompute every line from current Attendance data** (never trust stale draft
   figures — the same "recompute at post time" rule Sales/Purchase Invoice apply to
   `calculateDocument`), snapshotting each employee's *current* `basicSalary` at this
   moment (not whatever it was when the draft was first created).
3. Compute `totalNetSalary` = `Σ netSalary` across all lines.
4. Generate `payrollNumber` (`ensureSequence` before the transaction, `generateNumber`
   inside it — spec 34's two-step contract).
5. Build the balanced voucher (see Ledger Posting) and call `voucherEngine.postVoucher`
   (`VoucherType.SALARY`).
6. Set `status = POSTED`, `voucherId`, `totalNetSalary`.

## Ledger Posting

- **One aggregate voucher for the whole run** — not one voucher per employee. This is a
  deliberate choice, decided and justified here: per-employee vouchers would create N
  ledger entries against the same two pooled ledgers (Salary Expense, Salary Payable)
  every run, with no per-employee ledger to distinguish them anyway (see
  `61-employee-master.md`'s Data Model — no per-employee `Ledger` exists), producing
  purely redundant voucher rows with zero reporting benefit; per-employee detail is
  fully preserved in `PayrollRunItem`, which is what any future Employee Report
  (`73-employee-reports.md`) will actually query for a person's own salary history, not
  the voucher entries. One voucher matches this project's existing "one voucher per
  document" convention (Sales Invoice, Purchase Invoice, and every manual voucher each
  produce exactly one `Voucher` row) rather than inventing a new one-to-many shape.
- **Debit**: `CompanySettings.salaryExpenseLedgerId` for `totalNetSalary`.
- **Credit**: `CompanySettings.salaryPayableLedgerId` for `totalNetSalary`.
- **No round-off, no payment lines, no Cash/Bank entry of any kind** — the two amounts
  are identical by construction (a single total moved from one ledger to another), so
  the voucher always has exactly two entries and always balances trivially. Actually
  paying employees out of the resulting Salary Payable balance is a **separate,
  later** transaction — a Payment Voucher (`52-payment-voucher.md`) debiting Salary
  Payable and crediting Cash/Bank, exactly like settling any other outside-of-billing
  liability. This spec creates no such entry itself.
- **Ledger Mapping Validation** — both mappings checked unconditionally on every
  posting (the same "Option B, not a conditional subset" decision `38`/`44` record
  verbatim for their own larger mapping sets, applied here to a two-field mapping):
  `salaryExpenseLedgerId` must be active, company-owned, and assigned to "Indirect
  Expenses" (or a descendant); `salaryPayableLedgerId` must be active, company-owned,
  and assigned to "Current Liabilities" (or a descendant, e.g. a company's own
  "Provisions"/"Salary Payable" sub-group) — a mapping pointing at an inactive,
  cross-company, or wrong-group ledger is treated identically to a missing one,
  rejected with a friendly, mapping-specific error, never silently posted against the
  wrong account.

## Cancellation

- `cancelPayrollRun(id)`: only a `POSTED` run. Calls `voucherEngine.cancelVoucher`
  (mirrored reversal, per spec 31's own contract) inside one transaction, sets
  `status = CANCELLED`. **No stock or attendance reversal** — cancelling a payroll run
  does not un-mark attendance; it only reverses the accounting entry. Correction is
  cancel + re-run for a corrected period, never an edit of a posted run — the same
  "posted documents cannot be edited" invariant every document in this project follows
  (`architecture-context.md` Invariant 2).
- A cancelled run's period becomes available again for a new non-overlapping-check
  purpose — the overlap check above only considers **non-cancelled** runs, so a
  corrected re-run for the same period after cancelling the mistaken one is not
  blocked by its own predecessor.

---

# Service / Repository

Create

```text
src/modules/payroll/repositories/payroll-run-repository.ts
src/modules/payroll/services/payroll-run-service.ts
src/modules/payroll/validation/payroll-run-schema.ts
src/modules/payroll/actions/payroll-run-actions.ts
src/modules/payroll/components/…
src/types/payroll-run.ts
// extend the existing company-settings module (specs 38/44) with the Salary Expense /
// Salary Payable ledger-mapping form section, on the same page as the existing
// Sales/Purchase GST mapping sections
```

- `payrollRunService`: `listPayrollRuns(filters)`, `getPayrollRun(id)`,
  `createDraft(input)` (selects candidate employees, computes preview lines),
  `refreshDraft(id)` (recomputes lines against current Attendance/salary data),
  `postPayrollRun(id)` (the orchestration above), `cancelPayrollRun(id)`.
- Calls `attendanceService.getAttendanceSummary` (`62-attendance.md`) directly — never
  re-implements attendance aggregation.
- The Voucher Engine call happens only inside `postPayrollRun`, never inside a Server
  Action or component (Engine Driven principle) — the exact posture of
  `postPurchaseInvoice`/`postSalesInvoice`.

---

# Validation

Zod (`payroll-run-schema.ts`): `periodStart`/`periodEnd` calendar dates with an
object-level refine `periodStart <= periodEnd`, `narration` ≤ 500. No client-authored
line array — lines are always server-computed from Employee + Attendance data, never
accepted from the client (the same "server computes, client never submits a total"
posture every other document in this project takes for its own computed fields).

---

# UI

Pages (under the `/employees` hub `62-attendance.md` establishes)

- `/employees/payroll` — Payroll Run list (Number, Period, Total Net Salary, Status,
  Actions) with search + status/date filters
- `/employees/payroll/new` — Create Payroll Run (period picker → preview table of
  candidate employees with computed worked-days/net-salary, refreshable before saving
  as Draft)
- `/employees/payroll/[id]` — View Payroll Run (read-only detail once posted, per-
    employee line breakdown, status actions: Post / Cancel — **no Edit after posting**)
- Extend the existing Company Settings ledger-mapping page (specs 38/44) with a new
  "Payroll Ledgers" section (Salary Expense, Salary Payable selectors).

Components (`src/modules/payroll/components/`): Payroll Run Table, Payroll Run Preview/
Line Table, Payroll Run Status Badge.

Wire-up

- Add a "Payroll" card to the `/employees` hub page, alongside Attendance.
- Add `payroll: "Payroll"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `employees` permission module: `view` for reads, `create` for
draft creation/refresh, `approve` for Post and Cancel (posting a payroll run commits a
real financial liability company-wide, and cancelling reverses one — the same
unconditional-`approve` posture Journal Voucher takes toward its own unrestricted entry
shape, applied here since a payroll posting has no per-line structural safeguard the
way Contra/Payment Voucher's ledger-class restriction provides), `export`. The extended
Company Settings section is gated by `settings`/`edit`, not `employees` (matching how
Purchase Invoice's own Company Settings extension is gated by `settings`, not
`purchase`).

---

# Database

New enum `PayrollRunStatus`; new models `PayrollRun`, `PayrollRunItem`; new enum values
`VoucherType.SALARY` and `DocumentType.PAYROLL`/`DocumentType.SALARY_VOUCHER` (appended,
never reordering existing values); two new nullable FK columns on `CompanySettings`. One
migration. Back-relations on `Company`, `FinancialYear`, `Employee`, `Voucher`, `User`.
No seeding.

---

# Code Standards

Strict TypeScript, no `any`, no arithmetic duplicated outside this module's own worked-
day/net-salary formula (attendance aggregation itself stays inside
`attendanceService.getAttendanceSummary`, never re-derived here), Serializable
transaction for posting and cancellation (mirroring Purchase Invoice/Stock Adjustment's
bounded-retry convention), vitest coverage for:

- the worked-day formula (`PRESENT`/`HALF_DAY`/`ABSENT`/`ON_LEAVE`/unmarked-day
  combinations against a fixture, matching hand-computed expectations)
- `netSalary` rounding (half-up to paise)
- period-overlap rejection (including that a cancelled run's period is *not* blocked)
- an employee with no `basicSalary` excluded from a draft, not erroring it
- the ledger-mapping rejection matrix (missing, inactive, cross-company, wrong-group)
  for both new mappings
- posting recomputes from current Attendance/salary data rather than trusting a stale
  draft
- cancellation's mirrored voucher reversal and status flip, atomically

---

# Do Not

Do not implement

- Employee Master or Attendance (`61`/`62`, already implemented by the time this runs)
- Any deduction (PF, ESI, TDS, loan recovery, advance adjustment)
- Overtime pay, bonuses, or any multi-component salary structure (HRA, DA, allowances) —
  a single `basicSalary` figure only
- A paid-leave policy, weekly-off/holiday calendar, or any refinement of the worked-day
  formula beyond `presentDays + 0.5 x halfDays`
- Per-employee salary disbursement, payslips, or any payment-lines table — disbursement
  is Payment Voucher's job against the posted Salary Payable ledger, entirely outside
  this spec
- Branch-wise payroll splitting or filtering (a whole-company run only in this release)
- Editing a posted run — correction is cancel + re-run only
- Any change to `voucherEngine`, `postVoucher`, or `cancelVoucher` themselves — this
  spec consumes them exactly as built, adding only the new `VoucherType.SALARY` value
  they already support generically

---

# Success Criteria

Verify

- Creating a Payroll Run for a period selects every active employee with a
  `basicSalary` set, excluding those without one, and computes `workedDays`/`netSalary`
  per the documented formula, matching a hand-computed fixture.
- Posting produces a balanced `VoucherType.SALARY` voucher (Debit Salary Expense, Credit
  Salary Payable, both equal to `totalNetSalary`) and assigns a `payrollNumber` from
  `DocumentType.PAYROLL`, atomically with the run's status flip to `POSTED`.
- A second run whose period overlaps a non-cancelled existing run is rejected; the same
  period is postable again after the earlier run is cancelled.
- Missing, inactive, cross-company, or wrong-group Salary Expense/Salary Payable Company
  Settings mappings block posting with a specific, friendly error.
- Cancelling a posted run produces a correct mirrored voucher reversal and flips status
  to `CANCELLED`, without altering any Attendance record.
- No API exists to edit a posted run.
- `/employees` hub shows a Payroll card; `/employees/payroll*` and the extended Settings
  route appear in the build route table.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 63 (this spec) is `context/Phases/phase-tracker.md`'s Phase 9 item #61 —
the last item in Phase 9. Completing specs 61–63 in order (Employee Master → Attendance
→ Payroll) closes Phase 9 in full. Employee Reports
(`73-employee-reports.md`, Phase 10 tracker #71) depends on this spec's posted
`PayrollRun`/`PayrollRunItem` data and on `61-employee-master.md`'s `Employee` records —
noted forward here, not built until Phase 10.
