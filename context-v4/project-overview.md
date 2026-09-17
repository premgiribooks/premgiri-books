# Premgiri Books ERP — Milestone v4

## Overview

Milestone v4 transforms Premgiri Books ERP from an **Offline-First Modular Monolith**
into a **Cloud-Native, Kubernetes-Orchestrated, Multi-Tier SaaS + Desktop Hybrid**.

v4 is not a rewrite. It is a structured **lift-and-split**: the existing domain logic,
engines, and database schemas are preserved. The deployment model, communication
patterns, and infrastructure are replaced.

After v4:
- The Electron desktop app continues to work fully offline (unchanged).
- A cloud web application serves companies over HTTPS from any browser.
- A Web PWA provides a mobile-optimized read-and-write experience.
- The backend runs as 9 domain microservices on Kubernetes.
- Each company has its own isolated PostgreSQL database.
- Redis accelerates hot-path queries (Super Admin toggle).
- Kafka decouples cross-domain events (invoice posted → inventory moved → voucher created).
- The entire system scales horizontally via Kubernetes HPA.

---

## Goals (Milestone v4)

1. Deploy the full ERP to any Kubernetes cluster (AWS EKS, GCP GKE, DigitalOcean DOKS,
   self-hosted on EC2/VPS).
2. Support horizontal scaling — add pods as load increases, remove them when idle.
3. Give every company its own isolated PostgreSQL database.
4. Decompose the monolith into 9 domain microservices with clean API contracts.
5. Enable Redis as an optional caching layer (Super Admin enabled/disabled toggle).
6. Implement Kafka as the cross-service event bus.
7. Provide end-to-end security: mTLS between services, JWT auth, WAF, secrets vault.
8. Deliver observability: metrics (Prometheus), dashboards (Grafana), logs (Loki),
   traces (Jaeger).
9. Serve the web frontend from a cloud CDN for < 100ms TTFB globally.
10. Retain full offline capability for the Electron desktop app.

---

## Deployment Modes (v4)

v4 introduces three deployment modes that can coexist:

| Mode | Where | Who |
|---|---|---|
| **Desktop (Offline)** | Electron on Windows/macOS/Linux | Local businesses with no internet requirement |
| **Cloud Web** | Browser → CDN → K8s API Gateway | Cloud subscribers; web-only companies |
| **Hybrid** | Electron + cloud sync bridge | Businesses that want offline + cloud backup/access |

---

## Core User Flow Changes (v4)

For **cloud web users**: sign in → JWT issued → company context set → API Gateway
routes to correct microservice → Kafka events flow between services → data lives in
per-company database.

For **desktop users**: unchanged from v3. When hybrid mode is enabled, the Electron
sync bridge (spec 130) pushes local changes to the cloud on reconnect.

---

## Platform Architecture (v4 High Level)

```
Internet
    ↓
[WAF / DDoS Protection]
    ↓
[Load Balancer (AWS ALB / NGINX)]
    ↓
[API Gateway (Kong / NGINX Ingress)]
    ↓ JWT validation, rate limiting, routing
    ↓
┌─────────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                          │
│                                                             │
│  [Auth Service]   [Company Service]   [Masters Service]     │
│  [Sales Service]  [Purchase Service]  [Inventory Service]   │
│  [Accounting Service]  [GST Service]  [Reporting Service]   │
│                                                             │
│  [Engine Service — gRPC — internal only]                    │
│                                                             │
│  [Kafka Cluster]   [Redis Cluster]                          │
│                                                             │
│  [Platform DB]   [Company DB Pool]   [File Storage (S3)]    │
└─────────────────────────────────────────────────────────────┘
    ↑                           ↑
Electron Sync Bridge        Web Frontend (CDN)
(Desktop Hybrid mode)       (Next.js / Vercel / CloudFront)
```

---

## Features Added in v4

### Phase 1 — Infrastructure Foundation
- Docker containerization of all services
- Kubernetes cluster setup (Helm-based)
- GitOps with ArgoCD
- CI/CD: GitHub Actions → ECR/GHCR → ArgoCD deploy

### Phase 2 — Backend Microservices
- API Gateway
- Auth Service
- Company & Admin Service
- Masters Service
- Sales Service
- Purchase Service
- Inventory Service
- Accounting & Voucher Service
- GST + Reporting Service

### Phase 3 — Data Layer
- Per-tenant database provisioning
- Redis caching layer (Super Admin toggle)
- Kafka event bus
- Prisma multi-tenant client factory
- Automated per-tenant migrations

### Phase 4 — Cloud Frontend + Desktop Bridge
- Cloud-hosted Next.js frontend
- Web PWA (mobile read-write)
- Electron cloud sync bridge
- CDN + static asset optimization

### Phase 5 — Security + Observability
- mTLS service mesh (Istio / Linkerd)
- JWT + OIDC auth (Keycloak or Auth0)
- Secrets management (HashiCorp Vault)
- WAF + DDoS (Cloudflare / AWS WAF)
- Prometheus + Grafana + Loki + Jaeger

### Phase 6 — Scaling + Performance
- Kubernetes HPA (CPU/memory triggered)
- VPA (right-sizing)
- KEDA (event-driven autoscaling on Kafka lag)
- CPU profiling + resource quotas
- SLO definitions + alerting

---

## Out Of Scope (v4)

- Native iOS / Android apps (Web PWA only)
- Multi-region active-active (single-region HA only)
- Database sharding within a company database
- Full manufacturing / BOM module
- GST portal auto-filing beyond E-Invoice (v3 scope)
