# 93 - Payment Mode Integration — Manual Vouchers

> Feature-spec file number 93 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 11 — Payment & Collections
> Management** item **#86 Payment Mode Integration — Manual Vouchers**.
>
> Depends On: Payment Mode Master (#83, spec 86, ✅); Payment Mode Integration — Sales
> Documents (#84, spec 91, ✅ — for `assertPaymentModeMatchesLedger` and
> `getLedgerPaymentClass`); Payment Voucher (spec 52, ✅); Receipt Voucher (spec 53, ✅);
> Contra Voucher (spec 54, ✅).
>
> Journal Voucher (spec 55) is **excluded** — it posts arbitrary ledger debit/credit
> entries and already uses `assertLedgersAreCashOrBank` to allow any ledger class; adding
> a "payment mode" concept to a general journal entry adds no meaningful classification.
>
> **Read `91-payment-mode-integration-sales.md` in full before implementing** — the
> `assertPaymentModeMatchesLedger` and `getLedgerPaymentClass` helpers from that spec
> are reused here unchanged.

## Goal

Extend the three manual-voucher types that involve actual cash/bank movement —
**Payment Voucher**, **Receipt Voucher**, and **Contra Voucher** — to record the
**Payment Mode** used, so that cash-flow analysis and payment reconciliation can later
distinguish "received via UPI" from "received by cheque" for the same Bank ledger.

**This is the last Payment Mode Integration spec.** After this, every payment/receipt
event in the system — Sales Invoice, Sales Return, Credit Note (spec 91), Purchase
Invoice, Purchase Return (spec 92), and the three direct-payment vouchers (this spec)
— carries a structured Payment Mode.

**Scope clarification:**
- Payment Voucher: money going **out** (paying a supplier, settling a liability)
- Receipt Voucher: money coming **in** (receiving a customer payment)
- Contra Voucher: internal cash/bank transfer (Cash → Bank, Bank → Bank)
- Journal Voucher: **excluded** (arbitrary double-entry; no cash-movement semantics)

---

## Project Context

Read before implementation:

1. `91-payment-mode-integration-sales.md` — the shared helpers.
2. `52-payment-voucher.md` — the current Payment Voucher schema, Zod shape, and
   `assertLedgersAreCashOrBank` enforcement. The Cash/Bank side is the side that
   gains `paymentModeId`.
3. `53-receipt-voucher.md` — same structure as Payment Voucher, mirror of spec 52.
4. `54-contra-voucher.md` — both sides are Cash/Bank; **one** `paymentModeId` covers
   the whole Contra Voucher (not per-line, since both sides are always cash/bank and
   the mode describes the transfer mechanism, not a ledger).

---

## Module Responsibilities

No new shared utilities — reuse `assertPaymentModeMatchesLedger` and
`getLedgerPaymentClass` from spec 91.

### Schema changes (Prisma)

Add `paymentModeId` to `Voucher` (not `VoucherEntry` — the mode is a document-level
attribute, not a per-line attribute):

```prisma
model Voucher {
  // existing fields unchanged
  paymentModeId String?               // nullable — null for Journal and auto-posted vouchers
  paymentMode   PaymentMode? @relation(...)   // NEW
}
```

`paymentModeId` is **nullable** on `Voucher` because:
- Journal Vouchers have no payment mode (excluded from this spec)
- Auto-posted SALES/PURCHASE/etc. vouchers (posted by invoice service) also have no
  payment-mode concept at the voucher level — mode is recorded on the
  `SalesInvoicePayment` / `PurchaseInvoicePayment` lines (specs 91/92)
- Only manually-created Payment/Receipt/Contra Vouchers must supply a mode

**Migration**: one migration adds nullable `paymentModeId` to `Voucher`. No backfill is
required — existing posted manual vouchers remain `null` (historical records without a
mode, which is accurate).

---

## Business Rules

1. **Payment Voucher** and **Receipt Voucher**: `paymentModeId` is **required** on
   the Cash/Bank side (the side validated by `assertLedgersAreCashOrBank`). The
   mode's `ledgerClass` must match the selected Cash/Bank ledger
   (`assertPaymentModeMatchesLedger`).
2. **Contra Voucher**: one `paymentModeId` for the whole voucher (the transfer
   mechanism). Both sides are Cash/Bank by definition; `ledgerClass = "ANY"` is
   always valid (a Contra Voucher between two bank accounts or between cash and bank
   uses whatever mode the transfer was made through).
3. **Journal Voucher**: no `paymentModeId` field on the form; `paymentModeId` remains
   `null` on the posted `Voucher` row. The form must not render a payment mode picker.
4. **Auto-posted vouchers** (SALES, PURCHASE, SALES_RETURN, etc., posted by document
   services): `paymentModeId` remains `null`. The mode is captured at the
   `SalesInvoicePayment`/`PurchaseInvoicePayment` line level (specs 91/92).
5. Only active Payment Modes may be selected.
6. Inactive modes remain visible on existing posted vouchers (read-only history).

---

## API / Server Actions

- `paymentVoucherActions.postPaymentVoucher` — gains `paymentModeId: string`
  (required); validated against the Cash/Bank ledger.
- `receiptVoucherActions.postReceiptVoucher` — same.
- `contraVoucherActions.postContraVoucher` — gains `paymentModeId: string` (required).
- `journalVoucherActions.postJournalVoucher` — **unchanged**; `paymentModeId` is not
  in its schema.

### Liability Settlement prefill note

Spec 87 (Liability Settlement) pre-fills Payment Voucher's New screen via query params
(`debitLedgerId`, `amount`). This spec adds `paymentModeId` as a new **optional** query
param. When Liability Settlement passes a `paymentModeId` hint, the form pre-selects
that mode; if absent (existing Liability Settlement links), the form defaults to the
first matching active mode (same auto-select logic as spec 91). No change to spec 87's
service or engine — only the URL construction and form prefill helper are extended.

---

## UI

- **Payment Voucher** New/Edit form: a **Payment Mode** dropdown added alongside the
  Cash/Bank ledger picker (same position and auto-select logic as spec 91).
- **Receipt Voucher** New/Edit form: same.
- **Contra Voucher** New/Edit form: one Payment Mode dropdown at the voucher header
  level (not per-line), labeled "Transfer Method."
- **Journal Voucher** New/Edit form: **no change**.
- The payment mode name is shown on the Payment/Receipt/Contra Voucher detail view.

---

## v3 Compatibility Note

`Voucher.paymentModeId` is a cross-domain `@relation` (Accounting → Masters) that spec
110b (Schema Domain Segmentation Audit) must evaluate. In v4, `paymentModeId` is stored
as a plain `String` in the Accounting microservice's own database and resolved via the
Masters microservice for display — the `@relation` is removed during v4 extraction.

**v3 Bridge Decision E rule (`context-v3/architecture-context.md`):** no *new* v3
specs may add cross-domain `@relation` entries. This spec is the final v2 spec and is
therefore grandfathered — but spec 110b must list it as a known cross-domain FK to
resolve in v4.

---

## Testing Requirements

- Payment Voucher: required mode, valid class match, invalid class → `AppError`
- Receipt Voucher: same matrix
- Contra Voucher: `ledgerClass = "ANY"` → any Cash or Bank mode is valid
- Journal Voucher: `paymentModeId` field absent from schema and form
- Auto-posted vouchers: `paymentModeId` is null after posting (no regression)
- Spec 87's prefill path: `paymentModeId` query param pre-selects the correct mode;
  missing/invalid param falls back to form default (no crash)
- Existing payment/receipt/contra voucher tests pass (mode now required — update
  fixtures to include a `paymentModeId`)
