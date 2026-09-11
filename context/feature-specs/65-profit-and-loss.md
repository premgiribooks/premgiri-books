# 65 - Profit & Loss

> Feature-spec file number 65 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 10 — Reporting** item **#63
> Profit & Loss**, the second of the phase's four financial reports. Depends on
> Accounting (i.e. the Ledger Groups/Ledger Master/Voucher Engine chain, all
> implemented) and, directly, on `64-trial-balance.md` — **read it first in full**. This
> spec reuses the Reporting Engine (`src/engines/reporting/`) and the `/reports` hub
> spec 64 establishes rather than re-deciding either.

## Goal

Implement **Profit & Loss** (Income Statement) for **Premgiri Books ERP** — the
period-scoped statement of Income and Expense ledger activity, split into a **Trading
Account** (Direct Income/Expense → Gross Profit) and a **Profit & Loss Account**
(Indirect Income/Expense on top of Gross Profit → Net Profit), the two-section structure
every Tally-class product this ERP's target users already know uses, and the same
structure `13-ledger-groups.md`'s own `affectsGrossProfit` flag was seeded specifically
to support.

Unlike Trial Balance (a point-in-time snapshot), Profit & Loss is **period-scoped**: a
`from`/`to` date range, typically Financial-Year-to-date but not required to start at the
FY's own start date. **Design decision, recorded here**: rather than adding a new
lower-bound parameter to `voucherEngine.getTrialBalance` (which has none — it is always
"from the FY's implicit start, up to `asOfDate`"), this spec computes an arbitrary
`[from, to]` period's movement by calling `getTrialBalance` **twice** — once with
`asOfDate = to`, once with `asOfDate` set to the calendar day immediately before `from`
— and taking the **difference** of each ledger's `totalDebit`/`totalCredit` between the
two calls. This reuses the engine's existing, already-tested primitive completely
unmodified (no engine change, Invariant 9 satisfied twice over: no new arithmetic, and
the diff is still nothing but voucher-derived sums) rather than adding a new
`voucher-queries.ts` method for a need this batch can already satisfy by composition.
When `from` equals the FY's own `startDate`, the second call's `asOfDate` (the day
before the FY starts) structurally has zero matching vouchers — every voucher's date is
validated to fall inside its own FY's range (spec 31) — so the "day before `from`" call
correctly returns all-zero totals with no special case needed; the two-call approach
therefore works uniformly for both "FY-to-date" and an arbitrary sub-period within one
FY.

**Known limitation, recorded explicitly**: a period spanning **two different Financial
Years** is out of scope for a single call of this report (`voucherEngine.getTrialBalance`
takes exactly one `financialYearId`, per spec 31). A future enhancement could call this
report once per FY the range touches and sum the results — noted as a forward
capability, not built here, since no business need for cross-FY P&L has been specified
and `09-financial-year.md`'s own Do Not list defers "Opening Balance Carry-Forward" for
the same reason (a P&L spanning a year boundary has no year-end-closing infrastructure
underneath it yet).

---

# Project Context

Before implementation, review

- `64-trial-balance.md` (**read first in full**) — the Reporting Engine location
  decision, `buildLedgerGroupIndex`/`getRootGroup`, and the exact `TrialBalanceResult`/
  `TrialBalanceRow` shape this spec diffs
- `13-ledger-groups.md` — `LedgerGroup.natureType` (`INCOME`/`EXPENSE` rows are this
  report's entire input) and `affectsGrossProfit` (`true` = Direct/Trading Account,
  `false` = Indirect/P&L Account proper) — both columns already present on every group
  row (see `64-trial-balance.md`'s Project Context note on why no parent-chain walk is
  needed for nature/gross-profit classification, only for presentation nesting)
- `31-voucher-engine.md` — `getTrialBalance`'s exact per-row shape (`totalDebit`,
  `totalCredit`, debit-positive `closingBalance`) and its FY-scoping behavior
  (`aggregateEntriesByLedger` filters by `financialYearId` with an optional
  `voucherDate <= asOfDate` upper bound and **no independent lower bound** — confirmed
  from the live `voucher-repository.ts` — which is exactly what makes the two-call diff
  approach above correct)

---

# Module Responsibilities

The Profit & Loss module is responsible for

- A read-only Profit & Loss screen: pick a Financial Year and a `from`/`to` date range
  (defaulting to FY-to-date), see Direct Income/Expense (Trading Account, Gross Profit)
  and Indirect Income/Expense (P&L Account, Net Profit) for that period
