# 121 - Accounting & Voucher Service

> Feature-spec file number 121. Milestone v4, Phase 2, tracker **#112**.
> Depends On: spec 125 (Kafka); engine-service (Voucher Engine via gRPC).

## Goal

Extract the accounting domain (Vouchers, VoucherEntries, Ledgers, LedgerGroups,
BankAccounts, ManualVouchers, LiabilitySettlement, Payroll) into a standalone
`accounting-service`.

---

## Owns (in per-company DB)

Vouchers, VoucherEntries, Ledgers, LedgerGroups, BankAccounts, ManualVouchers,
PaymentModes, LiabilitySettlement, PayrollRuns, PayrollRunItems

---

## Kafka Events Consumed

| Topic | Action |
|---|---|
| `premgiri.sales.invoice.posted` | Call VoucherEngine → create SALES voucher |
| `premgiri.sales.invoice.cancelled` | Call VoucherEngine → cancel voucher |
| `premgiri.sales.return.posted` | Create SALES_RETURN voucher |
| `premgiri.purchase.invoice.posted` | Create PURCHASE voucher |
| `premgiri.purchase.return.posted` | Create PURCHASE_RETURN voucher |
| `premgiri.sales.creditnote.posted` | Create CREDIT_NOTE voucher |
| `premgiri.sales.debitnote.posted` | Create DEBIT_NOTE voucher |

---

## Kafka Events Produced

| Topic | When |
|---|---|
| `premgiri.accounting.voucher.posted` | Voucher successfully created |

---

## VoucherEngine Usage (gRPC to engine-service)

```
accounting-service consumes 'sales.invoice.posted'
    → calls engine-service gRPC: PostVoucher(companyId, voucherInput)
    → engine-service validates and returns VoucherResult
    → accounting-service persists Voucher + VoucherEntries rows
    → emits 'accounting.voucher.posted'
```

The VoucherEngine logic does NOT move into accounting-service — it stays in
engine-service. Accounting-service is just the orchestrator + persistence layer.

---

## Redis Caching

| Key | TTL |
|---|---|
| `{cid}:accounting:ledger:{id}:balance` | 30 seconds |
| `{cid}:accounting:trial-balance` | 60 seconds |

---

## Testing Requirements

- `sales.invoice.posted` event results in a balanced SALES voucher persisted
- Idempotency: same `eventId` twice → only one voucher created
- Ledger balance query reflects all posted vouchers
- Manual voucher (Payment/Receipt/Contra/Journal) flow unchanged from v3
