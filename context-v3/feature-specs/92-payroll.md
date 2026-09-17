# 92 - Payroll

> Feature-spec file number 92 (v3 sequence, continuing from spec 91).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 1 — Carry-Over
> Completions**, tracker item **#83 Payroll**.
>
> This is a carry-over from v2: the feature was fully spec-drafted as
> `context/feature-specs/63-payroll.md` (v2 spec 63, v2 tracker #61) but was never
> implemented — Phase 9 was left deliberately open when the user chose to skip ahead
> to Trial Balance. The v2 spec is the authoritative design — read it in full.
>
> Depends On: Attendance (v2 #60, spec 62); Employee Master (v2 #59, spec 61).
> Both dependencies are fully implemented in v2.

## Goal

Implement **Payroll** for Premgiri Books ERP — the period-based, numbered document that
aggregates Attendance records for a chosen period, computes each active employee's net
salary (based on days present vs working days in the period), generates a
`PayrollRunItem` per employee, and posts a balanced accounting voucher through the
Voucher Engine.

A Payroll Run: creates a `PayrollRun` document → computes per-employee net pay →
saves as DRAFT → posts (Voucher Engine: Debit Salary Expense, Credit Salary Payable) →
locks items → can be cancelled with reversal.

---

## Project Context

Read before implementation:

1. `context/feature-specs/63-payroll.md` — v2 spec; **read in full**. This v3 spec is a
   wrapper. All detailed design lives in the v2 spec.
2. `context/feature-specs/62-attendance.md` — `getAttendanceSummary(companyId,
   employeeIds, dateFrom, dateTo)` is the data source for net-pay calculation.
3. `context/feature-specs/61-employee-master.md` — `Employee.basicSalary` and
   `Employee.salaryType` drive the pay calculation.
4. `context/feature-specs/31-voucher-engine.md` — `postVoucher()` is called at posting.
5. `context/feature-specs/34-document-number-engine.md` — `DocumentType.PAYROLL_RUN`.
6. `context/architecture-context.md` (v2) — Voucher Driven: every payroll run that
   posts must generate a balanced accounting voucher.

---

## Module Responsibilities

- `PayrollRun` document — period (dateFrom/dateTo), status lifecycle
  (DRAFT → POSTED → CANCELLED)
- `PayrollRunItem` per employee — workingDays, presentDays, absentDays, basicSalary,
  deductions, netPay, computed from Attendance
- Payroll Engine (`src/engines/payroll/` or within the Voucher Engine) — `computePayroll()`
  is a pure function: takes attendance summary + employee salary data, returns
  per-employee net pay
- Voucher posting: Debit `CompanySettings.salaryExpenseLedgerId`, Credit
  `CompanySettings.salaryPayableLedgerId` (both already exist in the schema per the
  progress-tracker's Payroll notes)
- `/employees/payroll` hub page, `/employees/payroll/new`, `/employees/payroll/[id]`

---

## Data Model

The `PayrollRun` and `PayrollRunItem` models are already partially present in the
Prisma schema (back-relations exist on `Company` and `FinancialYear`). This spec
adds the full model definition.

```prisma
enum PayrollRunStatus {
  DRAFT
  POSTED
  CANCELLED
}

model PayrollRun {
  id              String          @id @default(uuid())
  companyId       String
  financialYearId String
  branchId        String?
  runNumber       String?         // null until posted (Document Number Engine)
  periodFrom      DateTime
  periodTo        DateTime
  workingDays     Int             // denominator for pro-rata calculation
  totalGrossPay   Decimal         @db.Decimal(15, 2)
  totalDeductions Decimal         @db.Decimal(15, 2)
  totalNetPay     Decimal         @db.Decimal(15, 2)
  status          PayrollRunStatus @default(DRAFT)
  voucherId       String?         // set at posting
  narration       String?
  createdBy       String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  company       Company       @relation(...)
  financialYear FinancialYear @relation(...)
  voucher       Voucher?      @relation(...)
  items         PayrollRunItem[]
}

model PayrollRunItem {
  id            String   @id @default(uuid())
  payrollRunId  String
  employeeId    String
  presentDays   Int
  absentDays    Int
  basicSalary   Decimal  @db.Decimal(15, 2)
  grossPay      Decimal  @db.Decimal(15, 2)
  deductions    Decimal  @db.Decimal(15, 2) @default(0)
  netPay        Decimal  @db.Decimal(15, 2)
  createdAt     DateTime @default(now())

  payrollRun PayrollRun @relation(...)
  employee   Employee   @relation(...)
}
```

---

## Business Rules

1. One payroll run per company per period — overlapping periods are rejected.
2. Only active employees are included; employees deactivated before the period are
   excluded automatically.
3. `netPay = (basicSalary / workingDays) * presentDays - deductions`
4. Posting requires both `salaryExpenseLedgerId` and `salaryPayableLedgerId` to be
   configured in `CompanySettings`.
5. Posted payroll runs are immutable — cancellation creates reversal voucher entries.
6. A cancelled payroll run for the same period may be replaced with a new one.

---

## Validation Rules

- `periodFrom` must be before `periodTo`.
- `workingDays` must be a positive integer ≤ 31.
- Both Salary Expense and Salary Payable ledger mappings must be present and active
  before posting — rejection mirrors Sales Invoice's own missing-ledger-mapping error.
- The period must fall within the selected Financial Year's date range.

---

## API / Server Actions

- `payrollActions.createPayrollRun(input)` — creates DRAFT; calls `computePayroll()`
- `payrollActions.postPayrollRun(id)` — calls `voucherEngine.postVoucher()`
- `payrollActions.cancelPayrollRun(id)` — calls `voucherEngine.cancelVoucher()`
- `payrollActions.listPayrollRuns(companyId, filters)` — paginated list

---

## UI

- `/employees/payroll` — list of payroll runs with status badges
- `/employees/payroll/new` — period selector, working-days input, preview table of
  per-employee gross/net pay before saving as DRAFT
- `/employees/payroll/[id]` — run detail: per-employee breakdown, Post/Cancel actions
- Add "Payroll" card to the `/employees` hub page

---

## Security Considerations

- `computePayroll()` must re-read employee salary and attendance data inside the
  posting transaction — never trust the DRAFT's pre-computed values for the final voucher.
- Both ledger mappings validated at posting time, not just at draft time.
- Payroll runs are scoped to `companyId` at every repository query.

---

## Testing Requirements

- `computePayroll()` pure function: present/absent day scenarios, zero present days,
  pro-rata accuracy for partial months
- Period overlap rejection
- Missing ledger mapping rejection (both ledgers)
- Voucher entries verified: Debit Salary Expense, Credit Salary Payable, balanced
- Cancellation reversal entries
- Cross-company isolation