- Its own Reporting Engine function, `src/engines/reporting/profit-and-loss.ts`, added
  alongside `64-trial-balance.md`'s `trial-balance.ts` in the same engine directory

The Profit & Loss module is **not** responsible for

- Trial Balance, Balance Sheet, or Cash Flow (`64`, `66`, `67`)
- Any ledger-balance arithmetic beyond diffing two `getTrialBalance` calls (no new
  engine query method, no independent entry summation)
- Multi-FY period aggregation (see Goal's Known Limitation)

---

# Data Model

**No new Prisma model, enum, or migration.** Pure read/aggregation over the already-
implemented `LedgerGroup`/`Ledger`/`Voucher`/`VoucherEntry` tables via
`voucherEngine.getTrialBalance`, matching Invariants 3 and 9.

---

# Business Rules

- **Scope to `INCOME`/`EXPENSE`-nature ledgers only.** `ASSET`/`LIABILITY`-nature rows
  from the two `getTrialBalance` calls are fetched (they must be, since the same call
  returns every ledger) but discarded before building the report — this report's output
  is Income/Expense only.
- **Period movement per ledger** = `(totalDebit_to − totalDebit_beforeFrom)` and
  `(totalCredit_to − totalCredit_beforeFrom)`, using **`totalDebit`/`totalCredit`, never
  `closingBalance`** — `closingBalance` folds in `Ledger.openingBalance`, which for an
  Income/Expense ledger should always be `0` but this report must not assume that
  silently; using the raw period-diffed debit/credit sums is correct regardless.
- **Presentation value per ledger**: an `INCOME`-nature ledger's natural balance is
  Credit, so its period value is `periodCredit − periodDebit` (a return/reversal
  correctly nets against it); an `EXPENSE`-nature ledger's natural balance is Debit, so
  its period value is `periodDebit − periodCredit`. A negative result (e.g. an Expense
  ledger with more credits than debits in the period — an unusual but not impossible
  refund/correction pattern) is displayed as a negative figure, not clamped to zero —
  hiding it would misstate the period's actual movement.
- **Trading Account** (Gross Profit) = Σ(Direct Income ledger values, `affectsGrossProfit
  = true` + `natureType = INCOME`) − Σ(Direct Expense ledger values, `affectsGrossProfit
  = true` + `natureType = EXPENSE`).
- **Profit & Loss Account** (Net Profit) = Gross Profit + Σ(Indirect Income ledger
  values, `affectsGrossProfit = false` + `INCOME`) − Σ(Indirect Expense ledger values,
  `affectsGrossProfit = false` + `EXPENSE`) — the standard two-tier Trading/P&L
  structure; a company with no custom groups still produces a correct result from the
  23 seeded groups alone (`Sales Accounts`/`Direct Incomes`/`Purchase Accounts`/`Direct
  Expenses` all seed `affectsGrossProfit = true`; `Indirect Incomes`/`Indirect Expenses`
  seed `false`, per `13-ledger-groups.md`'s Default Group Seeding table).
- **A ledger group with zero period activity for every one of its ledgers is omitted**
  from the rendered report (unlike Trial Balance, which always lists every ledger for
  completeness — a P&L with a hundred zero-value expense-head rows for a short period is
  noise, not signal); the Gross/Net Profit totals are unaffected either way since a
  zero-value row contributes zero to the sum.
- **Company-scoped**, identical posture to every spec in this project.

---

# Engine

Create

```text
src/engines/reporting/profit-and-loss.ts   // buildProfitAndLossReport (pure)
```

- `buildProfitAndLossReport(periodRows: ProfitAndLossLedgerMovement[], groups:
  LedgerGroup[]): ProfitAndLossReport` — pure function, no I/O. Input
  `ProfitAndLossLedgerMovement` = `{ ledgerId, ledgerName, ledgerGroupId, periodDebit,
  periodCredit }` (the diffed totals — see Service below for how the caller produces
  these). Groups rows into `directIncome`/`directExpense`/`indirectIncome`/
  `indirectExpense` sections (reusing `64-trial-balance.md`'s
  `buildLedgerGroupIndex`/nesting approach for sub-group rollups within each of the four
  buckets), computes `grossProfit` and `netProfit`, and returns
  `{ directIncome, directExpense, indirectIncome, indirectExpense, grossProfit,
  netProfit }`.

`src/modules/reports/services/profit-and-loss-service.ts`
(`profitAndLossService.getProfitAndLoss(companyId, financialYearId, from, to)`): the only
I/O — resolves the Financial Year (re-validating `from`/`to` fall inside its range),
calls `voucherQueries.getTrialBalance(companyId, financialYearId, to)` and
`voucherQueries.getTrialBalance(companyId, financialYearId, dayBefore(from))` in
parallel, diffs each ledger's `totalDebit`/`totalCredit` between the two results
(a ledger present in one result and not the other — impossible in practice since
`getTrialBalance` always lists every company ledger in both calls — is treated as zero
for the missing side, defensively), filters to `INCOME`/`EXPENSE`-nature ledgers via
`ledgerGroupRepository.findMany(companyId)`, and calls `buildProfitAndLossReport`.

---

# Validation

Zod: extends `64-trial-balance.md`'s shared `financial-report-filters-schema.ts` with a
`from`/`to` variant (`financialYearId` uuid required, `from`/`to` calendar dates, `to >=
from`, both re-validated server-side against the resolved FY's own date range) — no new
schema file.

---

# UI

Pages (under the `/reports` hub established by `64-trial-balance.md`)

- `/reports/profit-and-loss` — Profit & Loss screen: Financial Year selector, a
  `from`/`to` range picker defaulting to `[FY.startDate, today]`, a two-section layout
  (Trading Account with its own Gross Profit subtotal; Profit & Loss Account continuing
  from Gross Profit down to Net Profit), each section's Income/Expense rows grouped by
  Ledger Group with subtotals (reusing `64-trial-balance.md`'s Trial Balance Group Tree
  presentation component, parameterized). A **Net Profit/Loss** figure is visually
  distinguished (green/red or equivalent) since either sign is a valid, expected result.
  An Export action, present but delegating to the not-yet-built Excel Export feature
  (Phase 11, #75), identical posture to spec 64's own.

Components (`src/modules/reports/components/`): Profit & Loss Statement (composes
`64-trial-balance.md`'s group-tree renderer for each of the four sections), reusing the
Financial Year + Date Range Filter Bar (a `from`/`to` variant of spec 64's own filter
bar) and the shared Report Export Button.

Wire-up

- Wire the `/reports` hub page's "Profit & Loss" card (added, unlinked, by spec 64) to
  `/reports/profit-and-loss`.
- Add `"profit-and-loss": "Profit & Loss"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `reports` permission module: `view`, `export`. No `create`/`edit`/`delete`/
`approve` — read-only (Invariant 3). Company-scoped identically to every spec in this
project.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, `profit-and-loss.ts` fully pure and unit-tested, vitest
coverage for:

- `buildProfitAndLossReport` against a seeded fixture spanning Direct and Indirect
  Income/Expense groups, asserting Gross Profit = Direct Income − Direct Expense and Net
  Profit = Gross Profit + Indirect Income − Indirect Expense exactly
- The two-call diff correctly isolates period-only movement (a ledger with prior-period
  activity before `from` must not leak into the period total)
- `from` equal to the FY's own `startDate` produces the same result as an explicit
  "since inception" P&L (the "day before FY start has zero vouchers" edge case)
- A negative Expense-ledger period value (more credits than debits) displays as negative,
  not clamped to zero
- A zero-activity group is omitted from the rendered report but does not affect
  Gross/Net Profit
- `from`/`to` validated against the resolved Financial Year's own date range
- Cross-company isolation

---

# Do Not

Do not implement

- Trial Balance, Balance Sheet, or Cash Flow (`64`, `66`, `67`)
- A new `voucher-queries.ts` method for period movement (the two-call diff is
  sufficient and reuses `getTrialBalance` unmodified)
- Multi-Financial-Year period aggregation (see Goal's Known Limitation)
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76)
- Any change to `voucherEngine` itself

---

# Success Criteria

Verify

- Gross Profit and Net Profit are computed correctly against a seeded fixture spanning
  Direct and Indirect Income/Expense groups, matching a hand-computed expectation.
- A period's Income/Expense figures reflect only that period's voucher activity, never
  activity before `from` or after `to`.
- `from`/`to` outside the selected Financial Year's date range is rejected.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/profit-and-loss` appears in the build route table.

Feature-spec 65 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #63 and
reuses the Reporting Engine `64-trial-balance.md` establishes. Feature-specs 66 (Balance
Sheet, tracker #64) and 67 (Cash Flow, tracker #65) reuse it too, each adding its own file
under `src/engines/reporting/` rather than re-deciding the engine's location.
