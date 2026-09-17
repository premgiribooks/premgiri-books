# 92 - Payment Mode Integration — Purchase Documents

> Feature-spec file number 92 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 11 — Payment & Collections
> Management** item **#85 Payment Mode Integration — Purchase Documents**.
>
> Depends On: Payment Mode Master (#83, spec 86, ✅); Payment Mode Integration — Sales
> Documents (#84, spec 91, ✅ — for the shared `assertPaymentModeMatchesLedger` helper
> and the three-way `getLedgerPaymentClass` classifier it introduces); Purchase Invoice
> (spec 44, ✅); Purchase Return (spec 45, ✅).
>
> **Read `91-payment-mode-integration-sales.md` in full before implementing** — this spec
> reuses the `assertPaymentModeMatchesLedger` helper and the `getLedgerPaymentClass`
> extension spec 91 introduces. Do not re-implement either.

## Goal

Extend every **Purchase-side payment line** to require an explicit **Payment Mode**
selection, mirroring what spec 91 did for Sales documents.

Purchase documents with payment lines in scope:
- **Purchase Invoice** (`44-purchase-invoice.md`) — `payments[]` array (supplier
  advances/immediate payment at posting)
- **Purchase Return** (`45-purchase-return.md`) — refund line (money returned by supplier)
- **Goods Receipt Note** (`43-goods-receipt-note.md`) — **no payment lines; excluded**
- **Purchase Order** (`42-purchase-orders.md`) — **no payment lines; excluded**

**Debit Note** (`41-debit-note.md`) was already excluded from spec 91 — no change here.

---

## Project Context

Read before implementation:

1. `91-payment-mode-integration-sales.md` — the `assertPaymentModeMatchesLedger` helper
   and `getLedgerPaymentClass` three-way classifier introduced there; reused here verbatim.
2. `44-purchase-invoice.md` — current `payments[]` schema and `PurchaseInvoicePaymentInput`
   Zod shape.
3. `45-purchase-return.md` — refund payment shape.
4. `86-payment-mode-master.md` — `PaymentMode.ledgerClass` enum.

---

## Module Responsibilities

No new shared utilities — both `assertPaymentModeMatchesLedger`
(from `src/lib/payment-mode-validation.ts`) and `getLedgerPaymentClass`
(from `src/lib/ledger-class.ts`) were introduced in spec 91 and are reused unchanged.

### Schema changes (Prisma)

Add `paymentModeId` to `PurchaseInvoicePayment` and `PurchaseReturnRefund`:

```prisma
model PurchaseInvoicePayment {
  // existing fields unchanged
  paymentModeId String
  paymentMode   PaymentMode @relation(...)   // NEW
}

model PurchaseReturnRefund {
  // existing fields unchanged
  paymentModeId String
  paymentMode   PaymentMode @relation(...)   // NEW
}
```

**Migration**: one migration adds `paymentModeId NOT NULL` with the same "Cash" backfill
default used in spec 91's migration (same seeded Payment Mode ID).

---

## Business Rules

Identical to spec 91:

1. `paymentModeId` must match the selected ledger's class (validated by
   `assertPaymentModeMatchesLedger` at posting time).
2. Only active Payment Modes may be selected on new payment lines.
3. Inactive modes remain visible on existing posted documents (read-only).
4. Existing posted Purchase Invoices/Returns are backfilled to "Cash" by the migration.
5. The ledger picker and payment mode picker are presented together — see UI.

---

## Data Model

Same pattern as spec 91 — `paymentModeId String` + `@relation` on
`PurchaseInvoicePayment` and `PurchaseReturnRefund`.

---

## API / Server Actions

- `purchaseInvoiceActions.postPurchaseInvoice` — `PurchaseInvoicePaymentInput` gains
  `paymentModeId: string`; `assertPaymentModeMatchesLedger` called per payment line.
- `purchaseReturnActions.postPurchaseReturn` — same pattern.

---

## UI

- Purchase Invoice New/Edit form: each payment line gains a **Payment Mode** dropdown
  (same position and default-selection logic as spec 91's Sales Invoice form).
- Purchase Return form: same pattern on the refund line.
- The payment mode name is shown on the Purchase Invoice detail view.
- No change to Goods Receipt Note or Purchase Order screens (no payment lines).

---

## v3 Compatibility Note

Identical note to spec 91: `PurchaseInvoicePayment.paymentModeId` is a cross-domain
`@relation` (Purchase → Masters) that spec 110b (Schema Domain Segmentation Audit) must
evaluate. In v4, `paymentModeId` is resolved via the Masters microservice; the `@relation`
is removed from the Purchase microservice's own database schema.

---

## Testing Requirements

- Same matrix as spec 91 (Cash/Bank/ANY valid; wrong-class invalid; inactive invalid)
  applied to Purchase Invoice posting and Purchase Return posting
- Backfill: existing posted purchase invoices resolve to "Cash" after migration
- Existing Purchase Invoice tests pass (backfilled fixtures already have a mode)
- `assertPaymentModeMatchesLedger` is not re-tested here — its own test suite in spec 91
  covers it; these tests verify the calling convention is correct
