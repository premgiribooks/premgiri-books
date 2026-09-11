# 66 - Balance Sheet

> Feature-spec file number 66 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 10 — Reporting** item **#64
> Balance Sheet**, the third of the phase's four financial reports. Depends on
> Accounting (implemented) and, directly, on `64-trial-balance.md` and
> `65-profit-and-loss.md` — **read both first in full**. This spec reuses the Reporting
> Engine and `/reports` hub `64-trial-balance.md` establishes.

## Goal

Implement **Balance Sheet** for **Premgiri Books ERP** — the as-of-a-date statement of
Assets, Liabilities, and Equity that must always balance (Assets === Liabilities +
Equity), rendered in the traditional two-sided **Indian/Tally-style format**
(Liabilities side: Capital, Reserves & Surplus, Loans, Current Liabilities; Assets side:
Fixed Assets, Investments, Current Assets, Misc. Expenses) rather than the Western
"Assets = Liabilities + Equity" three-part layout — because that is exactly the shape
`13-ledger-groups.md`'s own 23-group seeded chart of accounts already uses.

**The classification gap this batch's own research brief flagged, resolved — no schema
change needed.** The brief asked this spec to determine whether `LedgerGroup` needs a
new `groupNature`/`headType` field beyond its existing entry-level `accountNature`
(`BalanceType` on `VoucherEntry`, DEBIT/CREDIT) to classify each group under a statutory
Balance-Sheet head. **It does not.** `LedgerGroup.natureType` (`AccountNature`:
`ASSET`/`LIABILITY`/`INCOME`/`EXPENSE`, `13-ledger-groups.md`) already **is** that
classification field, present on every group row (not just top-level ones — inherited
and copied at creation time, per spec 13's own Business Rules), and the seeded skeleton
already places "Capital Account" and "Reserves & Surplus" under `natureType = LIABILITY`
— exactly where Equity belongs in the Indian two-sided presentation this ERP's target
users expect (Equity is not a separate statutory column in that format; it is presented
as the top of the Liabilities side). **Decision, recorded**: no new `LedgerGroup` field,
no migration. The only thing this report computes that the schema doesn't already store
is the **current-period Profit & Loss plug** (see Business Rules) — a derived display
line, never persisted.

---

# Project Context

Before implementation, review

- `64-trial-balance.md` and `65-profit-and-loss.md` (**read both first in full**) — the
  Reporting Engine location decision, `buildLedgerGroupIndex`, and
  `65-profit-and-loss.md`'s Gross/Net Profit computation, which this spec's plug line
  reuses directly rather than re-deriving
- `13-ledger-groups.md` — the full 23-group Default Group Seeding table (**re-read it
  here**): `Capital Account`, `Reserves & Surplus`, `Loans (Liability)` (+ its two
  children), `Current Liabilities` (+ its three children) are all `natureType =
  LIABILITY`; `Fixed Assets`, `Investments`, `Current Assets` (+ its four children),
  `Misc. Expenses (Asset)` are all `natureType = ASSET` — this exact seeded structure is
  what this spec's two-sided layout renders directly, with no re-derivation
- `31-voucher-engine.md` — `getTrialBalance`'s debit-positive `closingBalance`
  convention (a `LIABILITY`-nature ledger's natural credit balance therefore appears as
  a **negative** `closingBalance`, and must be sign-flipped for display — the same for
  `INCOME`-nature ledgers, relevant to this spec's own P&L plug)
- `09-financial-year.md` — confirms no year-end closing/opening-balance carry-forward
  exists yet (its own Do Not list) — directly relevant to this spec's Known Limitation
  below

**Known Limitation, recorded explicitly (a real, pre-existing gap in already-implemented
infrastructure, not something this spec fixes):** because `voucherEngine.getTrialBalance`
is scoped to exactly one `financialYearId` (its `aggregateEntriesByLedger` repository
call filters by `financialYearId`, with `Ledger.openingBalance` as the *only* static
carry-in), a Balance Sheet run for a Financial Year **after** the company's first one
will not include prior years' postings unless a business manually re-entered an
appropriate `Ledger.openingBalance` for that later year — there is no automated
year-end-closing step that rolls Year 1's closing Asset/Liability balances into Year 2's
`Ledger.openingBalance`. This is `09-financial-year.md`'s own recorded Do Not
("Opening Balance Carry-Forward" is explicitly future work), not a defect this spec
introduces or is expected to fix — flagged here because a Balance Sheet is exactly the
report where the gap becomes user-visible (a second-year company's Balance Sheet would
silently understate/misstate Asset and Liability balances carried from Year 1 unless
opening balances were manually corrected when Year 2 was created). Named as a follow-up
for whichever future spec finally builds Financial-Year closing.

---

# Module Responsibilities

The Balance Sheet module is responsible for

- A read-only Balance Sheet screen: pick a Financial Year and an as-of date, see the
  two-sided Liabilities/Assets statement with a Profit & Loss plug line, always
  balancing
- Its own Reporting Engine function, `src/engines/reporting/balance-sheet.ts`

The Balance Sheet module is **not** responsible for

- Trial Balance, Profit & Loss, or Cash Flow (`64`, `65`, `67`)
- Any new `LedgerGroup` schema field (see Goal — resolved, none needed)
- Year-end closing or opening-balance carry-forward (see Known Limitation — remains
  `09-financial-year.md`'s own deferred scope)

---

# Data Model

**No new Prisma model, enum, field, or migration.** `LedgerGroup.natureType` already
provides the classification this report needs (see Goal). Pure read/aggregation over
already-implemented tables, matching Invariants 3 and 9.

---

# Business Rules

- **One `getTrialBalance(companyId, financialYearId, asOfDate)` call** supplies every
  figure this report needs — unlike Profit & Loss's two-call diff, a Balance Sheet is a
  point-in-time snapshot, exactly what `getTrialBalance`'s single `asOfDate` parameter
  already computes.
- **Assets side** = every `ASSET`-nature ledger's `closingBalance`, used directly (an
  Asset ledger's natural balance is Debit, so a positive debit-positive
  `closingBalance` already reads as the correct positive asset value).
- **Liabilities side (raw)** = every `LIABILITY`-nature ledger's `closingBalance`,
  **sign-flipped** (`-closingBalance`) — a Liability ledger's natural balance is Credit,
  so its debit-positive `closingBalance` is typically negative; flipping it yields the
  correct positive liability value for display.
- **Current-Period Profit & Loss plug**: computed by calling
  `65-profit-and-loss.md`'s own `profitAndLossService.getProfitAndLoss(companyId,
  financialYearId, financialYear.startDate, asOfDate)` (FY-to-date, ending exactly at
  this report's own as-of date) and taking its `netProfit` figure — **never
  re-derived independently** from `INCOME`/`EXPENSE`-nature rows a second time in this
  module (code-standards.md: never duplicate business logic; this spec calls spec 65's
  service, it does not re-implement its Gross/Net Profit math). This net figure is
  rendered as a single "Profit & Loss Account (Current Period)" line **added to the
  Liabilities side** (a profit increases owner's equity, i.e. what the business owes
  back to its owner; a loss — a negative `netProfit` — reduces that line, shown as a
  negative/deduction figure, never hidden).
- **Balancing identity** (must hold exactly, and is asserted as a Success Criterion, not
  merely hoped for): `Σ Assets side === Σ Liabilities side (raw) + Current-Period P&L
  plug`. This holds by construction of double-entry bookkeeping — every voucher's debits
  equal its credits, and every ledger is exactly one of `ASSET`/`LIABILITY`/`INCOME`/
  `EXPENSE` in nature, so the sum of all four nature-buckets' signed contributions is
  always zero; rearranging that identity is exactly the Assets `===` Liabilities + Net
  Profit equation above. If the two sides ever disagree in a real run, that indicates a
  data-integrity bug elsewhere (e.g. a ledger reassigned to a different nature after
  vouchers were posted against it — which `13-ledger-groups.md`'s own immutability rule
  on `natureType`/`parentGroupId` is specifically designed to prevent), not a bug in this
  report's own math.
- **As-of date** validated against the resolved Financial Year's own `[startDate,
  endDate]` range, identical to `64-trial-balance.md`'s own rule.
- **Company-scoped**, identical posture to every spec in this project.

---

# Engine

Create

```text
src/engines/reporting/balance-sheet.ts   // buildBalanceSheetReport (pure)
```

- `buildBalanceSheetReport(result: TrialBalanceResult, netProfit: number, groups:
  LedgerGroup[]): BalanceSheetReport` — pure function. Filters `result.rows` to
  `ASSET`-nature (direct value) and `LIABILITY`-nature (sign-flipped value), groups each
  side under its `LedgerGroup` hierarchy exactly like `64-trial-balance.md`'s
  `buildTrialBalanceReport` (reusing `buildLedgerGroupIndex`), appends the
  `netProfit` figure as a synthetic "Profit & Loss Account (Current Period)" leaf under
  the Liabilities side, and returns `{ assets: BalanceSheetSection[], liabilities:
  BalanceSheetSection[], totalAssets, totalLiabilities, netProfit, isBalanced: boolean }`
  where `isBalanced = totalAssets === totalLiabilities` (both rounded to 2 decimals) —
  rendered as a visible integrity indicator, not silently assumed true.

`src/modules/reports/services/balance-sheet-service.ts`
(`balanceSheetService.getBalanceSheet(companyId, financialYearId, asOfDate)`): the only
I/O — resolves the Financial Year (re-validating `asOfDate` against its range), calls
`voucherQueries.getTrialBalance(companyId, financialYearId, asOfDate)` and
`profitAndLossService.getProfitAndLoss(companyId, financialYearId,
financialYear.startDate, asOfDate)` in parallel, and `ledgerGroupRepository.findMany`,
then calls `buildBalanceSheetReport`.

---

# Validation

Zod: reuses `64-trial-balance.md`'s shared `financial-report-filters-schema.ts`
as-of-date variant verbatim — no new schema file.

---

# UI

Pages (under the `/reports` hub)

- `/reports/balance-sheet` — Balance Sheet screen: Financial Year selector, as-of-date
  picker, a two-column layout (Liabilities on the left per Indian convention, Assets on
  the right), each column grouped by Ledger Group with subtotals (reusing
  `64-trial-balance.md`'s group-tree renderer), the "Profit & Loss Account (Current
  Period)" line visible under Liabilities, and a grand-total row per side with a visible
  balanced/unbalanced indicator (`isBalanced`). An Export action, present but delegating
  to the not-yet-built Excel Export feature (Phase 11, #75), identical posture to specs
  64/65.

Components (`src/modules/reports/components/`): Balance Sheet Statement (two-column
composition of spec 64's group-tree renderer), reusing the As-Of-Date Filter Bar and the
shared Report Export Button.

Wire-up

- Wire the `/reports` hub page's "Balance Sheet" card (added, unlinked, by spec 64) to
  `/reports/balance-sheet`.
- Add `"balance-sheet": "Balance Sheet"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `reports` permission module: `view`, `export`. No `create`/`edit`/`delete`/
`approve` — read-only (Invariant 3). Company-scoped identically to every spec in this
project.

---

# Database

**No new model, enum, field, or migration.** See Data Model and Goal.

---

# Code Standards

Strict TypeScript, no `any`, `balance-sheet.ts` fully pure and unit-tested, vitest
coverage for:

- `buildBalanceSheetReport` against a seeded fixture asserting Assets total exactly
  equals Liabilities total (raw) plus the Net Profit plug, for both a profitable and a
  loss-making fixture
- A `LIABILITY`-nature ledger's negative debit-positive `closingBalance` is correctly
  sign-flipped to a positive displayed liability value
- The Profit & Loss plug is read from `profitAndLossService.getProfitAndLoss`'s own
  `netProfit` output, never independently recomputed (assert the service is called with
  the correct `from`/`to`, not that the numbers merely happen to match)
- `isBalanced` correctly flags `false` for a deliberately-corrupted fixture (e.g. a
  ledger's nature is force-mismatched in the test only, not achievable via the real UI)
  to confirm the check is real, not a hardcoded `true`
- As-of date validated against the resolved Financial Year's own date range
- Cross-company isolation

---

# Do Not

Do not implement

- Trial Balance, Profit & Loss, or Cash Flow (`64`, `65`, `67`)
- A new `LedgerGroup.groupNature`/`headType` field or any migration (see Goal — resolved,
  `natureType` already suffices)
- Year-end closing or opening-balance carry-forward (see Known Limitation)
- An independent Net Profit computation inside this module (always delegates to
  `65-profit-and-loss.md`'s own service)
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76)
- Any change to `voucherEngine` itself

---

# Success Criteria

Verify

- Assets total exactly equals Liabilities total (including the Current-Period P&L plug)
  for a seeded fixture, both profitable and loss-making.
- A `LIABILITY`/`INCOME`-nature ledger's natural credit balance renders as a positive
  value on the correct side; an `ASSET`/`EXPENSE`-nature ledger's natural debit balance
  renders as a positive value on its own correct side.
- The Net Profit plug line always matches `65-profit-and-loss.md`'s own
  `getProfitAndLoss` output for the same FY-to-date range — no independent
  recomputation exists anywhere in this module (grep-able).
- As-of date outside the selected Financial Year's date range is rejected.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/balance-sheet` appears in the build route table.

Feature-spec 66 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #64 and
reuses the Reporting Engine `64-trial-balance.md` establishes and the Net Profit figure
`65-profit-and-loss.md` computes. Feature-spec 67 (Cash Flow, tracker #65) also reuses
the Reporting Engine, adding its own file under `src/engines/reporting/`.
