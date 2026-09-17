# 118 - Sales Service

> Feature-spec file number 118. Milestone v4, Phase 2, tracker **#109**.
> Depends On: spec 117 (Masters Service); spec 125 (Kafka — must exist before sales
> events are produced).

## Goal

Extract the complete sales domain (Quotations, SalesOrders, DeliveryChallans,
SalesInvoices, SalesReturns, CreditNotes, DebitNotes) into a standalone `sales-service`.

---

## Owns (in per-company DB)

Quotations, SalesOrders, DeliveryChallans, SalesInvoices, SalesInvoiceItems,
SalesInvoicePayments, SalesReturns, SalesReturnItems, CreditNotes, CreditNoteItems,
DebitNotes, DebitNoteItems

---

## Kafka Events Produced

| Event Topic | When |
|---|---|
| `premgiri.sales.invoice.posted` | SalesInvoice posted |
| `premgiri.sales.invoice.cancelled` | SalesInvoice cancelled |
| `premgiri.sales.return.posted` | SalesReturn posted |
| `premgiri.sales.creditnote.posted` | CreditNote posted |
| `premgiri.sales.debitnote.posted` | DebitNote posted |

Payload for `invoice.posted`:
```json
{
  "eventId": "uuid",
  "companyId": "uuid",
  "invoiceId": "uuid",
  "invoiceNumber": "SI-0001",
  "customerId": "uuid",
  "grandTotal": "12500.00",
  "lines": [
    { "productId": "uuid", "warehouseId": "uuid", "qty": 5, "rate": "2500.00" }
  ],
  "gstBreakdown": { "cgst": "1125.00", "sgst": "1125.00" },
  "timestamp": "ISO8601"
}
```

---

## Cross-Service Dependencies

| Dependency | How |
|---|---|
| Customer lookup | gRPC → masters-service |
| Product + price resolution | gRPC → masters-service + engine-service |
| GST calculation | gRPC → engine-service |
| Voucher posting | Kafka event → accounting-service consumes |
| Inventory deduction | Kafka event → inventory-service consumes |

The sales-service **never** directly calls inventory-service or accounting-service.
It emits events; those services react.

---

## Redis Caching

| Key | TTL |
|---|---|
| `{cid}:sales:invoice:{id}` | 5 min (read-heavy detail pages) |
| `{cid}:sales:invoice:list` | 1 min |

---

## Testing Requirements

- `invoice.posted` Kafka event is emitted with correct payload when invoice is posted
- Idempotency: posting the same invoice twice emits the event once (deduplication key)
- Cross-service isolation: sales-service cannot query inventory-service's tables directly
- Cancellation emits `invoice.cancelled` event with the original `invoiceId`
