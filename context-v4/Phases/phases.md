# Premgiri Books ERP — Milestone v4 Roadmap

This roadmap defines the 6-phase implementation plan for Milestone v4 — the transformation
from Offline-First Monolith to Cloud-Native Microservices on Kubernetes.

---

# Phase 1 — Infrastructure Foundation ⬜

Purpose: Build the container and orchestration foundation before splitting any business code.

| Tracker # | Feature | Spec | Depends On |
|---|---|---|---|
| 101 | Docker Containerization | `context-v4/feature-specs/110-docker-containerization.md` | Existing monolith |
| 102 | Kubernetes Cluster Setup | `context-v4/feature-specs/111-kubernetes-cluster-setup.md` | Docker |
| 103 | Helm Charts + ArgoCD GitOps | `context-v4/feature-specs/112-helm-argocd.md` | K8s cluster |
| 104 | CI/CD Pipeline | `context-v4/feature-specs/113-cicd-pipeline.md` | ECR/GHCR + ArgoCD |

Deliverable: The existing monolith runs as a single container in K8s. Every commit
automatically builds, pushes, and deploys. Foundation is ready for service split.

---

# Phase 2 — Backend Microservices ⬜

Purpose: Split the monolith into 9 domain microservices with a shared engine service.
Each service is extracted one at a time, starting from the platform services and
working toward business services.

| Tracker # | Feature | Spec | Depends On |
|---|---|---|---|
| 105 | API Gateway + Service Mesh | `context-v4/feature-specs/114-api-gateway.md` | Phase 1 |
| 106 | Auth Service | `context-v4/feature-specs/115-auth-service.md` | API Gateway |
| 107 | Company & Admin Service | `context-v4/feature-specs/116-company-service.md` | Auth Service |
| 108 | Masters Service | `context-v4/feature-specs/117-masters-service.md` | Company Service |
| 109 | Sales Service | `context-v4/feature-specs/118-sales-service.md` | Masters + Kafka |
| 110 | Purchase Service | `context-v4/feature-specs/119-purchase-service.md` | Masters + Kafka |
| 111 | Inventory Service | `context-v4/feature-specs/120-inventory-service.md` | Masters + Kafka |
| 112 | Accounting & Voucher Service | `context-v4/feature-specs/121-accounting-service.md` | Voucher Engine + Kafka |
| 113 | GST + Reporting Service | `context-v4/feature-specs/122-gst-reporting-service.md` | All services |

Deliverable: All 9 domain services + engine service run as independent K8s Deployments.
Each has its own HPA. Services communicate via REST, gRPC, and Kafka events.

---

# Phase 3 — Data Layer ⬜

Purpose: Build the per-tenant database system, caching, and event bus.
Can be worked in parallel with Phase 2.

| Tracker # | Feature | Spec | Depends On |
|---|---|---|---|
| 114 | Per-Tenant Database Provisioning | `context-v4/feature-specs/123-per-tenant-database.md` | Phase 1 |
| 115 | Redis Caching Layer | `context-v4/feature-specs/124-redis-cache.md` | Phase 2 services |
| 116 | Kafka Event Bus | `context-v4/feature-specs/125-kafka-event-bus.md` | Phase 2 services |
| 117 | Prisma Multi-Tenant Client Factory | `context-v4/feature-specs/126-prisma-multitenant.md` | Per-tenant DB |
| 118 | Per-Tenant Migration Automation | `context-v4/feature-specs/127-tenant-migrations.md` | Prisma factory |

Deliverable: New companies get their own PostgreSQL database in < 30 seconds.
Redis accelerates hot paths. Kafka decouples all cross-domain writes. Migrations
run per-tenant automatically on deploy.

---

# Phase 4 — Cloud Frontend + Desktop Bridge ⬜

Purpose: Deploy the web frontend to the cloud, add PWA write support, and connect
the Electron desktop app to the cloud backend.

| Tracker # | Feature | Spec | Depends On |
|---|---|---|---|
| 119 | Cloud-Hosted Next.js Frontend | `context-v4/feature-specs/128-cloud-frontend.md` | API Gateway |
| 120 | Web PWA (Mobile Read+Write) | `context-v4/feature-specs/129-web-pwa-v4.md` | Cloud frontend |
| 121 | Electron Cloud Sync Bridge | `context-v4/feature-specs/130-electron-sync-bridge.md` | Cloud backend |
| 122 | CDN + Static Asset Optimization | `context-v4/feature-specs/131-cdn-optimization.md` | Cloud frontend |

Deliverable: The ERP is fully accessible from any browser. Mobile PWA supports
create/post for core billing. The Electron desktop app can sync to cloud when online.
All static assets served from CDN in < 100ms globally.

---

# Phase 5 — Security Layers + Observability ⬜

Purpose: Harden the entire system with mTLS, secrets management, WAF, and full
observability before opening to production traffic.

| Tracker # | Feature | Spec | Depends On |
|---|---|---|---|
| 123 | mTLS Service Mesh (Istio/Linkerd) | `context-v4/feature-specs/132-mtls-service-mesh.md` | Phase 2 services |
| 124 | JWT + OIDC Auth Layer | `context-v4/feature-specs/133-jwt-oidc-auth.md` | Auth Service |
| 125 | Secrets Management (Vault) | `context-v4/feature-specs/134-secrets-management.md` | Phase 1 |
| 126 | WAF + DDoS Protection | `context-v4/feature-specs/135-waf-ddos.md` | API Gateway |
| 127 | Observability Stack | `context-v4/feature-specs/136-observability.md` | All services |

Deliverable: All inter-service traffic is encrypted with mTLS. No plain-text secret
exists anywhere in the cluster. WAF blocks OWASP Top 10. Prometheus dashboards show
per-service health. Distributed traces link requests across all 9 services.

---

# Phase 6 — Scaling + Performance ⬜

Purpose: Make the system self-tuning under real load.

| Tracker # | Feature | Spec | Depends On |
|---|---|---|---|
| 128 | Kubernetes HPA + VPA | `context-v4/feature-specs/137-hpa-vpa.md` | Phase 5 metrics |
| 129 | KEDA Event-Driven Autoscaling | `context-v4/feature-specs/138-keda-autoscaling.md` | Kafka + HPA |
| 130 | CPU/Memory Profiling + Resource Quotas | `context-v4/feature-specs/139-resource-profiling.md` | Observability |
| 131 | SLO Definitions + Alerting | `context-v4/feature-specs/140-slo-alerting.md` | Grafana + Prometheus |

Deliverable: Services scale to 0 pods when idle and back to N pods in < 60 seconds.
CPU/memory requests/limits are set correctly from profiling data. SLOs are defined
and alerting fires before users notice degradation.

---

# Milestone v4 Complete ⬜

All 31 features (tracker #101–#131) implemented, reviewed, tested, and merged.
