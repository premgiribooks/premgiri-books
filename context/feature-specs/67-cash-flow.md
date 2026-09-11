# 67 - Cash Flow

> Feature-spec file number 67 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 10 — Reporting** item **#65
> Cash Flow**, the fourth and last of the phase's four financial reports. Depends on
> Accounting (implemented) and, directly, on `64-trial-balance.md` (**read first in
> full**) for the Reporting Engine location and `buildLedgerGroupIndex`/`getRootGroup`
> helpers this spec reuses. Also depends on `15-bank-management.md` and
> `src/lib/ledger-class.ts` (the Cash/Bank ledger-class helper `52-payment-voucher.md`
> extracted) — **read both before implementing**.

## Goal

Implement **Cash Flow** for **Premgiri Books ERP** — the period-scoped statement of net
change in cash and cash equivalents, broken into Operating, Investing, and Financing
activity.

**Direct vs. Indirect method, decided explicitly (per this batch's own instruction to
decide and justify rather than pick silently).** The indirect method starts from net
profit and adjusts for non-cash items (depreciation, working-capital changes) to
reconcile to the cash movement — it is the conventional choice in general-purpose
accounting software because it reuses the P&L and two Balance Sheet dates a business
already has, without needing transaction-level detail. **This codebase's actual data
shape makes the direct method strictly simpler and more accurate here, and it is the
one this spec implements**: every rupee of cash movement in this system already exists
as a `VoucherEntry` row against a real Cash-in-Hand or `BankAccount`-linked `Ledger` —
there is no accrual-basis noise to reconcile away (no depreciation entries, no accrued-
but-unpaid income/expense concept, no separate AR/AP aging distinct from the ledger
entries themselves) because none of that infrastructure exists in this codebase yet. The
indirect method's entire value proposition — turning an accrual-basis net profit into a
cash-basis figure by adjusting for exactly those gaps — has nothing to adjust for here;
attempting it would mean either (a) faking the reconciliation with adjustments this
system cannot actually compute, or (b) landing on the same number the direct method
gives directly, at far higher implementation and explanation cost. The direct method,
by contrast, is a straightforward sum over data this system already has in exactly the
shape needed (`VoucherEntry` rows against Cash/Bank ledgers) — no new capability, no
approximation.

---

# Project Context

Before implementation, review

- `64-trial-balance.md` (**read first in full**) — Reporting Engine location,
  `buildLedgerGroupIndex`/`getRootGroup` (this spec's own categorization logic depends
  directly on `getRootGroup`, reused unmodified)
- `15-bank-management.md` — `BankAccount.ledgerId` (`@unique`, 1:1 with `Ledger`) — the
  live signal `src/lib/ledger-class.ts` already queries to decide "is this ledger
  Cash/Bank-class"
