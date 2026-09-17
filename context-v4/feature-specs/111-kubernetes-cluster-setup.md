# 111 - Kubernetes Cluster Setup

> Feature-spec file number 111. Milestone v4, Phase 1, tracker **#102**.
> Depends On: spec 110 (Docker Containerization).

## Goal

Set up a production-ready Kubernetes cluster with the required namespaces, RBAC,
networking, storage, and ingress — ready to receive Helm-deployed services.

---

## Cluster Options (choose one based on Open Question #1)

| Option | When | Tool |
|---|---|---|
| **Local dev** | Development + CI | `kind` or `k3d` |
| **Self-hosted VPS** | Budget production | K3s on EC2/VPS |
| **Managed cloud** | Production | AWS EKS / DO DOKS |

All Helm charts and manifests are written once to work on any of these. The only
difference is the cloud-provider-specific StorageClass and LoadBalancer annotations.

---

## Namespaces

```yaml
namespaces:
  - premgiri-platform    # auth, company, admin
  - premgiri-business    # masters, sales, purchase, inventory, accounting, gst
  - premgiri-data        # postgres, redis, kafka
  - premgiri-frontend    # next.js web
  - premgiri-infra       # ingress, cert-manager, vault, argocd, monitoring
```

---

## Core Cluster Components to Install

| Component | Purpose | Install Method |
|---|---|---|
| NGINX Ingress Controller | Route external HTTP/S | `helm install ingress-nginx` |
| cert-manager | Automatic TLS certs (Let's Encrypt) | `helm install cert-manager` |
| metrics-server | CPU/memory metrics for HPA | `helm install metrics-server` |
| PgBouncer | PostgreSQL connection pooler | `helm install pgbouncer` |
| Sealed Secrets | Encrypt secrets in Git | `helm install sealed-secrets` |

---

## RBAC Policies

Each namespace gets a ServiceAccount. Services in `premgiri-business` can:
- Read their own ConfigMaps and Secrets
- Cannot access other namespaces

`premgiri-infra` ServiceAccount can:
- Read/write Secrets in all namespaces (for Vault injection)

No service gets `cluster-admin`. Least-privilege principle throughout.

---

## Network Policies

```yaml
# Default deny all ingress/egress in premgiri-business
# Allow: premgiri-business → premgiri-data (DB, Redis, Kafka)
# Allow: premgiri-platform → premgiri-data
# Allow: premgiri-infra → all (for monitoring scraping)
# Deny: premgiri-business → internet (except via API Gateway)
```

---

## Storage Classes

| Workload | StorageClass | Notes |
|---|---|---|
| PostgreSQL | `gp3` (AWS) / `local-path` (K3s) | ReadWriteOnce, 50Gi min |
| Redis | `gp3` / `local-path` | ReadWriteOnce, 10Gi |
| Kafka | `gp3` / `local-path` | ReadWriteOnce, 50Gi per broker |
| Vault | `gp3` / `local-path` | ReadWriteOnce, 5Gi |

---

## Cluster Validation Checklist

- All namespaces exist
- NGINX Ingress has an external IP / hostname
- cert-manager issues a Let's Encrypt certificate for the base domain
- metrics-server returns CPU/memory for all pods
- NetworkPolicy denies cross-namespace traffic (tested with a `curl` from an isolated pod)
- A test deployment scales up and down via HPA

---

## Testing Requirements

- `kubectl get nodes` shows all nodes `Ready`
- `kubectl get pods -A` shows all core components `Running`
- `helm test <release>` passes for each installed chart
- A simple echo server Deployment + Ingress serves HTTPS with a valid cert
