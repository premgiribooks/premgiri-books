# 64 - Trial Balance

> Feature-spec file number 64 (spec-file numbers are sequential and never reused — the
> highest prior file was `63-payroll.md`). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 10 — Reporting** item **#62 Trial Balance** —
> the first of the phase's eleven items (#62–#72) and the first of its four **financial
> reports** (#62–#65, this spec plus `65-profit-and-loss.md`, `66-balance-sheet.md`,
> `67-cash-flow.md`). Depends on the Voucher Engine (feature-spec 31, implemented) and,
> transitively, on Ledger Groups (feature-spec 13) and Ledger Master (feature-spec 14),
> both implemented. **Read `31-voucher-engine.md` first in full** — this spec is a UI +
> thin-presentation layer directly over its already-implemented
> `voucherEngine.getTrialBalance(companyId, financialYearId, asOfDate?)` query API, not
> new engine-level arithmetic.

## Goal

Implement **Trial Balance** for **Premgiri Books ERP** — the classic list of every
ledger's closing balance as of a chosen date, split Debit/Credit, that must always
balance (Σ Debit === Σ Credit) by construction of double-entry bookkeeping. This is the
first, most direct consumer of the Voucher Engine's own trial-balance primitive
(`getTrialBalance`, already implemented and unconsumed by any UI) and the foundation the
other three financial reports in this phase build on.

