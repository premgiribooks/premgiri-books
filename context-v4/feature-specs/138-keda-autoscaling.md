# 138 - KEDA Event-Driven Autoscaling

> Feature-spec file number 138. Milestone v4, Phase 6, tracker **#129**.
> Depends On: spec 137 (HPA + VPA); spec 125 (Kafka running).

## Goal

Deploy KEDA (Kubernetes Event-Driven Autoscaling) to scale consumer pods based on
Kafka consumer group lag and to scale services to zero when idle (e.g., at night
when no businesses are using the system).

---

## Why KEDA?

Standard HPA scales on CPU/memory. But Kafka consumer pods may be idle (low CPU)
even when the message queue is growing. KEDA scales based on **message lag** —
the number of unprocessed messages in a Kafka partition.

---

## KEDA ScaledObjects

### inventory-service (scales on Kafka lag)
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: inventory-service-scaler
  namespace: premgiri-business
spec:
  scaleTargetRef:
    name: inventory-service
  minReplicaCount: 0          # Scale to ZERO when no messages
  maxReplicaCount: 20
  cooldownPeriod: 300          # Wait 5 min before scaling down to 0
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka.premgiri-data:9092
        consumerGroup: inventory-service
        topic: premgiri.sales.invoice.posted
        lagThreshold: "10"     # 1 pod per 10 unprocessed messages
        activationLagThreshold: "1"
```

### accounting-service (same pattern)
```yaml
triggers:
  - type: kafka
    metadata:
      topic: premgiri.sales.invoice.posted
      lagThreshold: "10"
  - type: kafka
    metadata:
      topic: premgiri.purchase.invoice.posted
      lagThreshold: "10"
```

### reporting-service (scales to zero at night)
```yaml
triggers:
  - type: cron
    metadata:
      timezone: Asia/Kolkata
      start: "0 9 * * 1-6"    # Scale up: 9 AM Mon-Sat
      end: "0 21 * * 1-6"     # Scale down: 9 PM Mon-Sat
      desiredReplicas: "3"
  - type: kafka
    metadata:
      topic: premgiri.accounting.voucher.posted
      lagThreshold: "5"
```

---

## Scale-to-Zero Policy

Services that can safely scale to zero (when no messages pending):
- `inventory-service` — pure Kafka consumer, stateless
- `accounting-service` — Kafka consumer + REST API
- `reporting-service` — read-only, has Redis caching

Services that must never scale to zero:
- `auth-service` — always needed for login
- `api-gateway` — always needed for routing
- `company-service` — needed for session resolution

---

## Testing Requirements

- Scale-to-zero: after 5 minutes with no Kafka messages, inventory-service reaches 0 pods
- Scale-up: 100 messages posted → KEDA scales inventory-service from 0 to N pods in < 60s
- Cold start: pod starts from 0, processes all queued messages, then scales back to 0
- Cron trigger: reporting-service scales up at 9 AM and down at 9 PM IST
