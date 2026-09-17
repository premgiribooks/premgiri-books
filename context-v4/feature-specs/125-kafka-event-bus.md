# 125 - Kafka Event Bus

> Feature-spec file number 125. Milestone v4, Phase 3, tracker **#116**.
> Depends On: Phase 2 services exist (Kafka must be running before services produce events).

## Goal

Deploy a Kafka cluster in KRaft mode (no ZooKeeper) and implement the producer/consumer
infrastructure used by all microservices for cross-domain event streaming.

---

## Kafka Deployment (K8s StatefulSet)

```yaml
Kafka KRaft: 3 broker/controller nodes
  Namespace: premgiri-data
  PVC: 50Gi per broker (gp3 StorageClass)
  Image: apache/kafka:3.7
  Mode: KRaft (no ZooKeeper)
  Replication factor: 3
  Min ISR: 2
```

---

## Topics

| Topic | Partitions | Retention | Purpose |
|---|---|---|---|
| `premgiri.sales.invoice.posted` | 12 | 7 days | Sales invoice events |
| `premgiri.sales.invoice.cancelled` | 12 | 7 days | |
| `premgiri.sales.return.posted` | 12 | 7 days | |
| `premgiri.sales.creditnote.posted` | 12 | 7 days | |
| `premgiri.sales.debitnote.posted` | 12 | 7 days | |
| `premgiri.purchase.invoice.posted` | 12 | 7 days | |
| `premgiri.purchase.invoice.cancelled` | 12 | 7 days | |
| `premgiri.purchase.return.posted` | 12 | 7 days | |
| `premgiri.inventory.stock.changed` | 12 | 7 days | |
| `premgiri.accounting.voucher.posted` | 12 | 7 days | |
| `premgiri.*.dlq` | 3 | 30 days | Dead letter queues |

Partition key: `companyId` (ensures ordering within a company).

---

## KafkaProducerService

```typescript
class KafkaProducerService {
  async emit<T>(topic: string, companyId: string, event: T): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{
        key: companyId,
        value: JSON.stringify({
          eventId: uuid(),
          eventType: topic.split('.').pop(),
          companyId,
          timestamp: new Date().toISOString(),
          payload: event,
        }),
      }],
    })
  }
}
```

---

## Consumer Retry + DLQ Policy

```
Attempt 1: immediate
Attempt 2: 1 second delay
Attempt 3: 5 second delay
→ After 3 failures: route to premgiri.{topic}.dlq
→ DLQ messages: manual inspect + replay via Admin UI
```

---

## Kafka UI (Development)

Deploy `provectuslabs/kafka-ui` in `premgiri-infra` namespace (development only).
Accessible at `/admin/kafka-ui` (Super Admin only, not exposed externally).

---

## Testing Requirements

- Message with `companyId` key lands in the correct partition (partition isolation)
- Consumer processes message exactly once (idempotency check via `processed_events`)
- Failed message (3 retries) lands in DLQ
- DLQ message can be replayed manually and processed successfully
- Kafka cluster: broker failure → messages still delivered (replication factor 3)