**This spec makes the one open architectural decision `ai-workflow-rules.md` and
`architecture-context.md` have both named since day one but nothing has built yet: where
the Reporting Engine lives.** `architecture-context.md`'s Core Engines section lists a
Reporting Engine (Dashboard, Financial Reports, Sales/Purchase/Inventory/GST Reports,
Excel/PDF Export) and the Engine Usage Rules table maps "Reports → Reporting Engine"
exactly the way "Accounting → Voucher Engine" is mapped — but `src/engines/` has never
had a `reporting/` directory. **Decision, recorded here once, referenced (not
re-decided) by `65-profit-and-loss.md`, `66-balance-sheet.md`, and `67-cash-flow.md`**:
this spec introduces `src/engines/reporting/` as a real engine directory containing
**pure, stateless aggregation/shaping functions** — no schema, no I/O, no permission
checks (the same "engine" convention `30-pricing-engine.md`, `33-gst-engine.md`, and
`57-gst-registers.md`'s own GST-namespace aggregation functions already established) —
that take already-fetched data from `voucherEngine`'s query APIs (never re-deriving
ledger-balance arithmetic, Invariant 9: "Accounting reports derive data only from
vouchers") and shape it into report-ready sections/totals. Trial Balance is the natural
first tenant because it is the thinnest of the four: `voucherEngine.getTrialBalance`
already computes every number this report needs; the Reporting Engine's own job here is
purely **presentational aggregation** — grouping the flat per-ledger rows under their
`LedgerGroup` hierarchy with subtotals, something `getTrialBalance` itself deliberately
does not do (it returns a flat, ledger-level array; grouping is a reporting concern, not
an accounting one).

---

# Project Context

Before implementation, review

- `31-voucher-engine.md` (**read first in full**) — `getTrialBalance(companyId,
  financialYearId, asOfDate?)`. Its exact current return shape, confirmed from the live
  `src/engines/voucher/types.ts` and `voucher-queries.ts`:

  ```text
  interface TrialBalanceRow {
    ledgerId: string; ledgerName: string; ledgerGroupId: string;
    openingBalance: number; openingBalanceType: "DEBIT" | "CREDIT";
    totalDebit: number; totalCredit: number;
    closingBalance: number; // debit-positive: Ledger.openingBalance (signed) + Σdebits − Σcredits
  }
  interface TrialBalanceResult { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; }
  ```

  Note precisely what `getTrialBalance` already does, so this spec does not re-derive
  it: it lists **every ledger in the company**, including zero-activity ones (`rows`
  always has one entry per `Ledger`); `totalDebit`/`totalCredit` on the *result* are
  **not** the sum of every row's own `totalDebit`/`totalCredit` columns — they are
  computed by splitting rows into non-negative-`closingBalance` vs. negative-
  `closingBalance` buckets (see the engine's own source), which is what makes the
  Debit/Credit totals equal by construction. This spec's presentation layer must not
  recompute this differently.
- `13-ledger-groups.md` — the `LedgerGroup` model: `natureType` (`AccountNature`:
  `ASSET`/`LIABILITY`/`INCOME`/`EXPENSE`) and `affectsGrossProfit` are present on **every**
  group row, not just top-level ones — a sub-group's Business Rules state it "always
  inherits its parent's `natureType` and `affectsGrossProfit`" **at creation time**,
  meaning both columns are copied onto the child row itself, not merely implied by
  walking `parentGroupId`. This spec (and `65`/`66`) therefore classify a ledger's
  nature with a single `ledger.ledgerGroup.natureType` read — no parent-chain walk
  needed for nature; a walk is only needed for *presentation nesting* (rendering a group
  under its ancestor headings) and, in `67-cash-flow.md`, for finding a ledger's
  **top-level (root) group name**.
- `09-financial-year.md` — `FinancialYear.startDate`/`endDate`/`isCurrent`/`isClosed`;
  every `Voucher.voucherDate` is validated (spec 31) to fall inside its own
  `financialYearId`'s inclusive range, so `getTrialBalance`'s per-FY scoping is always
  well-formed.
- `52-payment-voucher.md` (for the `/accounting`-hub precedent this spec's own `/reports`
  hub follows) and `57-gst-registers.md` (for the "hub page with cards for every sibling
  report, some unwired" precedent this spec's own `/reports` hub follows too).

---

# Module Responsibilities

The Trial Balance module is responsible for

- A read-only Trial Balance screen: pick a Financial Year and an as-of date, see every
  ledger's Debit/Credit closing balance, grouped under its Ledger Group hierarchy with
  subtotals, with a grand total that always balances
- Introducing `src/engines/reporting/` and this batch's shared types/grouping helper
  (`ledger-classification.ts`, `types.ts`) that `65`–`67` all reuse
- The `/reports` hub page (new — the Sidebar's "Reports" entry currently has no `href`,
  exactly the state GST's Sidebar entry was in before `57-gst-registers.md`)

The Trial Balance module is **not** responsible for

- Any accounting arithmetic (`voucherEngine.getTrialBalance` already computes every
  figure this report shows — this module only fetches, groups, and renders)
- Profit & Loss, Balance Sheet, or Cash Flow (`65`–`67`)
- Sales/Purchase/Inventory/Customer/Supplier/Employee/GST Reports (tracker #66–#72,
  spec files 68–74 — a sibling batch, drafted separately; this spec's `/reports` hub adds
  placeholder cards for all of them, matching `57-gst-registers.md`'s own "hub exists
  before every sibling screen does" precedent)
- Excel/PDF export (Phase 11, #75/#76 — forward-noted only, see UI)

---

# Data Model

**No new Prisma model, enum, or migration.** Trial Balance is a pure read/presentation
layer over `voucherEngine.getTrialBalance` and the already-implemented `LedgerGroup`
tree — matching Invariant 3 ("Reports are read-only") and Invariant 9 ("Accounting
reports derive data only from vouchers"), the same "no schema" posture
`57-gst-registers.md` established for GST's own report batch.

---

# Business Rules

- **Only `voucherEngine.getTrialBalance`'s own output is ever displayed** — this module
  performs zero independent balance arithmetic. Grouping/subtotaling in
  `src/engines/reporting/trial-balance.ts` operates only on numbers `getTrialBalance`
  already returned.
- **Grouping**: every `TrialBalanceRow` is placed under its `ledgerGroupId`'s
  `LedgerGroup`, and every group is placed under its `parentGroupId` chain up to a
  top-level group, producing a tree of sections (Fixed Assets, Investments, Current
  Assets, …) each with a Debit/Credit subtotal (`Σ` of that group's own ledgers plus all
  descendant groups' subtotals). A group with zero ledgers and zero descendant activity
  still renders (with a zero subtotal) if it has at least one ledger assigned anywhere in
  its subtree, and is omitted entirely otherwise — an empty branch adds no signal to a
  Trial Balance.
- **Presentation sign**: `closingBalance` is debit-positive from the engine. A row with
  `closingBalance >= 0` displays under the Debit column at that value; a row with
  `closingBalance < 0` displays under the Credit column at `Math.abs(closingBalance)` —
  identical to how `getTrialBalance`'s own `totalDebit`/`totalCredit` result fields are
  already computed, so the grand total row always equals those two result fields exactly
  (a test-worthy identity: the report's own displayed grand total must equal
  `TrialBalanceResult.totalDebit`/`totalCredit`, never independently re-summed).
- **As-of date** defaults to the selected Financial Year's current date (today, clamped
  to the FY's `endDate` if the FY is a past, closed year) but is user-adjustable to any
  date within `[FinancialYear.startDate, FinancialYear.endDate]`; a date outside that
  range is rejected client- and server-side.
- **Company-scoped**, identical posture to every spec in this project — `companyId` is
  always resolved server-side from the session, never client-supplied.

---

# Engine

Create

```text
src/engines/reporting/types.ts               // shared report types (this spec + 65-67)
src/engines/reporting/ledger-classification.ts // buildLedgerGroupIndex, getRootGroup — shared by 65-67
src/engines/reporting/trial-balance.ts        // buildTrialBalanceReport (pure)
```

- `buildLedgerGroupIndex(groups: LedgerGroup[]): LedgerGroupIndex` — a `Map<groupId,
  { group: LedgerGroup; children: string[] }>` built once per report call, reused by
  every grouping/rollup function in this batch. `getRootGroup(groupId, index)` walks
  `parentGroupId` to the top-level ancestor (used here for building the presentation
  tree's outermost sections, and reused unmodified by `67-cash-flow.md` for its
  Investing/Financing/Operating classification-by-root-group-name).
- `buildTrialBalanceReport(result: TrialBalanceResult, groups: LedgerGroup[]):
  TrialBalanceReport` — pure function: walks the group index, attaches each row to its
  group, recursively rolls up subtotals from leaf groups to root groups, and returns
  `{ sections: TrialBalanceSection[]; totalDebit: number; totalCredit: number }` where
  `totalDebit`/`totalCredit` are copied straight from the input `TrialBalanceResult`
  (never recomputed) and every `TrialBalanceSection` carries `{ groupId, groupName,
  natureType, depth, rows: TrialBalanceRow[], subtotalDebit, subtotalCredit,
  childSections: TrialBalanceSection[] }`.
- No permission checks, no I/O, no `companyId` parameter in this file at all — pure
  shaping of data the caller already fetched (the established engine convention).

`src/modules/reports/services/trial-balance-report-service.ts`
(`trialBalanceReportService.getTrialBalanceReport(companyId, financialYearId,
asOfDate?)`): the only I/O — calls `voucherQueries.getTrialBalance` and
`ledgerGroupRepository.findMany(companyId)` (already exists, spec 13) in parallel, then
`buildTrialBalanceReport`. No repository of its own (there is nothing this module
persists).

---

# Validation

Zod (`src/modules/reports/validation/financial-report-filters-schema.ts`, shared by
`65`–`67`): `financialYearId` (uuid, required), `asOfDate` (calendar date, required for
Trial Balance/Balance Sheet; validated server-side against the resolved FY's own
`[startDate, endDate]` range — never trusted from the client without that re-check).
`65`/`67` extend this same file with their own `from`/`to` variant rather than each
introducing a separate schema file.

---

# UI

Pages (new `/reports` hub — the Sidebar's "Reports" entry currently renders with no
`href`; this spec is the first to give it one, mirroring `57-gst-registers.md`'s
identical move for the Sidebar's "GST" entry)

- `/reports` — hub page: cards for Trial Balance, Profit & Loss, Balance Sheet, Cash
  Flow (all four wired to their own routes once each is implemented — this spec wires
  only its own), plus six placeholder cards — Sales Reports, Purchase Reports, Inventory
  Reports, Customer Reports, Supplier Reports, Employee Reports, and GST Reports (seven
  total placeholders: tracker #66–#72) — pointing at not-yet-built routes, matching
  `57-gst-registers.md`'s own "hub exists before every sibling screen does" precedent.
  **Check `context/feature-specs/` for an existing `/reports` hub before assuming this
  spec is first** — a concurrently-drafted sibling batch (Sales/Purchase/Inventory/
  Customer/Supplier/Employee Reports, tracker #66–#71) may have already created this
  page; if so, add this spec's own Trial Balance/P&L/Balance Sheet/Cash Flow cards to the
  existing hub rather than re-creating it.
- `/reports/trial-balance` — Trial Balance screen: Financial Year selector, as-of-date
  picker, a nested/expandable group tree (Fixed Assets, Investments, …, each with a
  Debit/Credit subtotal, drilling down to individual ledgers), and a grand total row
  that must equal `TrialBalanceResult.totalDebit`/`totalCredit`. Each ledger row links to
  a future Ledger Statement/Inquiry drill-down (not built here — Ledger Inquiry is the
  Accounting module's own responsibility per `architecture-context.md`, out of scope). An
  **Export** action is present but delegates to the not-yet-built Excel Export feature
  (Phase 11, #75) — button rendered, no file generation wired, matching
  `57-gst-registers.md`'s own forward-noted Export button.

Components (`src/modules/reports/components/`): Financial Year + As-Of-Date Filter Bar
(reused by `66-balance-sheet.md`'s own as-of-date screen), Trial Balance Group Tree,
Report Export Button (the shared forward-noted stub, reused by all four financial
reports and, if the sibling batch chooses, by #66–#72 too).

Wire-up

- Add `href: "/reports"` to the Sidebar's existing `{ icon: BarChart3, label: "Reports" }`
  entry (`src/components/layout/sidebar.tsx`).
- Add `reports: "Reports"` and `"trial-balance": "Trial Balance"` to
  `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `reports` permission module (already exists in
`src/constants/permissions.ts`'s `PERMISSION_MODULES` — no new module needed): `view`
(read the report), `export` (the forward-noted Export action). No `create`/`edit`/
`delete`/`approve` — this module never writes anything (Invariant 3). Company-scoped
identically to every spec in this project — every query derives `companyId` from the
requesting user's own session, never a client-supplied value.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, `src/engines/reporting/*` fully pure (deterministic given
the same inputs, no I/O) and fully unit-tested — the standing engine convention this
batch establishes — vitest coverage for:

- `buildTrialBalanceReport` against a seeded fixture spanning multiple nested groups
  (parent with a subtotal equal to the sum of its own ledgers plus every descendant
  group's subtotal), asserting the report's grand total equals the input
  `TrialBalanceResult.totalDebit`/`totalCredit` exactly, never independently re-derived
- A group with no ledgers anywhere in its subtree is omitted from the report; a group
  with at least one ledger (even zero-activity) is included with a correct zero subtotal
  where applicable
- `getRootGroup` resolves the correct top-level ancestor for a 3+-level-deep group
- As-of-date validated against the resolved Financial Year's own date range (rejects a
  date before `startDate` or after `endDate`)
- Cross-company isolation: a second company's ledgers/groups never appear in the first
  company's report

---

# Do Not

Do not implement

- Any ledger-balance arithmetic outside `voucherEngine.getTrialBalance` (this module
  fetches and groups; it never sums entries itself)
- Profit & Loss, Balance Sheet, or Cash Flow (`65`–`67`)
- Sales/Purchase/Inventory/Customer/Supplier/Employee/GST Reports screens (#66–#72's own
  spec files build their own screens; this spec only reserves their hub cards)
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76)
- Any change to `voucherEngine` itself — this spec consumes `getTrialBalance` exactly as
  built

---

# Success Criteria

Verify

- The Trial Balance screen renders every company ledger (including zero-activity ones)
  grouped under its Ledger Group hierarchy, with correct subtotals rolling up from leaf
  to root.
- The grand total Debit/Credit figures always equal `voucherEngine.getTrialBalance`'s own
  `totalDebit`/`totalCredit` — never a value independently re-computed by this module.
- An as-of date outside the selected Financial Year's date range is rejected.
- `src/engines/reporting/` exists with `types.ts`, `ledger-classification.ts`, and
  `trial-balance.ts` — consumed, unmodified in their exported shape, by
  `65-profit-and-loss.md`, `66-balance-sheet.md`, and `67-cash-flow.md`.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports` and `/reports/trial-balance` appear in the build route table and the
  Sidebar's "Reports" entry now links there.

Feature-spec 64 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #62 and
establishes `src/engines/reporting/` for the whole phase. Feature-specs 65 (Profit &
Loss, tracker #63), 66 (Balance Sheet, tracker #64), and 67 (Cash Flow, tracker #65) all
reuse this spec's Reporting Engine and `/reports` hub rather than re-deciding either.