- `src/lib/ledger-class.ts` — **read the live file, not just its spec.**
  `assertLedgersAreCashOrBank(client, companyId, ledgerIds, usageLabel)` is a
  **throwing, single-purpose validator** (extracted in `52-payment-voucher.md` from
  Purchase Invoice's own check) — it is not itself reusable as a read-only "which of
  this company's ledgers are Cash/Bank-class" query, since it throws on the first
  non-matching id rather than returning a set. **This spec adds one new small read-only
  function, `getCashAndBankLedgerIds(companyId)`, to the same file** (`src/lib/
  ledger-class.ts`) — built from the exact same two lookups
  (`ledgerGroupRepository.findMany` + `getGroupSubtreeIds([CASH_IN_HAND_GROUP_NAME])`,
  plus every ledger carrying a `BankAccount` row) `assertLedgersAreCashOrBank` already
  performs internally, refactored so both functions share one internal helper rather
  than duplicating the Cash-in-Hand-subtree-plus-bank-linked lookup a third time. This
  is the "read-only equivalent" the batch's own research brief anticipated needing,
  named and located here rather than left as an open question.
- `31-voucher-engine.md` — `getLedgerStatement(companyId, ledgerId, from, to)`'s exact
  contract: `{ ledgerId, openingBalance, lines: LedgerStatementLine[], closingBalance }`,
  debit-positive, dated entries with running balance — this spec's own per-ledger period
  movement is `closingBalance − openingBalance` from this same call, reused unmodified
  (never re-summed from raw entries a second time)
- `13-ledger-groups.md` — the 23-group seeded skeleton this spec's Operating/Investing/
  Financing classification keys off by **root group name** (see Business Rules)

---

# Module Responsibilities

The Cash Flow module is responsible for

- A read-only Cash Flow screen: pick a Financial Year and a `from`/`to` date range, see
  the net change in cash & cash equivalents for the period, broken into Operating/
  Investing/Financing activity
- One new read-only helper, `getCashAndBankLedgerIds(companyId)`, added to
  `src/lib/ledger-class.ts`
- Its own Reporting Engine function, `src/engines/reporting/cash-flow.ts`

The Cash Flow module is **not** responsible for

- Trial Balance, Profit & Loss, or Balance Sheet (`64`–`66`)
- Any indirect-method reconciliation (explicitly rejected, see Goal)
- Bank reconciliation against a real bank statement (`15-bank-management.md`'s own Do
  Not list, Phase 12 — Future Features; this report only reads posted `VoucherEntry`
  rows, never an external statement)

---

# Data Model

**No new Prisma model, enum, or migration.** Pure read/aggregation over already-
implemented tables, matching Invariants 3 and 9.

---

# Business Rules

- **Identify Cash/Bank ledgers**: `getCashAndBankLedgerIds(companyId)` — every ledger
  under the "Cash-in-Hand" group subtree, plus every ledger carrying an active
  `BankAccount` row (the identical two-part classification `assertLedgersAreCashOrBank`
  already applies, exposed here as a plain id set rather than a throwing assertion).
- **Net Change in Cash for the period** = Σ over every Cash/Bank ledger of
  (`getLedgerStatement(companyId, ledgerId, from, to).closingBalance −
  getLedgerStatement(...).openingBalance`) — the headline total this report's three
  activity sections must sum to exactly (a hard internal-consistency check, asserted in
  tests, not merely hoped true).
- **Categorization by counter-ledger's root group.** For every `VoucherEntry` in the
  period whose own ledger is **not** Cash/Bank-class, but which belongs to a `Voucher`
  that has **at least one** Cash/Bank-class entry (i.e., the voucher actually moved
  cash) — walk that entry's `ledgerGroupId` to its top-level ancestor via
  `getRootGroup` (spec 64) and classify:
  - **Investing**: root group name is `"Fixed Assets"` or `"Investments"`
  - **Financing**: root group name is `"Capital Account"`, `"Reserves & Surplus"`, or
    `"Loans (Liability)"`
  - **Operating**: every other root group (`"Current Assets"` other than the Cash/Bank
    subtree, `"Current Liabilities"`, `"Sales Accounts"`, `"Direct Incomes"`,
    `"Indirect Incomes"`, `"Purchase Accounts"`, `"Direct Expenses"`, `"Indirect
    Expenses"`, `"Misc. Expenses (Asset)"`)
  - A voucher whose **only** entries are all Cash/Bank-class (a Contra Voucher — cash
    transferred between Cash-in-Hand and a bank ledger, or bank-to-bank) is **excluded
    from every category by construction**: there is no non-Cash/Bank entry to classify,
    which is the structurally correct treatment — an internal transfer between cash
    equivalents changes no category total and, correctly, does not appear in Net Change
    in Cash either (both legs are Cash/Bank ledgers, so their movements cancel in the
    Net Change sum above too).
- **Sign per categorized entry**: a `CREDIT` entry on the non-cash counter-ledger
  contributes `+amount` to its category (the mirror image of a cash-side `DEBIT` that
  increased cash in the same voucher); a `DEBIT` entry contributes `-amount`. Summed
  across all three categories, this equals the Net Change in Cash figure exactly — a
  balanced-voucher identity, asserted as a Success Criterion.
- **Named simplification, recorded**: root-group-only classification means a line under
  "Loans & Advances (Asset)" (a child of "Current Assets," not its own root group) is
  bucketed **Operating**, even though a loan given to a third party is, in strict
  accounting practice, an Investing activity. This codebase's seeded chart of accounts
  has no dedicated root-level group for "loans given" distinct from ordinary Current
  Assets, and introducing one is a chart-of-accounts change out of scope for a reporting
  spec — recorded as a known simplification, not silently glossed over.
- **Company-scoped**, identical posture to every spec in this project.

---

# Engine

Create

```text
src/engines/reporting/cash-flow.ts   // buildCashFlowReport (pure)
```

- `buildCashFlowReport(cashLedgerMovements: { ledgerId: string; netChange: number }[],
  categorizableEntries: { ledgerGroupId: string; entryType: "DEBIT" | "CREDIT"; amount:
  number }[], groups: LedgerGroup[]): CashFlowReport` — pure function. Sums
  `cashLedgerMovements` for the headline `netChangeInCash`; for each `categorizableEntries`
  row, resolves `getRootGroup(ledgerGroupId, index).name` and buckets the signed amount
  into `operating`/`investing`/`financing`; returns `{ operating, investing, financing,
  netChangeInCash, reconciles: boolean }` where `reconciles = round2(operating +
  investing + financing) === round2(netChangeInCash)`, rendered as a visible integrity
  indicator exactly like `66-balance-sheet.md`'s own `isBalanced`.

`src/modules/reports/services/cash-flow-service.ts`
(`cashFlowService.getCashFlow(companyId, financialYearId, from, to)`): the only I/O —
resolves the Financial Year (re-validating `from`/`to`), calls
`getCashAndBankLedgerIds(companyId)`, then for each Cash/Bank ledger calls
`voucherQueries.getLedgerStatement(companyId, ledgerId, from, to)` for its
`netChange`; separately queries every `VoucherEntry` in the period belonging to a
`Voucher` with at least one Cash/Bank-class entry (a new, purely read-only repository
method — see below — needed because no existing query returns "the non-cash side of a
cash-touching voucher"), excludes entries whose own ledger is itself Cash/Bank-class,
and calls `buildCashFlowReport`.

New repository method (the one genuinely new query this batch adds, since no existing
`voucherEngine` API returns "entries of vouchers that also touch a given ledger set" —
still a **read-only query**, added to `src/modules/vouchers/repositories/
voucher-repository.ts` rather than a new repository, since it queries the same
`VoucherEntry`/`Voucher` tables the rest of the Voucher Engine already owns):
`findCashTouchingEntries(companyId, from, to, cashLedgerIds)` — every `VoucherEntry`
whose `Voucher` falls in `[from, to]`, `companyId` matches, and has at least one sibling
entry with `ledgerId IN cashLedgerIds`, returned with `ledgerGroupId` (joined through
`Ledger`) — this is additive to the Voucher Engine's existing query surface, not a
change to any existing function's behavior or signature.

---

# Validation

Zod: reuses `65-profit-and-loss.md`'s `from`/`to` variant of
`financial-report-filters-schema.ts` verbatim — no new schema file.

---

# UI

Pages (under the `/reports` hub)

- `/reports/cash-flow` — Cash Flow screen: Financial Year selector, `from`/`to` range
  picker, three sections (Operating/Investing/Financing Activities) each with its own
  net figure, a headline "Net Increase/Decrease in Cash" figure, and a visible
  reconciliation indicator (`reconciles`). An Export action, present but delegating to
  the not-yet-built Excel Export feature (Phase 11, #75), identical posture to specs
  64–66.

Components (`src/modules/reports/components/`): Cash Flow Statement (three-section
layout), reusing the Date Range Filter Bar and the shared Report Export Button.

Wire-up

- Wire the `/reports` hub page's "Cash Flow" card (added, unlinked, by spec 64) to
  `/reports/cash-flow`.
- Add `"cash-flow": "Cash Flow"` to `src/constants/breadcrumbs.ts`.

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

Strict TypeScript, no `any`, `cash-flow.ts` fully pure and unit-tested, vitest coverage
for:

- `buildCashFlowReport` against a seeded fixture spanning a Payment Voucher (Cash →
  Expense), a Receipt Voucher (Cash ← Sundry Debtor), a Contra Voucher (Cash ↔ Bank), and
  a Sales Invoice settled partly by an immediate cash line — asserting: the Contra
  Voucher contributes to no category and to no net-change delta (self-cancelling);
  Operating/Investing/Financing sum exactly to `netChangeInCash`; a Fixed Assets purchase
  paid by cash classifies Investing; a Capital introduction classifies Financing
- `getCashAndBankLedgerIds` matches `assertLedgersAreCashOrBank`'s own classification
  exactly for the same fixture (a cross-check test against the existing helper, not an
  independently-asserted set)
- `findCashTouchingEntries` correctly excludes a voucher with no Cash/Bank-class entry at
  all (e.g. a Journal Voucher adjusting two non-cash ledgers) and correctly excludes the
  Cash/Bank-side entries themselves from its own result (only counter-ledger entries are
  returned)
- Root-group resolution for a 3+-level-deep counter-ledger (e.g. a ledger under "Sundry
  Creditors" → "Current Liabilities") correctly reaches the intended root
- `from`/`to` validated against the resolved Financial Year's own date range
- Cross-company isolation

---

# Do Not

Do not implement

- Trial Balance, Profit & Loss, or Balance Sheet (`64`–`66`)
- The indirect method (see Goal — explicitly rejected and justified)
- Bank reconciliation against an actual bank statement (Phase 12 — Future Features)
- A dedicated "loans given" root group or any chart-of-accounts change (see Business
  Rules' named simplification)
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76)
- Any change to `voucherEngine`'s existing exported functions (only one new, additive
  repository method is introduced, and only `src/lib/ledger-class.ts` gains one new
  read-only export alongside its existing assertion)

---

# Success Criteria

Verify

- Operating + Investing + Financing exactly equals the headline Net Change in Cash for a
  seeded fixture spanning all three categories plus a self-cancelling Contra Voucher.
- A Contra Voucher (Cash ↔ Bank) contributes to no category and to no net change.
- `getCashAndBankLedgerIds` agrees with `assertLedgersAreCashOrBank`'s own classification
  for every ledger in the fixture.
- `from`/`to` outside the selected Financial Year's date range is rejected.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/cash-flow` appears in the build route table.

Feature-spec 67 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #65 and
completes the phase's four financial reports (#62–#65), all sharing the Reporting Engine
`64-trial-balance.md` established. Feature-spec 74 (GST Reports, tracker #72) is the
phase's remaining report spec drafted in this same batch, built on the GST Engine's own
aggregation primitives (spec 57) rather than the Voucher Engine's.
