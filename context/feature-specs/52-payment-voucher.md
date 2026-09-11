# 52 - Payment Voucher

> Feature-spec file number 52 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 6 — Accounting** item **#50
> Payment Voucher** — the first of the four manual voucher screens (#50–#53). Depends on
> the Voucher Engine (feature-spec 31, implemented) and the Document Number Engine
> (feature-spec 34, implemented) — both are consumed as-is, with **no engine changes**.
> **Read `31-voucher-engine.md` first in full** — this spec is a thin, permission-gated
> UI/validation layer directly over its already-built `postVoucher`/`cancelVoucher`/
> `listVouchers`/`getVoucher` APIs, not new engine work.

## Goal

Implement the **Payment Voucher** screen for **Premgiri Books ERP** — the manual-entry
form for money paid out that is *not* already captured by a business document's own
payment lines (Purchase Invoice's `PurchaseInvoicePayment` rows, for example): paying a
supplier outside of billing time, paying an expense directly, repaying a loan, or any
other cash/bank outflow. `VoucherType.PAYMENT` and `DocumentType.PAYMENT_VOUCHER` already
exist (specs 31, 34) with no consumer — this is what they were reserved for.

**Design resolution carried across all four manual-voucher specs (#50–#53), decided
here and referenced, not re-derived, in #51/#52/#53**: none of these four screens
introduces its own Prisma document model. `Voucher` already carries everything a manual
voucher needs — its own `voucherType`, an engine-generated `voucherNumber`, `voucherDate`,
`narration`, and its `entries`. Unlike Sales Invoice or Purchase Invoice — which needed a
dedicated table because they carry real document-specific data no generic voucher shape
could hold (a customer/supplier reference, taxed line items, delivery/payment terms,
GST breakup) — a Payment Voucher *is* a voucher, full stop. Introducing a
`PaymentVoucher` wrapper table with a `voucherId` FK and zero fields of its own beyond
what `Voucher` already has would be a duplicate table with no purpose
(`ai-workflow-rules.md`'s Database Workflow: "avoid duplicate tables ... prefer extending
existing entities"). This spec is therefore **UI + validation only**: a specialized form
and a thin service function that shapes a `PostVoucherInput` and calls
`voucherEngine.postVoucher` — no new migration, no new repository.

---

# Project Context

Before implementation, review

- `31-voucher-engine.md` (**read this first in full** — `postVoucher(companyId, input,
  tx?)`, `cancelVoucher(companyId, id, tx?)`, `getVoucher`, `listVouchers`, the balance
  rule, the immutability rule, and the reversal-based cancellation contract this spec
  reuses without modification)
- `34-document-number-engine.md` (confirms `DocumentType.PAYMENT_VOUCHER` already exists
  and that a `VoucherType` with no separate business document numbers its voucher
  directly from the matching `*_VOUCHER` `DocumentType` entry — there is no second,
  document-level number for a Payment Voucher the way Sales Invoice has both an invoice
  number and a separate `SALES_VOUCHER` voucher number; here the voucher number *is* the
  document's only number)
- `14-ledger-master.md` / `15-bank-management.md` (`Ledger`/`BankAccount` shape — the
  Cash-in-Hand-or-`BankAccount`-linked ledger-class restriction this spec reuses)
- `44-purchase-invoice.md` (its payment-ledger validation — "restricted to an active,
  company-owned ledger that is either the seeded Cash-in-Hand ledger or carries a
  `BankAccount` detail row" — is the exact rule this spec applies to the Credit side of
  a Payment Voucher; **do not re-derive this check ad hoc — extract the existing logic
  in `purchase-invoice-service.ts`'s ledger-class validation into a shared helper** (e.g.
  `src/lib/ledger-class.ts` or similar — implementer's choice of location, but it must be
  one shared function, not a third copy) **and have both Purchase Invoice and this spec
  call it**, since a fourth near-identical copy would land with Receipt/Contra Voucher
  (#51/#52) immediately after)

---

# Module Responsibilities

The Payment Voucher module is responsible for

- A Create/View/Cancel screen over `voucherEngine.postVoucher`/`cancelVoucher`, scoped to
  `VoucherType.PAYMENT`
- The Payment-specific validation shape: exactly one Credit entry restricted to a
  Cash-in-Hand-or-`BankAccount`-linked ledger, one or more Debit entries against any
  other active company ledger
- Listing/filtering vouchers of this type (`voucherEngine.listVouchers(companyId,
  {voucherType: "PAYMENT", ...})`)

The Payment Voucher module is **not** responsible for

- Any new Prisma model, migration, or repository (see Goal — there is nothing to persist
  beyond what `Voucher`/`VoucherEntry` already store)
- Balance/trial-balance/ledger-statement queries (Voucher Engine's own query APIs;
  Reports #61–#64 render them)
- Purchase Invoice's own payment lines (`PurchaseInvoicePayment`) — a settled invoice
  payment stays exactly where it is; this screen is for payments outside that flow

---

# Data Model

**No new Prisma model, enum, or migration.** `VoucherType.PAYMENT` and
`DocumentType.PAYMENT_VOUCHER` already exist (specs 31, 34) with zero consumers before
this spec. This screen authors a `PostVoucherInput` (per spec 31's `types.ts`) with
`voucherType: "PAYMENT"` and calls the existing engine — nothing new to add to
`schema.prisma`.

---

# Business Rules

Enforced in this module's thin service layer, **before** calling
`voucherEngine.postVoucher` (which independently re-enforces its own balance/FY/ledger
rules regardless — this is an additional, Payment-specific narrowing on top, not a
replacement):

- **Entry shape**: exactly one entry with `entryType: "CREDIT"`, one or more entries with
  `entryType: "DEBIT"` — at least 2 entries total, matching spec 31's own minimum.
- **Credit-side ledger-class restriction**: the single Credit entry's `ledgerId` must
  resolve to an active, company-owned ledger that is either the seeded Cash-in-Hand
  ledger or carries a `BankAccount` detail row (the shared helper from Project Context
  above) — any other ledger (a Purchase Account, an expense ledger, a party ledger) is
  rejected server-side as an invalid payment-out source, not left to client trust.
- **Debit-side ledgers**: any active, company-owned ledger — no group restriction (a
  Payment Voucher can pay an expense, settle a Sundry Creditor balance outside invoice
  billing, repay a loan ledger, etc.).
- **Balance**: unchanged from spec 31 — sum(Debit) === sum(Credit), integer-paise
  comparison, delegated entirely to `postVoucher`.
- **Cancellation**: `cancelPaymentVoucher(id)` is a thin pass-through to
  `voucherEngine.cancelVoucher(companyId, id)` scoped to vouchers of this type (rejects
  if the loaded voucher's `voucherType !== "PAYMENT"`, guarding against an id belonging
  to some other voucher type reaching this screen's cancel action).
- **Company-scoped**, identical posture to every other spec in this project.

---

# Service / Repository

Create

```text
src/modules/manual-vouchers/services/payment-voucher-service.ts
src/modules/manual-vouchers/validation/payment-voucher-schema.ts
src/modules/manual-vouchers/actions/payment-voucher-actions.ts
src/modules/manual-vouchers/components/…
```

**No repository file** — there is no table this module owns; all persistence goes
through `voucherEngine`'s own repository. `src/modules/manual-vouchers/` is a shared
module home for all four manual-voucher screens (#50–#53) — see `55-journal-voucher.md`'s
Service/Repository section for why one shared module was chosen over four near-identical
ones, and for the shared ledger-class-restriction helper's exact location once decided.

- `paymentVoucherService`: `listPaymentVouchers(filters)` (thin filter over
  `voucherEngine.listVouchers` pinned to `voucherType: "PAYMENT"`),
  `getPaymentVoucher(id)`, `postPaymentVoucher(input)` (validates the entry shape above,
  then calls `voucherEngine.postVoucher`), `cancelPaymentVoucher(id)`.
- No Server Action or component ever calls `voucherEngine` directly — always through this
  service (Repository → Service → Server Action → UI still holds, just with the engine
  standing in for a repository this module doesn't have its own).

---

# Validation

Zod (`payment-voucher-schema.ts`): `voucherDate` calendar date, `narration` ≤ 500,
`creditLedgerId` uuid (the single Cash/Bank entry, re-verified server-side against the
shared ledger-class helper — the schema only checks shape, never trusts a client claim
that a ledger belongs to the right class), `debitLines` array ≥ 1 (`ledgerId` uuid,
`amount` > 0 with ≤ 2 decimals). The service, not the schema, computes the final balanced
`PostVoucherInput` entry array (one CREDIT entry for `Σ debitLines`, matching debit
entries 1:1) — mirroring how Sales/Purchase Invoice's schema validates shape while the
service computes final totals, never trusting a client-submitted total.

---

# UI

Pages (under a new `/accounting` sub-route, alongside the existing Ledger
Groups/Ledgers/Banks/Expense/Income Heads pages)

- `/accounting/payment-vouchers` — list (Number, Date, Paid To — the debit ledger name(s)
  — summarized, Amount, Status, Actions) with search + date filter
- `/accounting/payment-vouchers/new` — Create (Cash/Bank picker restricted to the
  ledger-class helper's result set for the Credit side, a free-entity ledger picker + one
  or more amount rows for the Debit side, narration)
- `/accounting/payment-vouchers/[id]` — View (read-only detail, Cancel status action —
  **no Edit**: like every voucher in this project, a posted voucher is immutable;
  correcting one means cancelling and re-entering, never editing)

Components (`src/modules/manual-vouchers/components/`): a shared `ManualVoucherForm`
parameterized by voucher type (Payment/Receipt/Contra/Journal each configure which side
is restricted to Cash/Bank, how many entries are allowed, and the label copy) rather than
four near-duplicate form components — see `55-journal-voucher.md` for the shared-UI
decision this spec follows.

Wire-up

- Add an "Accounting" hub page at `/accounting` (this project's `/sales` and `/purchase`
  hub-page convention) if one does not already exist by the time this spec is
  implemented, with a "Payment Vouchers" card — the first of four, alongside Receipt/
  Contra/Journal.
- Add `payment-vouchers: "Payment Vouchers"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `accounting` permission module (already exists in
`src/constants/permissions.ts`'s `PERMISSION_MODULES`, matching where Ledger Groups/
Ledger Master/Bank Management already live): `view`, `create`, `approve` used by Cancel
(cancelling a posted financial voucher is a correction to an already-posted record, the
same posture Purchase Return's Post action takes — unconditional `approve`, not
conditional on any per-voucher flag), `export`. `edit`/`delete` are not implemented — no
API exists to modify or remove a posted voucher (spec 31's own rule).

---

# Database

No new model, enum, or migration — see Data Model.

---

# Code Standards

Strict TypeScript, no `any`, no arithmetic or balance logic duplicated outside
`voucherEngine` (this module only shapes input and validates the Payment-specific entry
constraints — the balance check itself stays exactly where spec 31 put it), vitest
coverage for: the entry-shape rule (exactly one Credit, one-or-more Debit, rejects zero
Debit lines and rejects a second Credit line), the Credit-side ledger-class rejection
matrix (missing/inactive/cross-company/wrong-class — reusing the shared helper's own test
fixture, not a duplicated matrix), and `cancelPaymentVoucher` rejecting a non-`PAYMENT`
voucher id.

---

# Do Not

Do not implement

- A `PaymentVoucher` Prisma model or any new migration (see Goal)
- Edit of a posted voucher (no API may exist, per spec 31)
- Any change to `voucherEngine`, `postVoucher`, or `cancelVoucher` themselves — this spec
  consumes them exactly as built
- Printing, PDF generation, or WhatsApp sharing (no browser-print exception here, same
  posture as Purchase Invoice — an internal accounting voucher, not a document handed to
  an external party)

---

# Success Criteria

Verify

- A Payment Voucher posts with exactly one Credit entry against a Cash-in-Hand or
  `BankAccount`-linked ledger and one or more Debit entries against any other active
  ledger; a second Credit entry, zero Debit entries, or a Credit ledger outside the
  Cash/Bank class is rejected before `postVoucher` is ever called.
- The posted voucher's `voucherNumber` is generated from `DocumentType.PAYMENT_VOUCHER`
  and is strictly increasing per company/FY, exactly as spec 34 guarantees.
- Cancelling a posted Payment Voucher produces the correct mirrored reversal via
  `voucherEngine.cancelVoucher`, unmodified from spec 31's own behavior; cancelling by an
  id belonging to a different voucher type is rejected.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/accounting/payment-vouchers*` appears in the build route table.

Feature-spec 52 (this spec) is `context/Phases/phase-tracker.md`'s Phase 6 item #50.
Feature-spec 53 (Receipt Voucher, tracker #51) is its direct mirror.
