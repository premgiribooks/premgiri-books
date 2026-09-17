# 120 - Inventory Service

> Feature-spec file number 120. Milestone v4, Phase 2, tracker **#111**.
> Depends On: spec 117 (Masters Service); spec 125 (Kafka).

## Goal

Extract the inventory domain into a standalone `inventory-service`. This service
is a **pure Kafka consumer + REST API** — it never initiates cross-service calls.
Inventory state is changed only in response to domain events.

---

## Owns (in per-company DB)

StockTransactions, StockAdjustments, StockTransfers, PhysicalVerifications,
OpeningStock references (via StockTransaction), ProductBatches (shared with masters
but inventory owns the movement records)

---

## Kafka Events Consumed

| Topic | Action |
|---|---|
| `premgiri.sales.invoice.posted` | Record OUT stock movements for each line |
| `premgiri.sales.invoice.cancelled` | Reverse OUT movements |
| `premgiri.sales.return.posted` | Record IN stock movements (returned goods) |
| `premgiri.purchase.invoice.posted` | Record IN stock movements |
| `premgiri.purchase.invoice.cancelled` | Reverse IN movements |
| `premgiri.purchase.return.posted` | Record OUT stock movements |

---

## Kafka Events Produced

| Topic | When |
|---|---|
| `premgiri.inventory.stock.changed` | After any stock movement is recorded |

---

## Redis Caching

| Key | TTL | Notes |
|---|---|---|
| `{cid}:inventory:stock:{productId}:{warehouseId}` | 60 seconds | Short TTL — stock changes frequently |

---

## Consumer Idempotency

Every consumer handler checks `processed_events` table:
```sql
INSERT INTO processed_events (event_id, processed_at)
VALUES ($1, NOW())
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id
```
If `event_id` already exists, skip processing and ack the message.

---

## Testing Requirements

- `sales.invoice.posted` event creates correct OUT transactions for each line
- Duplicate event delivery (same `eventId` twice) creates only one set of movements
- Stock balance correctly reflects all IN/OUT movements
- `inventory.stock.changed` event emitted after each movement
