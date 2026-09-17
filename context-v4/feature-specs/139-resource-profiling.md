# 139 - CPU/Memory Profiling + Resource Quotas

> Feature-spec file number 139. Milestone v4, Phase 6, tracker **#130**.
> Depends On: spec 136 (Observability — Prometheus metrics for profiling).

## Goal

Profile actual CPU and memory usage of every pod under real load, set accurate
resource requests/limits, and apply namespace-level resource quotas to prevent
any single service from starving the cluster.

---

## Profiling Process

After 7 days of production traffic with observability running (spec 136):

1. Query Prometheus for each service's p95 CPU and p95 memory over 7 days:
   ```promql
   # p95 CPU usage per pod
   quantile(0.95, rate(container_cpu_usage_seconds_total{pod=~"sales-service.*"}[5m]))

   # p95 memory usage per pod
   quantile(0.95, container_memory_working_set_bytes{pod=~"sales-service.*"})
   ```

2. Set resource requests at 110% of p95 observed values.
3. Set resource limits at 2× resource requests.
4. Apply recommendations to `k8s/environments/production/values.yaml`.

---

## Target Resource Profiles (Initial Estimates — Updated After Profiling)

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---|---|---|---|---|
| auth-service | 100m | 500m | 256Mi | 512Mi |
| company-service | 100m | 300m | 256Mi | 512Mi |
| masters-service | 150m | 600m | 384Mi | 768Mi |
| sales-service | 200m | 1000m | 512Mi | 1Gi |
| purchase-service | 150m | 800m | 384Mi | 768Mi |
| inventory-service | 150m | 600m | 256Mi | 512Mi |
| accounting-service | 200m | 800m | 384Mi | 768Mi |
| gst-service | 150m | 600m | 384Mi | 768Mi |
| reporting-service | 300m | 2000m | 512Mi | 2Gi |
| engine-service | 500m | 2000m | 512Mi | 2Gi |
| frontend | 200m | 800m | 512Mi | 1Gi |

---

## Namespace Resource Quotas

```yaml
# premgiri-business namespace: total across all pods
apiVersion: v1
kind: ResourceQuota
metadata:
  name: premgiri-business-quota
  namespace: premgiri-business
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "60"
    limits.memory: "80Gi"
    pods: "200"
```

---

## LimitRange (per pod defaults)

```yaml
# Prevent pods with no resource spec from consuming unbounded resources
apiVersion: v1
kind: LimitRange
metadata:
  name: premgiri-business-limits
  namespace: premgiri-business
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 256Mi
```

---

## Testing Requirements

- VPA recommendations are within 20% of manually profiled values
- A runaway pod (memory leak simulation) hits the limit and is OOMKilled, not the whole node
- ResourceQuota prevents deploying > 200 pods in premgiri-business
- CPU throttling metric (`container_cpu_throttled_seconds_total`) stays < 5% for all services
