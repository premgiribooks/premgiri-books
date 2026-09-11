# 54 - Contra Voucher

> Feature-spec file number 54 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 6 — Accounting** item **#52
> Contra Voucher** — the third of the four manual voucher screens (#50–#53). Depends on
> the Voucher Engine (feature-spec 31, implemented) and the Document Number Engine
> (feature-spec 34, implemented). **Read `52-payment-voucher.md` first in full** — this
> spec records only what differs, and is the *most* restrictive of the four.

## Goal

Implement the **Contra Voucher** screen for **Premgiri Books ERP** — the manual-entry
form for a fund movement strictly between the company's own Cash/Bank ledgers: depositing
cash into a bank account, withdrawing cash from a bank, or transferring funds between two
of the company's own bank accounts. A Contra Voucher never touches a party, expense, or
income ledger — that is precisely what distinguishes it from Payment/Receipt Voucher.
`VoucherType.CONTRA` and `DocumentType.CONTRA_VOUCHER` already exist (specs 31, 34) with
no consumer.

Same design resolution as spec 52: **no new Prisma model**. A Contra Voucher *is* a
`Voucher` — nothing to add to `schema.prisma`.

**This is the strictest of the four voucher types by entry count.** Unlike Payment/
Receipt Voucher's "one restricted side, one-or-more free side" and Journal Voucher's
fully freeform shape, a Contra Voucher is **exactly one Debit entry and exactly one
Credit entry, both restricted to the Cash-in-Hand-or-`BankAccount`-linked ledger class,
and the two ledgers must differ**. A multi-way split (e.g. one bank withdrawal funding
two different cash-equivalent ledgers at once) was considered and rejected: "Contra"
in Indian accounting practice denotes a single fund transfer between the company's own
liquid accounts, and a business genuinely needing to record a bank withdrawal split
across two destinations can record it as two separate Contra Vouchers (each a clean,
independently-cancellable 1:1 transfer) rather than this screen inventing a many-to-many
shape the underlying concept doesn't call for. If a real multi-way-split requirement ever
surfaces, that is a new, explicitly-scoped decision for a future spec, not a speculative
widening of this one.

---

# Project Context

Before implementation, review

- `52-payment-voucher.md` (**read this first in full** — the shared-module structure,
  the shared Cash/Bank ledger-class helper this spec reuses on *both* sides at once, the
  UI/wire-up pattern)
- `31-voucher-engine.md`, `34-document-number-engine.md`, `14-ledger-master.md` /
  `15-bank-management.md` (same ground truth as spec 52)

---

# Module Responsibilities

The Contra Voucher module is responsible for

- A Create/View/Cancel screen over `voucherEngine.postVoucher`/`cancelVoucher`, scoped to
  `VoucherType.CONTRA`
- The Contra-specific validation shape: exactly one Debit + exactly one Credit entry,
  both restricted to the Cash-in-Hand-or-`BankAccount`-linked ledger class, source ≠
  destination
- Listing/filtering vouchers of this type

The Contra Voucher module is **not** responsible for

- Any new Prisma model, migration, or repository (see Goal)
- A multi-way fund split (see Goal — recorded as a deliberate, non-speculative exclusion)
- Any entry touching a party/expense/income ledger — a transfer where either side is
  outside the Cash/Bank class is not a Contra Voucher and is rejected outright, not
  silently reclassified

---

# Data Model

**No new Prisma model, enum, or migration.** `VoucherType.CONTRA` /
`DocumentType.CONTRA_VOUCHER` already exist.

---

# Business Rules

Enforced in this module's thin service layer, before calling
`voucherEngine.postVoucher`:

- **Entry shape**: exactly 2 entries — one `DEBIT`, one `CREDIT`. Neither more nor fewer;
  this is the one manual-voucher type that does *not* allow a variable-length side (see
  Goal for why).
- **Both-sides ledger-class restriction**: both the Debit and the Credit ledger must
  resolve to an active, company-owned ledger that is either the seeded Cash-in-Hand
  ledger or carries a `BankAccount` detail row — the same shared helper spec 52 extracts,
  applied to both sides instead of one.
- **Source ≠ destination**: the Debit and Credit `ledgerId` must differ — a Contra
  Voucher moving funds from a ledger to itself is meaningless and rejected.
- **Balance**: trivially holds by construction (one Debit amount equals the one Credit
  amount) — still delegated to `postVoucher`'s own balance check, not assumed.
- **Cancellation**: `cancelContraVoucher(id)` — thin pass-through to
  `voucherEngine.cancelVoucher`, scoped to vouchers of this type.
- **Company-scoped**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/manual-vouchers/services/contra-voucher-service.ts
src/modules/manual-vouchers/validation/contra-voucher-schema.ts
src/modules/manual-vouchers/actions/contra-voucher-actions.ts
```

Same shared `src/modules/manual-vouchers/` home, no repository. `ManualVoucherForm`
(spec 52's shared component) covers this screen with `voucherType="CONTRA"`, configured
for its fixed 2-entry, both-sides-restricted shape (the form's "which side is
restricted" configuration point becomes "both sides restricted, no add-line control" for
this type specifically — the one place the shared form's per-type configuration meaningfully
diverges from Payment/Receipt's one-restricted-side shape).

- `contraVoucherService`: `listContraVouchers(filters)`, `getContraVoucher(id)`,
  `postContraVoucher(input)`, `cancelContraVoucher(id)`.

---

# Validation

Zod (`contra-voucher-schema.ts`): `voucherDate` calendar date, `narration` ≤ 500,
`fromLedgerId` (Credit side) and `toLedgerId` (Debit side) both uuid, `amount` > 0 with
≤ 2 decimals, object-level refine `fromLedgerId !== toLedgerId`. Both ledger ids are
re-verified server-side against the shared Cash/Bank ledger-class helper — the schema
only checks shape and the inequality, never trusts a client claim about either ledger's
class.

---

# UI

Pages (under `/accounting`)

- `/accounting/contra-vouchers` — list (Number, Date, From, To, Amount, Status, Actions)
  with search + date filter
- `/accounting/contra-vouchers/new` — Create (two ledger pickers, both restricted to the
  Cash-in-Hand-or-`BankAccount`-linked ledger set, one amount field, narration — no
  add-line control, since the entry count is fixed at exactly one pair)
- `/accounting/contra-vouchers/[id]` — View (read-only, Cancel action, no Edit)

Wire-up

- Add a "Contra Vouchers" card to the `/accounting` hub page (the third of four).
- Add `contra-vouchers: "Contra Vouchers"` to `src/constants/breadcrumbs.ts`.

---

# Security

Identical to spec 52: `accounting` module, `view`/`create`/`approve` (used by Cancel)/
`export`; `edit`/`delete` not implemented.

---

# Database

No new model, enum, or migration.

---

# Code Standards

Strict TypeScript, no `any`, vitest coverage for: the fixed-2-entry rule (rejects a third
entry or a single entry), the both-sides ledger-class rejection matrix (either side
outside Cash/Bank rejected, reusing the shared helper's test fixture), the
source-≠-destination rejection, and `cancelContraVoucher` rejecting a non-`CONTRA`
voucher id.

---

# Do Not

Do not implement

- A `ContraVoucher` Prisma model or any new migration
- A multi-way fund split (see Goal — a deliberate exclusion, not a gap)
- Any entry against a party/expense/income ledger — reject, don't silently coerce
- Edit of a posted voucher, changes to `voucherEngine` itself, printing/PDF/WhatsApp

---

# Success Criteria

Verify

- A Contra Voucher posts with exactly one Debit and one Credit entry, both against
  distinct Cash-in-Hand-or-`BankAccount`-linked ledgers; a third entry, a single entry, a
  same-ledger source/destination, or either side outside the Cash/Bank class is rejected
  before `postVoucher` is called.
- The posted voucher's `voucherNumber` is generated from `DocumentType.CONTRA_VOUCHER`
  and is strictly increasing per company/FY.
- Cancelling a posted Contra Voucher produces the correct mirrored reversal; cancelling
  by an id belonging to a different voucher type is rejected.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/accounting/contra-vouchers*` appears in the build route table.

Feature-spec 54 (this spec) is `context/Phases/phase-tracker.md`'s Phase 6 item #52.
Feature-spec 55 (Journal Voucher, tracker #53) is next and last.
