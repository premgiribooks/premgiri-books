# 112 - Helm Charts + ArgoCD GitOps

> Feature-spec file number 112. Milestone v4, Phase 1, tracker **#103**.
> Depends On: spec 111 (Kubernetes Cluster Setup).

## Goal

Create Helm charts for every service and configure ArgoCD to deploy them
declaratively from Git. Every production deployment traces to a Git commit.
No manual `kubectl apply` in production ever.

---

## Helm Chart Structure

```
k8s/
├── charts/
│   ├── premgiri-service/       # Shared base chart (all business services reuse this)
│   │   ├── Chart.yaml
│   │   ├── values.yaml         # Defaults
│   │   └── templates/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── hpa.yaml
│   │       ├── configmap.yaml
│   │       ├── networkpolicy.yaml
│   │       └── poddisruptionbudget.yaml
│   │
│   ├── premgiri-postgres/      # PostgreSQL StatefulSet
│   ├── premgiri-redis/         # Redis Cluster StatefulSet
│   ├── premgiri-kafka/         # Kafka KRaft StatefulSet
│   └── premgiri-frontend/      # Next.js Deployment + Ingress
│
├── environments/
│   ├── development/
│   │   └── values.yaml         # 1 replica, small resources
│   ├── staging/
│   │   └── values.yaml         # 2 replicas, medium resources
│   └── production/
│       └── values.yaml         # 3+ replicas, full resources, HPA enabled
│
└── argocd/
    ├── apps/                   # ArgoCD Application manifests (one per service)
    └── projects/               # ArgoCD Projects (premgiri-platform, premgiri-business)
```

---

## Base Chart `values.yaml` (premgiri-service)

```yaml
replicaCount: 2
image:
  repository: ghcr.io/premgiri/service
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3000

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5

podDisruptionBudget:
  minAvailable: 1
```

---

## ArgoCD Setup

ArgoCD is installed in `premgiri-infra` namespace. It watches the `k8s/argocd/apps/`
directory in the main Git repo.

Each service has an ArgoCD Application:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: premgiri-auth-service
  namespace: premgiri-infra
spec:
  project: premgiri-platform
  source:
    repoURL: https://github.com/premgiri/premgiri-books
    targetRevision: HEAD
    path: k8s/charts/premgiri-service
    helm:
      valueFiles:
        - ../../environments/production/values.yaml
        - values-auth-service.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: premgiri-platform
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

---

## GitOps Flow

```
Developer pushes to main
    → GitHub Actions builds Docker image
    → Tags image with git SHA
    → Updates image tag in k8s/environments/production/values.yaml
    → Commits the values.yaml change
    → ArgoCD detects the change
    → ArgoCD applies the Helm chart with new image tag
    → New pods roll out (RollingUpdate strategy)
    → Old pods terminate after new pods pass readiness probe
```

---

## Testing Requirements

- `helm lint k8s/charts/premgiri-service` passes with no errors
- `helm template` renders valid YAML for all environments
- ArgoCD Application shows `Synced` and `Healthy` for a test deployment
- A manual image tag change in `values.yaml` triggers ArgoCD to redeploy within 3 minutes
- Rollback: reverting the `values.yaml` commit triggers ArgoCD to roll back to previous version
