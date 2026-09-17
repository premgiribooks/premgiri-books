# Premgiri Books ERP — Milestone v4 Overview

## What Is Milestone v4?

Milestone v4 is the **cloud transformation milestone**. It takes the fully working
v1/v2/v3 ERP and deploys it as a cloud-native, horizontally scalable system.

**Nothing is rewritten. Everything is re-deployed.**

---

## The Transformation

```
v1/v2/v3                          v4
─────────────────────────────────────────────────────────
Single Electron process      →    9 microservices in K8s pods
Monolith code                →    Domain-bounded services
Local PostgreSQL             →    Per-company isolated databases
In-process function calls    →    REST + gRPC + Kafka events
No caching                   →    Redis (Super Admin toggle)
No event streaming           →    Kafka (async cross-domain events)
No observability             →    Prometheus + Grafana + Loki + Jaeger
Manual deployment            →    GitOps with ArgoCD
No mobile write              →    Web PWA (create + post invoices)
Desktop offline only         →    Desktop + Cloud Web + PWA
```

---

## Why This Architecture?

| Decision | Reason |
|---|---|
| Per-company databases | Strongest tenant isolation; easiest compliance; simpler backup/restore |
| Kubernetes | Horizontal scaling, self-healing, declarative config |
| Kafka | Decouples services; enables replay; scales consumers independently |
| Redis toggle | Performance boost without hard dependency — never breaks if off |
| mTLS | Zero-trust networking between services |
| ArgoCD GitOps | All deployments traceable to a Git commit; instant rollback |
| Web PWA only (no native) | Fastest time-to-market; one codebase; no app store friction |

---

## System Architecture Diagram

```
                    ┌─────────────────────┐
                    │  Cloudflare WAF/CDN  │
                    └────────┬────────────┘
                             │ HTTPS
                    ┌────────▼────────────┐
                    │   AWS ALB / NGINX   │
                    │   Load Balancer      │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────────────────────────────┐
                    │           Kubernetes Cluster                  │
                    │                                               │
                    │  ┌─────────────────────────────────────┐    │
                    │  │         API Gateway (Kong)            │    │
                    │  │  JWT validation · Rate limiting       │    │
                    │  │  Routing · TLS termination            │    │
                    │  └──┬──────┬──────┬──────┬──────┬───────┘    │
                    │     │      │      │      │      │            │
                    │  [Auth] [Company] [Masters] [Sales] [...]    │
                    │                                               │
                    │  ┌────────────────────────────────────────┐  │
                    │  │  Engine Service (gRPC, internal only)   │  │
                    │  │  Voucher · Pricing · Inventory · GST    │  │
                    │  └────────────────────────────────────────┘  │
                    │                                               │
                    │  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
                    │  │  Kafka   │  │  Redis    │  │  Vault   │  │
                    │  │ Cluster  │  │  Cluster  │  │ Secrets  │  │
                    │  └──────────┘  └───────────┘  └──────────┘  │
                    │                                               │
                    │  ┌──────────────────────┐  ┌─────────────┐  │
                    │  │ Platform DB (Postgres) │  │ Company DBs │  │
                    │  │ companies · users     │  │ (per-tenant)│  │
                    │  └──────────────────────┘  └─────────────┘  │
                    └─────────────────────────────────────────────┘
                             ▲                    ▲
                    ┌────────┴──────┐    ┌────────┴──────┐
                    │ Cloud Web     │    │ Electron      │
                    │ (Browser/PWA) │    │ Sync Bridge   │
                    └───────────────┘    └───────────────┘
```

---

## 31 Features Across 6 Phases

| Phase | Features | Goal |
|---|---|---|
| 1 — Infrastructure | 4 | Docker + K8s + Helm + CI/CD |
| 2 — Microservices | 9 | Split monolith into 9 domain services |
| 3 — Data Layer | 5 | Per-tenant DB + Redis + Kafka + migrations |
| 4 — Frontend | 4 | Cloud web + PWA + Desktop sync + CDN |
| 5 — Security | 5 | mTLS + JWT + Vault + WAF + Observability |
| 6 — Scaling | 4 | HPA + VPA + KEDA + SLOs |

---

## Key Files

| File | Purpose |
|---|---|
| `context-v4/project-overview.md` | Goals, modes, feature list |
| `context-v4/architecture-context.md` | Tech stack, microservice map, Kafka events, invariants |
| `context-v4/code-standards.md` | Microservice, Kafka, Redis, K8s, secret standards |
| `context-v4/Phases/phases.md` | Full 6-phase roadmap |
| `context-v4/Phases/phase-tracker.md` | Live status (all ⬜ now) |
| `context-v4/progress-tracker.md` | Session log |
| `context-v4/feature-specs/110-*.md` to `140-*.md` | 31 feature specs |
