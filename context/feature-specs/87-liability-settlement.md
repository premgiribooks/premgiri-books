# 87 - Liability Settlement

> Feature-spec file number 87 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 11 — Payment & Collections
> Management** item **#87** — added to the phase after its initial reservation, per
> explicit user request, and drafted immediately after feature-spec 86 (Payment Mode
> Master, #83) in the same session, though it does **not depend on it** (see Goal).
> Depends on Trial Balance (feature-spec 64, implemented) and Payment Voucher
> (feature-spec 52, implemented) — both consumed as-is, with **no engine or service
> changes to either**. **Read `64-trial-balance.md` and `52-payment-voucher.md` first in
> full** — this spec is a thin read+navigate layer composing their existing outputs, not
> new engine work.

## Goal

Implement a **Liability Settlement** screen for **Premgiri Books ERP** — a consolidated,
company-scoped view of every ledger with an outstanding balance under a `LIABILITY`
-nature Ledger Group (Sundry Creditors, Loans, Duties & Taxes, Provisions, and any
company-added sub-group under Current Liabilities — **not narrowed to Suppliers/Sundry
Creditors only**, an explicit scope decision), each with a "Settle" action that jumps
straight into the existing Payment Voucher **New** screen with that ledger and its
outstanding amount already filled in.

**Why this is needed, in one line**: today, settling any liability (paying a supplier
outside of Purchase Invoice's own payment lines, paying down a loan, clearing a Duties &
Taxes balance, disbursing a Payroll run's Salary Payable credit —
`63-payroll.md`'s own spec explicitly "leaves actual disbursement to the existing Payment
Voucher screen") requires a user to already know which ledger to debit and how much is
outstanding, with no screen surfacing that information — they must cross-reference a
Trial Balance report by hand. This spec closes that gap with a **read+navigate**
convenience, not a new posting mechanism.

**This spec introduces zero new Prisma schema and zero new posting logic.** It reads
`voucherQueries.getTrialBalance` (exactly as `66-balance-sheet.md` already does) and
hands off to `paymentVoucherService`'s existing, unmodified `postPaymentVoucher` via a
plain URL-based prefill of Payment Voucher's own New form — the same `?deliveryChallanId=`
-style prefill convention `38-sales-invoice.md`'s own New screen already uses for a
different document.

**Explicitly reflects the phase's own declined "invoice-wise allocation" decision**:
settling a liability posts one lump Payment Voucher Debit against the ledger's whole (or
a user-reduced partial) outstanding balance — there is no concept of "which specific
bill" that balance is made of, matching the granularity every other ledger in this
codebase already has (a Ledger's balance is a single running figure, not a bill-wise
sub-ledger).

---

# Project Context

Before implementation, review

- `64-trial-balance.md` (**read first in full**) — `voucherQueries.getTrialBalance
  (companyId, financialYearId, asOfDate)`, its debit-positive `closingBalance`
  convention, and `buildLedgerGroupIndex`
- `66-balance-sheet.md` — the exact precedent this spec follows: filtering Trial Balance
  rows to `LIABILITY`-nature ledgers and sign-flipping `closingBalance`
  (`-closingBalance`) for display, because `LedgerGroup.natureType` is **already present
  on every group row, not just top-level ones** (copied at creation time,
  `13-ledger-groups.md`'s Business Rules) — no subtree-walk is needed, a plain
  `natureType === "LIABILITY"` filter on the row's own `ledgerGroupId` lookup suffices
- `52-payment-voucher.md` (**read first in full**) — `paymentVoucherService
  .postPaymentVoucher`, the Payment Voucher New page/form, and the Credit-side Cash/Bank
  restriction the user still completes manually after this screen's prefill
- `63-payroll.md` — confirms the existing precedent this spec generalizes: Payroll posts
  a Credit to a company-chosen Salary Payable liability ledger and explicitly defers
  disbursement to "the existing Payment Voucher screen," with no dedicated UI pointing a
  user at that outstanding balance until now
- `38-sales-invoice.md` — the `?deliveryChallanId=` query-param prefill convention this
  spec's own "Settle" link reuses in shape (a different document, same mechanism: a
  Server Component's `searchParams` prop reads an optional id/amount pair and seeds the
  form's `defaultValues`)

---

# Module Responsibilities

The Liability Settlement module is responsible for

- A read-only listing of every `LIABILITY`-nature ledger with a non-zero outstanding
  (sign-flipped-positive) balance, as of a chosen date within a chosen Financial Year
- A "Settle" action per row that navigates to Payment Voucher's existing New screen with
  that ledger and amount pre-filled

The Liability Settlement module is **not** responsible for

- Any new Prisma model, migration, or repository — see Data Model
- Posting anything itself — Payment Voucher's own existing, unmodified
  `postPaymentVoucher` remains the only write path; this module only navigates the user
  there with a prefilled form
- Invoice-wise or bill-wise allocation of a settlement against specific Purchase
  Invoices/bills — the phase's own declined scope (see Goal)
- Trial Balance, Balance Sheet, or Cash Flow themselves (`64`, `66`, `67`) — this module
  calls Trial Balance's existing function, it does not reimplement any part of it
- Payment Mode selection logic — Payment Voucher's own form already renders whatever
  fields it has (a Payment Mode field will simply appear there once specs 88–90 add one;
  this spec has no hard dependency on that work existing first)

---

# Data Model

**No new Prisma model, enum, field, or migration.** Pure read (`getTrialBalance` +
`ledgerGroupRepository.findMany`) plus a navigation hand-off into an already-existing
write path (`paymentVoucherService.postPaymentVoucher`, unmodified). Matches Invariants 3
and 9.

---

# Business Rules

- **One `getTrialBalance(companyId, financialYearId, asOfDate)` call**, exactly like
  `66-balance-sheet.md`'s own single-call posture — a point-in-time snapshot, not a
  range.
- **Liability filter**: a row is included only if its `ledgerGroupId` resolves (via
  `ledgerGroupRepository.findMany`) to a group whose `natureType === "LIABILITY"`.
- **Outstanding amount** = `-row.closingBalance` (the same sign-flip
  `66-balance-sheet.md`'s Liabilities side already applies, since a Liability ledger's
  natural balance is Credit and `closingBalance` is debit-positive).
- **Zero/negative-flipped rows are excluded** — a Liability ledger with
  `closingBalance >= 0` (flipped ≤ 0: no real amount owed, or even an overpaid/debit
  balance) has nothing to settle and does not appear.
- **Settle does not force full settlement**: the prefilled amount defaults to the full
  outstanding figure, but the user can reduce it (a partial settlement) on Payment
  Voucher's own form before posting — no new validation is added restricting this; it is
  exactly the same freedom Payment Voucher's Debit lines already have.
- **No automatic posting**: "Settle" only navigates and prefills. The user must still
  open Payment Voucher's New screen, choose/confirm the Credit-side Cash/Bank ledger
  (Payment Voucher's own existing `assertLedgersAreCashOrBank` check applies unchanged),
  optionally add narration, and explicitly submit.
- **As-of date** validated against the resolved Financial Year's own `[startDate,
  endDate]` range, identical to `64-trial-balance.md`'s own rule.
- **Company-scoped**, identical posture to every spec in this project.

---

# Service

Create

```text
src/modules/liability-settlement/services/liability-settlement-service.ts
src/modules/liability-settlement/validation/liability-settlement-filters-schema.ts
src/modules/liability-settlement/actions/liability-settlement-actions.ts
src/modules/liability-settlement/components/…
```

**No repository file** — there is no table this module owns; every read goes through
`voucherQueries`/`ledgerGroupRepository`, exactly like Balance Sheet's own service has no
repository of its own.

- `liabilitySettlementService.getOutstandingLiabilities(companyId, financialYearId,
  asOfDate)`: resolves the Financial Year (re-validating `asOfDate` against its range,
  identical to Trial Balance/Balance Sheet), calls `voucherQueries.getTrialBalance` and
  `ledgerGroupRepository.findMany` in parallel, filters to `LIABILITY`-nature rows with a
  positive flipped balance, sorts by Ledger Group then Ledger Name (matching Trial
  Balance's own group-tree ordering convention), and returns a flat list of `{ ledgerId,
  ledgerName, ledgerGroupName, outstandingAmount }` plus a grand total.

**One small, additive extension to the existing Payment Voucher New page/form**
(`52-payment-voucher.md`'s own files) — **not** to `paymentVoucherService` itself: the
page reads two optional `searchParams` (`debitLedgerId`, `amount`) and, when both are
present and the ledger resolves to an active, company-owned ledger, seeds the form's
first Debit line's `defaultValues` accordingly. This is the only change this spec makes
outside its own new module.

---

# Validation

Zod (`liability-settlement-filters-schema.ts`): `financialYearId` uuid, `asOfDate`
calendar date — reusing `64-trial-balance.md`'s shared as-of-date filter shape rather
than introducing a second copy, following that spec's own precedent (`66-balance-sheet.md`
already reuses it verbatim).

---

# UI

Pages (under the existing `/accounting` route, alongside Ledger Groups/Ledger Master/
Bank Management/Payment Vouchers)

- `/accounting/liability-settlement` — Financial Year selector (defaults to the active
  FY) + as-of-date picker (reusing the shared As-Of-Date Filter Bar
  `66-balance-sheet.md` already uses), a table (Ledger Group, Ledger Name, Outstanding
  Amount, a "Settle" button per row) with a grand-total row, and an empty state when no
  liability ledger has an outstanding balance.

"Settle" navigates to
`/accounting/payment-vouchers/new?debitLedgerId=<ledgerId>&amount=<outstandingAmount>`
— Payment Voucher's own existing New screen, now prefilled per the Service section
above.

Components (`src/modules/liability-settlement/components/`): Liability Settlement Table
(reusing the shared As-Of-Date Filter Bar and grand-total-row convention already
established by Trial Balance/Balance Sheet's own components).

Wire-up

- Add a "Liability Settlement" card to the `/accounting` hub page.
- Add `leaf("Liability Settlement", "/accounting/liability-settlement", <icon>)` to
  `src/config/navigation.ts`'s Accounting group.
- Add `"liability-settlement": "Liability Settlement"` to
  `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `accounting` permission module (no new permission catalog entries
needed, matching where Payment Voucher/Bank Management/Ledger Master already live):
`view` for the list. Creating the actual Payment Voucher still goes through
`paymentVoucherService.postPaymentVoucher`'s own existing `create` gate, unchanged.
Company-scoped identically to every spec in this project — the prefilled `debitLedgerId`
is re-validated server-side (active, company-owned) by Payment Voucher's own existing
posting-time checks exactly as if the user had picked it manually; a tampered or
cross-company query-param value is rejected the same way any other invalid ledger id
already is, not specially trusted because it arrived via a query string.

---

# Database

**No new model, enum, field, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, no arithmetic duplicated outside `voucherQueries
.getTrialBalance` (this module only filters/sign-flips/sorts its already-computed rows,
identical posture to `66-balance-sheet.md`'s own `buildBalanceSheetReport`). Vitest
coverage for:

- Only `LIABILITY`-nature ledgers with a positive flipped balance appear; an `ASSET`/
  `INCOME`/`EXPENSE`-nature ledger, or a `LIABILITY`-nature ledger with a zero/negative
  flipped balance, is excluded
- The grand total equals the sum of all included rows' `outstandingAmount`
- As-of date validated against the resolved Financial Year's own date range
- The Payment Voucher New page's prefill: a valid `debitLedgerId`/`amount` pair seeds the
  first Debit line; a missing, malformed, inactive, or cross-company `debitLedgerId` is
  ignored (falls back to the form's normal empty defaults, never throws a page-level
  error)
- Cross-company isolation

---

# Do Not

Do not implement

- Any new Prisma model, migration, or repository (see Goal)
- Invoice-wise or bill-wise settlement allocation (the phase's own declined scope)
- A Cheque Register or any cheque-specific field (the phase's own declined scope)
- Any change to `voucherEngine`, `paymentVoucherService`'s posting logic, or
  `voucherQueries.getTrialBalance` itself
- Automatic/one-click full-settlement posting without landing on Payment Voucher's own
  form for user confirmation first
- A Payment Mode field or any dependency on specs 88–90 existing first (see Goal)

---

# Success Criteria

Verify

- Every `LIABILITY`-nature ledger with a real outstanding (flipped-positive) balance
  appears, grouped/labeled by its Ledger Group; one with a zero or debit balance does
  not.
- "Settle" navigates to Payment Voucher's New screen with the correct ledger and full
  outstanding amount pre-filled in the first Debit line; the user can still edit the
  amount, add further Debit lines, and must choose the Credit (Cash/Bank) ledger before
  the Post button is enabled — identical to using Payment Voucher directly today.
- Posting via this flow produces the exact same voucher/ledger effect as manually
  creating a Payment Voucher today — no new posting code path exists.
- An invalid, inactive, or cross-company `debitLedgerId`/`amount` query-param pair is
  silently ignored by Payment Voucher's New page, never a thrown error.
- Company/Financial-Year scoped; as-of date validated against the FY's own range.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/accounting/liability-settlement` appears in the build route table.

Feature-spec 87 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #87. It
has no ordering dependency on feature-spec 86 (Payment Mode Master, #83) or specs 88–90
(#84–#86) — it may be implemented before, after, or independently of any of them.
