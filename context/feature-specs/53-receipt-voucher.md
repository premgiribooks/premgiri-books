# 53 - Receipt Voucher

> Feature-spec file number 53 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 7 — Accounting** item **#52
> Receipt Voucher** — the second of the four manual voucher screens (#51–#54), the direct
> mirror of `52-payment-voucher.md` with the ledger direction reversed. Depends on the
> Voucher Engine (feature-spec 31, implemented) and the Document Number Engine
> (feature-spec 34, implemented). **Read `52-payment-voucher.md` first in full** — this
> spec records only what differs.

## Goal

Implement the **Receipt Voucher** screen for **Premgiri Books ERP** — the manual-entry
form for money received that is *not* already captured by a business document's own
payment lines: a customer paying outside of Sales Invoice's payment lines, miscellaneous
income, an interest credit, a refund received from a supplier outside of Purchase
Return's `refundLedgerId`, or any other cash/bank inflow. `VoucherType.RECEIPT` and
`DocumentType.RECEIPT_VOUCHER` already exist (specs 31, 34) with no consumer.

Same design resolution as `52-payment-voucher.md`: **no new Prisma model**. A Receipt
Voucher *is* a `Voucher` — nothing to add to `schema.prisma`.

---

# Project Context

Before implementation, review

- `52-payment-voucher.md` (**read this first in full** — the shared-module structure,
  the shared Cash/Bank ledger-class helper, the UI/wire-up pattern, all reused here with
  the entry direction reversed)
- `31-voucher-engine.md`, `34-document-number-engine.md`, `14-ledger-master.md` /
  `15-bank-management.md` (same ground truth as spec 52 — not re-derived here)

---

# Module Responsibilities

Identical structure to `52-payment-voucher.md`, direction reversed:

- A Create/View/Cancel screen over `voucherEngine.postVoucher`/`cancelVoucher`, scoped to
  `VoucherType.RECEIPT`
- The Receipt-specific validation shape: exactly one Debit entry restricted to a
  Cash-in-Hand-or-`BankAccount`-linked ledger, one or more Credit entries against any
  other active company ledger
- Listing/filtering vouchers of this type

Not responsible for the same set spec 52 excludes (no new model/migration/repository, no
query APIs beyond the engine's own, no interaction with Sales Invoice's own payment
lines).

---

# Data Model

**No new Prisma model, enum, or migration** — identical reasoning to spec 52.
`VoucherType.RECEIPT` / `DocumentType.RECEIPT_VOUCHER` already exist.

---

# Business Rules

Mirror of spec 52's, direction reversed:

- **Entry shape**: exactly one entry with `entryType: "DEBIT"`, one or more entries with
  `entryType: "CREDIT"` — at least 2 entries total.
- **Debit-side ledger-class restriction**: the single Debit entry's `ledgerId` must
  resolve to an active, company-owned ledger that is either the seeded Cash-in-Hand
  ledger or carries a `BankAccount` detail row — using the **same shared helper**
  `52-payment-voucher.md` extracts, not a re-derived copy.
- **Credit-side ledgers**: any active, company-owned ledger — no group restriction (a
  Receipt Voucher can record a customer settling a balance outside invoice billing,
  miscellaneous/interest income, a refund credited from a supplier, etc.).
- **Balance**: delegated entirely to `postVoucher`, unchanged from spec 31.
- **Cancellation**: `cancelReceiptVoucher(id)` — thin pass-through to
  `voucherEngine.cancelVoucher`, scoped to vouchers of this type (rejects a non-`RECEIPT`
  voucher id).
- **Company-scoped**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/manual-vouchers/services/receipt-voucher-service.ts
src/modules/manual-vouchers/validation/receipt-voucher-schema.ts
src/modules/manual-vouchers/actions/receipt-voucher-actions.ts
```

Same shared `src/modules/manual-vouchers/` home as spec 52 — no repository (see spec 52's
Service/Repository section for why). `ManualVoucherForm` (spec 52's shared component,
also used by `54-contra-voucher.md`/`55-journal-voucher.md`) covers this screen's UI with
`voucherType="RECEIPT"`, so no new component file beyond the service/validation/action
trio above.

- `receiptVoucherService`: `listReceiptVouchers(filters)`, `getReceiptVoucher(id)`,
  `postReceiptVoucher(input)`, `cancelReceiptVoucher(id)`.

---

# Validation

Zod (`receipt-voucher-schema.ts`): mirror of `payment-voucher-schema.ts` with
`debitLedgerId` (the single Cash/Bank entry) in place of `creditLedgerId`, and
`creditLines` in place of `debitLines`. Same shape, direction reversed, same shared
Cash/Bank ledger-class re-verification server-side.

---

# UI

Pages (under `/accounting`, alongside spec 52)

- `/accounting/receipt-vouchers` — list (Number, Date, Received From — the credit
  ledger name(s) summarized, Amount, Status, Actions) with search + date filter
- `/accounting/receipt-vouchers/new` — Create (mirror of spec 52's form, Debit side
  restricted to Cash/Bank, Credit side free)
- `/accounting/receipt-vouchers/[id]` — View (read-only, Cancel action, no Edit)

Wire-up

- Add a "Receipt Vouchers" card to the `/accounting` hub page (the second of four, after
  Payment Vouchers).
- Add `receipt-vouchers: "Receipt Vouchers"` to `src/constants/breadcrumbs.ts`.

---

# Security

Identical to spec 52: `accounting` module, `view`/`create`/`approve` (used by Cancel)/
`export`; `edit`/`delete` not implemented.

---

# Database

No new model, enum, or migration.

---

# Code Standards

Same as spec 52, direction reversed: vitest coverage for the entry-shape rule (exactly
one Debit, one-or-more Credit), the Debit-side ledger-class rejection matrix (reusing the
shared helper's test fixture), and `cancelReceiptVoucher` rejecting a non-`RECEIPT`
voucher id.

---

# Do Not

Same as spec 52: no new Prisma model/migration, no edit API, no changes to
`voucherEngine` itself, no printing/PDF/WhatsApp.

---

# Success Criteria

Verify

- A Receipt Voucher posts with exactly one Debit entry against a Cash-in-Hand or
  `BankAccount`-linked ledger and one or more Credit entries against any other active
  ledger; a second Debit entry, zero Credit entries, or a Debit ledger outside the
  Cash/Bank class is rejected before `postVoucher` is called.
- The posted voucher's `voucherNumber` is generated from `DocumentType.RECEIPT_VOUCHER`
  and is strictly increasing per company/FY.
- Cancelling a posted Receipt Voucher produces the correct mirrored reversal; cancelling
  by an id belonging to a different voucher type is rejected.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/accounting/receipt-vouchers*` appears in the build route table.

Feature-spec 53 (this spec) is `context/Phases/phase-tracker.md`'s Phase 7 item #52.
Feature-spec 54 (Contra Voucher, tracker #53) is next.
