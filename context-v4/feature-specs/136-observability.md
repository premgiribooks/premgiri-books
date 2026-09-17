# 136 - Observability Stack (Prometheus + Grafana + Loki + Jaeger)

> Feature-spec file number 136. Milestone v4, Phase 5, tracker **#127**.
> Depends On: Phase 2 services (services must emit metrics + traces).

## Goal

Deploy a complete observability stack so engineers can monitor every service's
health, investigate incidents, and understand system behavior under load.

---

## Stack Components

| Tool | Purpose | Namespace |
|---|---|---|
| Prometheus | Metrics collection + alerting | premgiri-infra |
| Grafana | Dashboards + visualization | premgiri-infra |
| Loki | Log aggregation (Pino JSON → Loki) | premgiri-infra |
| Jaeger | Distributed tracing (OpenTelemetry) | premgiri-infra |
| Alertmanager | Route Prometheus alerts to Slack/email | premgiri-infra |

---

## Metrics Every Service Exposes

```typescript
// Standard metrics via prom-client:
http_request_duration_seconds{method, path, status, service}
http_requests_total{method, path, status, service}
kafka_messages_consumed_total{topic, service, result}
kafka_consumer_lag{topic, partition, consumer_group}
cache_hits_total{service, key_type}
cache_misses_total{service, key_type}
db_query_duration_seconds{service, operation, table}
tenant_provisioning_duration_seconds
```

---

## Grafana Dashboards

| Dashboard | Shows |
|---|---|
| System Overview | All services: request rate, error rate, latency (RED) |
| Per-Service Detail | CPU, memory, request rate, error rate, latency percentiles |
| Database | PostgreSQL connections, query latency, slow queries |
| Kafka | Topic lag, consumer group health, message rates |
| Redis | Hit rate, memory usage, eviction rate |
| Kubernetes | Pod count, restart count, CPU/memory per pod |
| Business Metrics | Daily sales total, active companies, invoices posted/hour |

---

## Loki Log Aggregation

All services use Pino logger with JSON output. Promtail (DaemonSet) reads pod logs
and ships to Loki. Query from Grafana: `{service="sales-service"} |= "ERROR"`.

---

## Jaeger Distributed Tracing

Every request gets an OpenTelemetry trace. A trace for "POST /api/v1/sales/invoices"
shows:
1. API Gateway (2ms) → JWT validation
2. Sales Service (50ms) → gRPC call to masters-service
3. Masters Service (8ms) → Redis cache miss → DB query
4. Engine Service (15ms) → GST calculation
5. Kafka produce (3ms) → invoice.posted event
Total: 78ms visible in Jaeger as a single trace

---

## Alerts

| Alert | Condition | Severity |
|---|---|---|
| HighErrorRate | Error rate > 1% for 5 min | Critical |
| SlowAPI | p99 latency > 2s for 5 min | Warning |
| KafkaConsumerLag | Lag > 1000 messages for 10 min | Critical |
| PodCrashLoop | Pod restarts > 5 in 10 min | Critical |
| LowDiskSpace | PVC usage > 80% | Warning |
| TenantProvisioningFailed | Provisioning job failed | Critical |

---

## Testing Requirements

- Prometheus scrapes all service `/metrics` endpoints
- A single request generates a Jaeger trace spanning all called services
- Log message from sales-service is queryable in Grafana/Loki within 30 seconds
- Alert fires in Alertmanager when error rate exceeds threshold (simulated)
