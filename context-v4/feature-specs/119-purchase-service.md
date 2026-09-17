# 119 - Purchase Service

> Feature-spec file number 119. Milestone v4, Phase 2, tracker **#110**.
> Depends On: spec 117 (Masters Service); spec 125 (Kafka).

## Goal

Extract the complete purchase domain into a standalone `purchase-service`.

---

## Owns (in per-company DB)

PurchaseOrders, PurchaseOrderItems, GoodsReceiptNotes, GoodsReceiptNoteItems,
PurchaseInvoices, PurchaseInvoiceItems, PurchaseInvoicePayments,
PurchaseReturns, PurchaseReturnItems

---

## Kafka Events Produced

| Event Topic | When |
|---|---|
| `premgiri.purchase.invoice.posted` | PurchaseInvoice posted |
| `premgiri.purchase.invoice.cancelled` | PurchaseInvoice cancelled |
| `premgiri.purchase.return.posted` | PurchaseReturn posted |

Payload for `purchase.invoice.posted` mirrors `sales.invoice.posted` with
`supplierId` instead of `customerId` and `IN` direction for stock.

---

## Testing Requirements

- Same pattern as spec 118 (Sales Service) — mirror image on the purchase side
- GRN `markInvoiced` is idempotent
- `purchase.invoice.posted` event consumed by inventory-service creates an IN stock transaction
