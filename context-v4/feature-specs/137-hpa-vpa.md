# 137 - Kubernetes HPA + VPA

> Feature-spec file number 137. Milestone v4, Phase 6, tracker **#128**.
> Depends On: spec 136 (Observability — metrics-server must be running for HPA).

## Goal

Configure Horizontal Pod Autoscaler (HPA) for all business services and Vertical
Pod Autoscaler (VPA) to right-size CPU/memory requests based on actual usage.

---

## HPA Configuration (per service)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sales-service-hpa
  namespace: premgiri-business
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sales-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60      # Wait 60s before scaling up again
      policies:
        - type: Pods
          value: 2                         # Add max 2 pods at a time
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300     # Wait 5 min before scaling down
      policies:
        - type: Pods
          value: 1                         # Remove max 1 pod at a time
          periodSeconds: 120
```

---

## HPA Settings Per Service

| Service | Min | Max | CPU Target | Memory Target |
|---|---|---|---|---|
| auth-service | 2 | 10 | 70% | 80% |
| company-service | 2 | 5 | 70% | 80% |
| masters-service | 2 | 15 | 70% | 80% |
| sales-service | 2 | 20 | 70% | 80% |
| purchase-service | 2 | 15 | 70% | 80% |
| inventory-service | 2 | 15 | 70% | 80% |
| accounting-service | 2 | 15 | 70% | 80% |
| gst-service | 2 | 10 | 70% | 80% |
| reporting-service | 2 | 10 | 70% | 80% |
| engine-service | 3 | 20 | 65% | 80% |
| frontend | 2 | 10 | 70% | 80% |

---

## VPA (Right-Sizing Requests/Limits)

VPA runs in `Recommendation` mode (not `Auto` — to avoid disruptive pod restarts):
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: sales-service-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sales-service
  updatePolicy:
    updateMode: "Recommendation"  # Only recommend; human applies changes
```

After 7 days of load, VPA recommendations are reviewed and applied to the Helm
`values.yaml` for each service.

---

## PodDisruptionBudget (High Availability)

Every service with `minReplicas: 2` gets a PDB to ensure at least 1 pod stays
running during node maintenance or rolling updates:
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: sales-service
```

---

## Testing Requirements

- Load test (k6): simulate 10× normal traffic on sales-service → HPA adds pods within 120s
- Scale-down: after load subsides → HPA removes pods within 10 minutes
- VPA recommendations appear in K8s events after 24h of real traffic
- PDB: rolling update keeps at least 1 sales-service pod running throughout
