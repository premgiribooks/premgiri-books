# 55 - Journal Voucher

> Feature-spec file number 55 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 7 — Accounting** item **#54
> Journal Voucher** — the fourth and last of the four manual voucher screens (#51–#54).
> Depends on the Voucher Engine (feature-spec 31, implemented) and the Document Number
> Engine (feature-spec 34, implemented). **Read `52-payment-voucher.md` first in full**
> for the shared design resolution and module structure — this spec is the *least*
> restrictive of the four, and closes out Phase 7.

## Goal

Implement the **Journal Voucher** screen for **Premgiri Books ERP** — the
general-purpose, unrestricted manual entry: any combination of Debit/Credit entries
against any active company ledgers, as long as the whole set balances. This is the direct
UI over `voucherEngine.postVoucher` with **no additional entry-shape narrowing at all**
beyond what spec 31 already enforces (≥2 entries, sum Debit === sum Credit, every amount
> 0) — used for corrections, accruals, opening-balance-adjustment entries, and anything
Payment/Receipt/Contra Voucher's named, structurally-constrained shapes don't fit.
`VoucherType.JOURNAL` and `DocumentType.JOURNAL_VOUCHER` already exist (specs 31, 34)
with no consumer.

Same design resolution as spec 52: **no new Prisma model**. A Journal Voucher *is* a
`Voucher` — nothing to add to `schema.prisma`. This is, in fact, the *purest* case of that
resolution: a Journal Voucher's screen adds no entry-shape rule of its own whatsoever,
making it the thinnest possible layer over the engine — a permission gate and a form,
nothing else.

**Because it is the least constrained of the four — freeform entries against arbitrary
ledgers, with no structural shape (unlike Payment/Receipt's fixed restricted side, or
Contra's fixed pair) to catch an obviously-wrong entry — posting a Journal Voucher
requires the `approve` permission action, not merely `create`.** The other three types
gate `create` for posting and reserve `approve` for Cancel only (see
`52-payment-voucher.md`'s Security section); Journal Voucher gates **both** Post and
Cancel behind `approve`, since an unrestricted debit/credit entry against any ledger is a
plausible error/fraud surface this project has no structural safeguard against otherwise
— the same posture Purchase/Sales Invoice already takes toward their own least-
constrained, highest-trust operation (a tax override), gating it behind `approve` rather
than the base `create`/`edit` actions.

---

# Project Context

Before implementation, review

- `52-payment-voucher.md` (**read this first in full** — shared module structure, the
  Cash/Bank ledger-class helper — *not used here*, since Journal Voucher restricts
  neither side, see Business Rules — and the UI/wire-up pattern)
- `31-voucher-engine.md`, `34-document-number-engine.md` (same ground truth as spec 52)
- `44-purchase-invoice.md` / `38-sales-invoice.md` (the precedent for gating an
  unrestricted, highest-trust operation behind `approve` rather than the base action —
  their tax-override mechanism, applied here to the whole voucher rather than one line)

---

# Module Responsibilities

The Journal Voucher module is responsible for

- A Create/View/Cancel screen over `voucherEngine.postVoucher`/`cancelVoucher`, scoped to
  `VoucherType.JOURNAL`, with **no entry-shape narrowing** beyond spec 31's own rules
- Gating both Post and Cancel behind the `approve` permission action (see Goal)
- Listing/filtering vouchers of this type

The Journal Voucher module is **not** responsible for

- Any new Prisma model, migration, or repository (see Goal)
- Any ledger-class restriction (Cash-in-Hand/`BankAccount` or otherwise) on any entry —
  a Journal Voucher may freely debit or credit any active company ledger, including the
  Cash/Bank class itself (e.g. a correcting entry that happens to touch a bank ledger is
  legitimate here, unlike Contra Voucher which requires *both* sides to be Cash/Bank)

---

# Data Model

**No new Prisma model, enum, or migration.** `VoucherType.JOURNAL` /
`DocumentType.JOURNAL_VOUCHER` already exist.

---

# Business Rules

- **Entry shape**: whatever `voucherEngine.postVoucher` itself already requires — at
  least 2 entries, every amount > 0 with ≤ 2 decimals, sum(Debit) === sum(Credit) in
  integer paise. This module adds **zero** additional shape constraints on top (contrast
  with specs 52–54, each of which narrows the entry shape further).
- **No ledger-class restriction on any entry** — any active, company-owned ledger,
  including Cash/Bank ledgers, may appear on either side.
- **Permission escalation**: unlike specs 52–54 (where `create` gates Post and `approve`
  gates Cancel only), **both `postJournalVoucher` and `cancelJournalVoucher` require the
  `approve` action** — a plain `create`-only user cannot post or cancel a Journal
  Voucher at all. This is the one deliberate divergence from the other three specs'
  permission shape (see Security).
- **Cancellation**: `cancelJournalVoucher(id)` — thin pass-through to
  `voucherEngine.cancelVoucher`, scoped to vouchers of this type, gated by `approve` per
  above.
- **Company-scoped**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/manual-vouchers/services/journal-voucher-service.ts
src/modules/manual-vouchers/validation/journal-voucher-schema.ts
src/modules/manual-vouchers/actions/journal-voucher-actions.ts
```

Same shared `src/modules/manual-vouchers/` home as specs 52–54, no repository.
`ManualVoucherForm` covers this screen with `voucherType="JOURNAL"`, configured for a
fully freeform entry table (add/remove Debit or Credit lines freely, any ledger picker
with no class restriction) — the least-configured, most-generic instantiation of the
shared form.

- `journalVoucherService`: `listJournalVouchers(filters)`, `getJournalVoucher(id)`,
  `postJournalVoucher(input)` (asserts `approve` before calling `postVoucher` — no
  additional entry-shape check), `cancelJournalVoucher(id)` (asserts `approve`).

**Why one shared `manual-vouchers` module rather than four independent ones** (the
design decision this spec finalizes, since it's the last of the four to be drafted):
all four screens share the exact same underlying persistence (`Voucher`/`VoucherEntry`
via `voucherEngine`), the exact same list/view/cancel plumbing, and the exact same UI
shell (`ManualVoucherForm`) — the only real variation across all four is (a) the
entry-shape rule (none / one-restricted-side / fixed-pair-both-restricted / none) and
(b) the permission action required to post (`create` for three, `approve` for this one).
Four independent modules would each duplicate the same thin list/get/post/cancel
plumbing four times for a difference that is genuinely just configuration, not behavior —
the same "extract the shared helper, don't triple it" reasoning spec 52 applies to the
Cash/Bank ledger-class check applies at the module level too. If a future voucher type
needs meaningfully different persistence or a real extra field, split it out of this
shared module then — not speculatively now.

---

# Validation

Zod (`journal-voucher-schema.ts`): `voucherDate` calendar date, `narration` ≤ 500,
`entries` array ≥ 2 (`ledgerId` uuid, `entryType` enum `DEBIT`/`CREDIT`, `amount` > 0 with
≤ 2 decimals) — no object-level ledger-class refine (unlike specs 52–54), since no
ledger-class restriction applies. The balanced-sum check itself is left to
`voucherEngine.postVoucher`, not duplicated here (mirrors spec 31's own posture: the
engine is the one place this arithmetic lives).

---

# UI

Pages (under `/accounting`)

- `/accounting/journal-vouchers` — list (Number, Date, Narration, Total Amount, Status,
  Actions) with search + date filter
- `/accounting/journal-vouchers/new` — Create (freeform entry table: add/remove Debit or
  Credit lines, any ledger picker, running balance-check indicator so the user sees
  whether Debit/Credit are equal before submitting — a client-side convenience only,
  never the actual enforcement point)
- `/accounting/journal-vouchers/[id]` — View (read-only, Cancel action gated by
  `approve`, no Edit)

Wire-up

- Add a "Journal Vouchers" card to the `/accounting` hub page — **the fourth and final
  card**, completing the `/accounting` hub started in `52-payment-voucher.md`.
- Add `journal-vouchers: "Journal Vouchers"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `accounting` permission module, same as specs 52–54, but with the one
deliberate divergence recorded above: **`approve` gates both Post and Cancel** (not just
Cancel as in specs 52–54). `view`/`export` unchanged from the other three. `edit`/
`delete` not implemented.

---

# Database

No new model, enum, or migration.

---

# Code Standards

Strict TypeScript, no `any`, no arithmetic duplicated outside `voucherEngine`, vitest
coverage for: a plain-`create`-only user being rejected from both Post and Cancel (the
one behavioral difference from specs 52–54's tests), a freeform multi-line entry set
(more than 2 entries, mixed Debit/Credit counts on either side) posting correctly when
balanced, an unbalanced set being rejected by the engine (not silently accepted), and
`cancelJournalVoucher` rejecting a non-`JOURNAL` voucher id.

---

# Do Not

Do not implement

- A `JournalVoucher` Prisma model or any new migration
- Any ledger-class restriction on any entry (that is specifically what distinguishes
  this type from Payment/Receipt/Contra)
- A `create`-level Post/Cancel path — both must require `approve`
- Edit of a posted voucher, changes to `voucherEngine` itself, printing/PDF/WhatsApp

---

# Success Criteria

Verify

- A Journal Voucher posts with any balanced set of ≥2 Debit/Credit entries against any
  active company ledgers (including Cash/Bank ledgers on either side); an unbalanced set
  is rejected by the engine's own check.
- A user with `accounting:create` but not `accounting:approve` cannot post or cancel a
  Journal Voucher; a user with `approve` can do both.
- The posted voucher's `voucherNumber` is generated from `DocumentType.JOURNAL_VOUCHER`
  and is strictly increasing per company/FY.
- Cancelling a posted Journal Voucher produces the correct mirrored reversal; cancelling
  by an id belonging to a different voucher type is rejected.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/accounting/journal-vouchers*` appears in the build route table.

Feature-spec 55 (this spec) is `context/Phases/phase-tracker.md`'s Phase 7 item #54 — the
last item in Phase 7 (Accounting). Completing specs 52–55 completes Phase 7 and its
`/accounting` hub in full. Per `phase-tracker.md`, Phase 8 (GST — GST
Registers, GSTR-1, GSTR-3B, HSN Summary, #55–#58) is next.
