# 140 - SLO Definitions + Alerting

> Feature-spec file number 140. Milestone v4, Phase 6, tracker **#131**.
> Depends On: spec 136 (Observability — Prometheus + Grafana + Alertmanager).

## Goal

Define Service Level Objectives (SLOs) for every user-facing operation, implement
error-budget burn rate alerts, and configure Alertmanager to route alerts to the
correct on-call channel.

---

## SLO Definitions

### Availability SLOs

| Service | SLO | Measurement Window |
|---|---|---|
| API Gateway | 99.9% (43 min downtime/month) | Rolling 30 days |
| Auth (Login) | 99.9% | Rolling 30 days |
| Sales Invoice POST | 99.5% | Rolling 30 days |
| Report generation | 99.0% | Rolling 30 days |

Availability = (total_requests - error_requests) / total_requests × 100

---

### Latency SLOs

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| Login | < 100ms | < 300ms | < 500ms |
| Product search | < 50ms | < 150ms | < 300ms |
| Sales Invoice POST | < 300ms | < 800ms | < 1.5s |
| Report: Trial Balance | < 500ms | < 1.5s | < 3s |
| Dashboard load | < 300ms | < 800ms | < 2s |

---

## Error Budget

For a 99.9% availability SLO over 30 days:
- Error budget = 0.1% × 43,200 minutes = 43.2 minutes per month
- If 50% of the error budget is consumed in 6 hours → "fast burn" alert fires
- If 10% of the error budget is consumed in 1 hour → "slow burn" alert fires

```yaml
# Prometheus rule: fast burn rate (page immediately)
- alert: SLOFastBurn_SalesInvoice
  expr: |
    (
      sum(rate(http_requests_total{service="sales-service",status=~"5..",path=~"/api/v1/sales/invoices"}[1h]))
      /
      sum(rate(http_requests_total{service="sales-service",path=~"/api/v1/sales/invoices"}[1h]))
    ) > 0.14  # 14× burn rate = 50% budget in 6h
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Sales Invoice SLO fast burn — error budget 50% consumed in < 6h"
```

---

## Alertmanager Routing

```yaml
routes:
  - receiver: pagerduty-critical
    match:
      severity: critical

  - receiver: slack-warning
    match:
      severity: warning

  - receiver: email-daily
    group_wait: 12h
    match:
      severity: info
```

---

## SLO Dashboard (Grafana)

A dedicated "SLO Overview" dashboard showing:
- Current availability % vs SLO target
- Error budget remaining (days of budget left this month)
- Latency percentiles vs SLO targets
- Top 5 error-contributing endpoints
- Historical SLO compliance (last 12 months)

---

## Incident Runbooks

Each critical alert links to a runbook in `docs/runbooks/`:
- `sales-invoice-failure.md` — steps to diagnose and recover
- `kafka-consumer-lag.md` — steps to recover from lag
- `database-connection-exhaustion.md` — PgBouncer + PostgreSQL recovery
- `pod-crashloop.md` — container restart debugging steps

---

## Testing Requirements

- SLO Prometheus metrics computed correctly: inject 0.5% errors → availability metric shows 99.5%
- Fast-burn alert fires within 5 minutes of sustained 14× error rate
- Alertmanager routes critical alert to PagerDuty and warning to Slack
- SLO dashboard shows correct % availability vs target
