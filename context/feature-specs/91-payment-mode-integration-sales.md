# 91 - Payment Mode Integration — Sales Documents

> Feature-spec file number 91 (spec-file numbers are sequential and never reused — the
> highest prior file was `90-quick-create-and-item-search.md`). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 11 — Payment & Collections Management**
> item **#84 Payment Mode Integration — Sales Documents**.
>
> Depends On: Payment Mode Master (#83, spec 86, ✅ implemented); Sales Invoice
> (spec 38, ✅); Sales Return (spec 39, ✅); Credit Note (spec 40, ✅); Debit Note
> (spec 41, ✅).
>
> **Read `86-payment-mode-master.md` in full before implementing** — this spec is the
> first real consumer of `PaymentMode`, and it implements the ledger-class-matching
> validator (`CASH` vs. `BANK` vs. `NEITHER`) that spec 86 deliberately deferred to here.

## Goal

Extend every **Sales-side payment line** in this app to require an explicit **Payment
Mode** selection alongside the existing ledger picker, so that every receipt from a
customer is classified as Cash, Bank Transfer, UPI, Card, Cheque, or a company-defined
mode.

Sales documents with payment lines in scope:
- **Sales Invoice** (`38-sales-invoice.md`) — `payments[]` array, each with `ledgerId` + `amount`
- **Sales Return** (`39-sales-return.md`) — `refundPayments[]` array (same shape)
- **Credit Note** (`40-credit-note.md`) — refund line if refund mode is Cash/Bank
- **Debit Note** (`41-debit-note.md`) — does not have a cash payment line; **excluded**

**This spec is deliberately narrow.** It adds `paymentModeId` to the payment line
schema and enforces ledger-class compatibility. It does **not** change accounting
entries, does **not** change voucher posting logic, and does **not** build reporting on
payment mode distribution — that is a future reports concern.

---

## Project Context

Read before implementation:

1. `86-payment-mode-master.md` — `PaymentMode.ledgerClass` enum
   (`CASH`/`BANK`/`ANY`) and the seeded five defaults.
2. `52-payment-voucher.md` — `src/lib/ledger-class.ts`'s existing
   `assertLedgersAreCashOrBank` / `getCashAndBankLedgerIds` — **this spec extracts a
   more granular three-way classifier from that helper** (see Module Responsibilities).
3. `38-sales-invoice.md` — current `payments[]` schema and posting logic;
   `SalesInvoicePaymentInput` Zod shape.
4. `39-sales-return.md` / `40-credit-note.md` — refund payment shapes.

---

## Module Responsibilities

### New shared utility: `src/lib/ledger-class.ts` — extend existing file

Extract a three-way ledger-class classifier from the existing binary
`isCashOrBankClass` helper:

```typescript
// NEW — added to src/lib/ledger-class.ts:
export type LedgerPaymentClass = "CASH" | "BANK" | "NEITHER";

export async function getLedgerPaymentClass(
  ledgerId: string,
  companyId: string,
): Promise<LedgerPaymentClass>
```

This function determines whether a ledger is the Cash-in-Hand ledger (`CASH`), a
`BankAccount`-linked ledger (`BANK`), or neither (`NEITHER`) — the three-way
classification spec 86 named but deferred.

### New validation helper: `assertPaymentModeMatchesLedger`

```typescript
// src/lib/payment-mode-validation.ts (new file)
export async function assertPaymentModeMatchesLedger(
  paymentModeId: string,
  ledgerId: string,
  companyId: string,
): Promise<void>
```

Rules:
- `PaymentMode.ledgerClass === "CASH"` → ledger must be `LedgerPaymentClass.CASH`
- `PaymentMode.ledgerClass === "BANK"` → ledger must be `LedgerPaymentClass.BANK`
- `PaymentMode.ledgerClass === "ANY"` → any Cash or Bank ledger is valid
- On mismatch → throws `AppError` with a clear message: e.g.
  `"Payment mode 'Cash' requires a Cash-in-Hand ledger."`

### Schema changes (Prisma)

Add `paymentModeId` to `SalesInvoicePayment`:

```prisma
model SalesInvoicePayment {
  // existing fields unchanged
  paymentModeId String
  paymentMode   PaymentMode @relation(fields: [paymentModeId], references: [id])
}
```

Same pattern for `SalesReturnRefund` and `CreditNoteRefund`.

**Migration**: one migration adds `paymentModeId NOT NULL` with a backfill default (the
seeded "Cash" payment mode's ID, resolved by a data-migration SQL step in the same
migration file). The column is `NOT NULL` going forward — every new payment line must
name a mode.

---

## Business Rules

1. A payment line's `paymentModeId` must match the ledger's own class
   (enforced by `assertPaymentModeMatchesLedger` at posting time, not just UI).
2. The seeded Payment Mode defaults (Cash/Bank Transfer/UPI/Card/Cheque) cover every
   common payment method — a company that has not added custom modes will never see a
   missing-mode error.
3. Only **active** Payment Modes may be selected on a new payment line. Inactive modes
   remain visible on existing posted documents (read-only — they are historical records).
4. The ledger picker and the payment mode picker are presented **together** — changing
   the ledger resets the payment mode to the closest matching active mode (UX hint only;
   the server validates independently).
5. Existing posted Sales Invoices/Returns/Credit Notes are backfilled to "Cash" mode by
   the migration. This is a technical default — no business logic is re-run.

---

## Data Model

```prisma
model SalesInvoicePayment {
  id             String      @id @default(uuid())
  salesInvoiceId String
  ledgerId       String
  amount         Decimal
  reference      String?
  paymentModeId  String                          // NEW
  paymentMode    PaymentMode @relation(...)      // NEW

  salesInvoice  SalesInvoice @relation(...)
  ledger        Ledger       @relation(...)
}
```

Same additions to `SalesReturnRefund` and `CreditNoteRefund`.

---

## API / Server Actions

- `salesInvoiceActions.postSalesInvoice` — `SalesInvoicePaymentInput` gains
  `paymentModeId: string` (required); `assertPaymentModeMatchesLedger` called for
  each payment line before the transaction.
- `salesReturnActions.postSalesReturn` — same pattern on `refundPayments`.
- `creditNoteActions.postCreditNote` — same pattern on the refund line, if present.

---

## UI

- Sales Invoice New/Edit form: every payment line gains a **Payment Mode** dropdown
  (populated from `paymentModeService.listPaymentModes()`, active only) placed
  immediately before the Ledger picker.
- Default selection: the first active mode whose `ledgerClass` matches the currently
  selected ledger (auto-selected on ledger change; user can override).
- Same pattern for Sales Return and Credit Note refund lines.
- The payment mode name is shown on the Sales Invoice detail/print view.

---

## v3 Compatibility Note

This spec is fully compatible with v3. The `paymentModeId` foreign key on
`SalesInvoicePayment` uses a plain `@relation` to `PaymentMode`, which lives in the
**Masters** domain — both `SalesInvoicePayment` (Sales domain) and `PaymentMode`
(Masters domain) are in scope. Per v3 Bridge Decision E
(`context-v3/architecture-context.md`), this cross-domain `@relation` must be
evaluated in spec 110b (Schema Domain Segmentation Audit). The recommendation for v4 is
to store `paymentModeId` as a plain `String` (no `@relation`) in the Sales
microservice's own database and resolve the mode name via a lookup in the Masters
microservice — but this change is deferred to v4 (spec 117 — Masters Service).

---

## Testing Requirements

- Valid: Cash mode + Cash-in-Hand ledger succeeds
- Valid: Bank mode + BankAccount-linked ledger succeeds
- Valid: ANY mode + either Cash or Bank ledger succeeds
- Invalid: Cash mode + Bank ledger → `AppError`
- Invalid: Bank mode + Cash ledger → `AppError`
- Invalid: inactive payment mode → `AppError`
- Backfill: existing posted invoices with no `paymentModeId` resolve to "Cash" after migration
- Existing tests for Sales Invoice posting continue to pass (backfilled fixtures have a mode)
