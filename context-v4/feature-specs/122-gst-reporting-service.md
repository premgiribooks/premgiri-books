# 122 - GST + Reporting Service

> Feature-spec file number 122. Milestone v4, Phase 2, tracker **#113**.
> Depends On: All other services (reads cross-domain data via gRPC).

## Goal

Extract GST reporting and Financial/Operational reports into a standalone
`reporting-service` (which includes GST). This is the last service extracted
because it reads data from all other domains.

---

## Owns

No own DB tables — this is a pure read service. It calls other services via gRPC
to aggregate data, computes reports in memory, and returns results.

Writes: `GstFilingRecord` (advisory "mark period filed") — the only table owned here.

---

## Reports Provided

**Financial**: Trial Balance, P&L, Balance Sheet, Cash Flow
**Operational**: Sales Reports, Purchase Reports, Inventory Reports,
  Customer Reports, Supplier Reports, Employee Reports
**GST**: GST Registers, GSTR-1, GSTR-2, GSTR-3B, HSN Summary, ITC Register
**AI Insights**: Calls engine-service → AI Insights Engine (spec 107)

---

## Redis Caching (aggressive — reports are expensive)

| Key | TTL |
|---|---|
| `{cid}:reports:trial-balance:{year}:{asOf}` | 5 min |
| `{cid}:reports:pl:{year}:{from}:{to}` | 5 min |
| `{cid}:reports:gstr1:{year}:{period}` | 10 min |
| `{cid}:reports:sales-summary:{from}:{to}` | 3 min |

Cache invalidated on `accounting.voucher.posted` event (Kafka consumer in reporting-service).

---

## Kafka Events Consumed

| Topic | Action |
|---|---|
| `premgiri.accounting.voucher.posted` | Invalidate report caches for the company |
| `premgiri.inventory.stock.changed` | Invalidate inventory report caches |

---

## Testing Requirements

- Trial Balance totals match sum of all voucher entries (cross-verified)
- GST report caches invalidated within 5 seconds of a new voucher being posted
- Report generation time < 2 seconds for companies with 10,000 vouchers (with cache)
- Report generation time < 5 seconds without cache (cold path)
