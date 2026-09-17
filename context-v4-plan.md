# Premgiri Books ERP — Milestone v4 Cloud Architecture Plan

## Goal

Transform Premgiri Books ERP from an Offline-First Modular Monolith into a
**Cloud-Native, Kubernetes-Orchestrated, Microservices Architecture** that supports:

- Horizontal scaling on Kubernetes (EKS / self-hosted K8s on EC2/VPS)
- Per-company isolated PostgreSQL databases (strongest tenant isolation)
- Backend decomposed into domain microservices
- Redis (Super Admin toggle — enable/disable per deployment)
- Kafka event streaming
- Cloud-hosted web frontend (Next.js on Vercel / containers)
- Electron desktop app retained for offline use with a sync bridge
- Web PWA for mobile (no native apps in v4)
- End-to-end security layers (mTLS, JWT, API Gateway, WAF, secrets management)
- Observability stack (Prometheus + Grafana + Loki + Jaeger)
- Auto-scaling based on actual CPU/memory usage per pod

---

## Architecture Decisions

### AD-1 — Electron stays; cloud is additive

The Electron desktop app (v1/v2/v3) continues to exist and work offline. v4 adds a
cloud deployment mode. Desktop users can optionally connect to the cloud backend;
cloud/web users get a full browser experience. No existing feature is removed.

### AD-2 — Per-company database isolation

Each company gets its own PostgreSQL database (`premgiri_company_<uuid>`). A central
`premgiri_platform` database stores: Companies, Users, CompanyUser mappings, Roles,
Permissions, Subscriptions. This gives the strongest data isolation, easiest compliance
(GDPR, data residency), and simpler per-company backup/restore.

### AD-3 — Microservices domain boundary map

The existing modules in `src/modules/` are grouped into bounded domains. Each domain
becomes one microservice with its own Deployment, Service, and HPA in Kubernetes.
The engine layer (Voucher, Pricing, Inventory, GST, Reporting) is extracted into a
shared `engine-service` called only via internal gRPC.

### AD-4 — Redis is infrastructure, not a feature

Redis is deployed as a StatefulSet in K8s. Super Admin can enable/disable it per
deployment from the `/administration/infrastructure` panel. When disabled, all cache
calls fall back to direct DB queries — the application must work correctly either way.

### AD-5 — Kafka is the event bus

Kafka (via Confluent on cloud, or self-hosted KRaft mode) replaces direct service-to-
service calls for cross-domain events (e.g., SalesInvoicePosted → InventoryService
reduces stock, VoucherEngine creates entries). This decouples services and enables
horizontal scaling of consumers.

### AD-6 — API Gateway is the single entry point

All external traffic enters through a single NGINX Ingress / Kong API Gateway. The
gateway handles: JWT validation, rate limiting, request routing to services, TLS
termination, WAF rules, and observability headers.

---

## 6-Phase Plan

### Phase 1 — Infrastructure Foundation (specs 110–113)
Docker containerization, Kubernetes cluster config, Helm charts, CI/CD pipeline.

### Phase 2 — Backend Microservices (specs 114–122)
Split the monolith into 9 domain microservices, each with its own K8s Deployment.

### Phase 3 — Data Layer (specs 123–127)
Per-tenant DB provisioning, Redis caching layer, Kafka event bus, Prisma multi-tenant
client factory, database migration automation.

### Phase 4 — Cloud Frontend + Desktop Bridge (specs 128–131)
Cloud-hosted Next.js frontend, Web PWA shell, Electron sync bridge to cloud backend,
static asset CDN.

### Phase 5 — Security Layers + Observability (specs 132–136)
mTLS between services, JWT / OIDC auth, Secrets management (Vault / K8s Secrets),
WAF + DDoS protection, Prometheus + Grafana + Loki + Jaeger observability stack.

### Phase 6 — Scaling + Performance (specs 137–140)
Kubernetes HPA based on CPU/memory, VPA for right-sizing, KEDA for event-driven
scaling, performance benchmarking and SLO definition.

---

## Sub-Tasks

### Task 1 — Top-level context files

**Intent**: Create the 6 core context files for v4 in `context-v4/`.

**Status**: [ ] pending

---

### Task 2 — Phases directory

**Intent**: Create `phases.md`, `phase-tracker.md`, `milestone-v4-overview.md`.

**Status**: [ ] pending

---

### Task 3 — Phase 1 specs (Infrastructure Foundation)

Spec 110: Docker containerization
Spec 111: Kubernetes cluster setup (EKS / self-hosted)
Spec 112: Helm charts + GitOps (ArgoCD)
Spec 113: CI/CD pipeline (GitHub Actions → ECR → ArgoCD)

**Status**: [ ] pending

---

### Task 4 — Phase 2 specs (Microservices)

Spec 114: API Gateway + Service Mesh
Spec 115: Auth Service (JWT, sessions, OIDC)
Spec 116: Company & Admin Service
Spec 117: Masters Service (customers, suppliers, products, masters)
Spec 118: Sales Service
Spec 119: Purchase Service
Spec 120: Inventory Service
Spec 121: Accounting & Voucher Service
Spec 122: GST Service + Reporting Service

**Status**: [ ] pending

---

### Task 5 — Phase 3 specs (Data Layer)

Spec 123: Per-tenant database provisioning
Spec 124: Redis caching layer (Super Admin toggle)
Spec 125: Kafka event bus + topics
Spec 126: Prisma multi-tenant client factory
Spec 127: Database migration automation (per-tenant)

**Status**: [ ] pending

---

### Task 6 — Phase 4 specs (Frontend + Desktop Bridge)

Spec 128: Cloud-hosted Next.js frontend
Spec 129: Web PWA shell (mobile)
Spec 130: Electron cloud sync bridge
Spec 131: CDN + static asset optimization

**Status**: [ ] pending

---

### Task 7 — Phase 5 specs (Security + Observability)

Spec 132: mTLS between microservices
Spec 133: JWT + OIDC auth layer
Spec 134: Secrets management (Vault / K8s Secrets)
Spec 135: WAF + DDoS protection
Spec 136: Observability (Prometheus + Grafana + Loki + Jaeger)

**Status**: [ ] pending

---

### Task 8 — Phase 6 specs (Scaling + Performance)

Spec 137: Kubernetes HPA + VPA
Spec 138: KEDA event-driven autoscaling
Spec 139: CPU/memory profiling + resource quotas
Spec 140: Performance benchmarks + SLO definitions

**Status**: [ ] pending
