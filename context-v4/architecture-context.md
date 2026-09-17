# Architecture Context — Milestone v4

## Base

Read `context/architecture-context.md` (v1/v2 base) and `context-v3/architecture-context.md`
(v3 amendments) before this file. This document records only v4 architectural decisions.

---

## Architecture Style Change: Modular Monolith → Cloud-Native Microservices

v4 introduces a fundamental deployment architecture change. The **business logic and
domain models are unchanged** — only how they are deployed, communicated, and scaled
changes.

| Dimension | v1/v2/v3 | v4 |
|---|---|---|
| Deployment | Electron desktop (single process) | Kubernetes pods (multi-service) |
| Communication | In-process function calls | HTTP/gRPC + Kafka events |
| Database | Single PostgreSQL (local) | Per-company PostgreSQL + Platform DB |
| Scaling | Vertical (bigger machine) | Horizontal (more pods) |
| Auth | Local session/cookie | JWT + OIDC (Keycloak) |
| Caching | None | Redis (optional, Super Admin toggle) |
| Eventing | None | Kafka event bus |
| Observability | Pino logs (local) | Prometheus + Grafana + Loki + Jaeger |

---

## Technology Stack (v4 Full)

| Layer | Technology | Purpose |
|---|---|---|
| Container Runtime | Docker | Package each service |
| Orchestration | Kubernetes (EKS / K3s / self-hosted) | Deploy, scale, heal pods |
| Package Manager | Helm | K8s manifest templates |
| GitOps | ArgoCD | Declarative deployment from Git |
| API Gateway | Kong / NGINX Ingress | Single entry point, JWT, routing |
| Service Mesh | Istio or Linkerd | mTLS, traffic management |
| Auth | Keycloak (OIDC + JWT) | Authentication + Authorization |
| Secrets | HashiCorp Vault | Encrypted secrets injection |
| Message Bus | Apache Kafka (KRaft mode) | Cross-service event streaming |
| Cache | Redis Cluster | Session + query caching (toggleable) |
| Primary DB | PostgreSQL 15+ | Per-company isolated databases |
| Platform DB | PostgreSQL 15+ | Companies, Users, Subscriptions |
| ORM | Prisma (per-service client) | DB access layer per microservice |
| File Storage | AWS S3 / MinIO (self-hosted) | PDFs, images, exports |
| CDN | CloudFront / Cloudflare | Frontend assets, static files |
| Frontend (cloud) | Next.js (containerized) | Web ERP interface |
| Frontend (desktop) | Electron (unchanged) | Offline desktop |
| Mobile | Web PWA (Next.js) | Mobile read-write |
| Observability | Prometheus + Grafana + Loki + Jaeger | Metrics, dashboards, logs, traces |
| WAF / DDoS | Cloudflare WAF / AWS WAF + Shield | Layer-7 protection |
| CI/CD | GitHub Actions + ECR/GHCR + ArgoCD | Build, push, deploy |
| Load Balancer | AWS ALB / NGINX | Distribute traffic to pods |

---

## Microservice Domain Map

Each domain becomes one Kubernetes Deployment with its own Service and HPA:

| Service | Owns | Listens On |
|---|---|---|
| `auth-service` | Users, Sessions, Roles, Permissions, CompanyUser | REST + gRPC |
| `company-service` | Companies, Branches, FinancialYears, CompanySettings | REST + gRPC |
| `masters-service` | Customers, Suppliers, Products, Categories, Brands, Units, Warehouses, HSN, GST Rates, MarginProfiles, PriceLists, Employees | REST |
| `sales-service` | Quotations, SalesOrders, DeliveryChallans, SalesInvoices, SalesReturns, CreditNotes, DebitNotes | REST + Kafka producer |
| `purchase-service` | PurchaseOrders, GoodsReceiptNotes, PurchaseInvoices, PurchaseReturns | REST + Kafka producer |
| `inventory-service` | StockTransactions, StockAdjustments, StockTransfers, PhysicalVerifications, Opening Stock, Batches, Serials | REST + Kafka consumer/producer |
| `accounting-service` | Vouchers, VoucherEntries, Ledgers, LedgerGroups, BankAccounts, ManualVouchers, LiabilitySettlement | REST + Kafka consumer |
| `gst-service` | GstRegisters, GSTR1, GSTR2, GSTR3B, HsnSummary, ITCRegister, GstFilingRecords, E-Invoice, E-Way Bill | REST |
| `reporting-service` | TrialBalance, P&L, BalanceSheet, CashFlow, Sales/Purchase/Inventory/Customer/Supplier/Employee Reports | REST (read-only) |
| `engine-service` | VoucherEngine, PricingEngine, InventoryEngine, GSTEngine, CostingEngine, AIInsightsEngine | gRPC (internal only, never public) |

---

## Service Communication Patterns

### Synchronous (REST or gRPC)
Used for: request-response operations where the caller needs an immediate result.
- Frontend → API Gateway → Service: REST/JSON
- Service → Engine Service: gRPC (internal cluster network only)
- Service → Service (cross-domain lookup): gRPC via service mesh

### Asynchronous (Kafka Events)
Used for: side effects triggered by a primary operation in another domain.

| Event | Producer | Consumer(s) |
|---|---|---|
| `sales.invoice.posted` | sales-service | inventory-service, accounting-service |
| `purchase.invoice.posted` | purchase-service | inventory-service, accounting-service |
| `inventory.stock.adjusted` | inventory-service | reporting-service |
| `accounting.voucher.posted` | accounting-service | reporting-service |
| `sales.return.posted` | sales-service | inventory-service, accounting-service |
| `purchase.return.posted` | purchase-service | inventory-service, accounting-service |
| `payroll.run.posted` | accounting-service | reporting-service |

**Rule**: A service owns its data. It never calls another service's repository directly.
Cross-domain reads happen through gRPC; cross-domain writes happen through Kafka events.

---

## Per-Tenant Database Architecture

```
Platform DB (premgiri_platform):
  - companies
  - users
  - company_users
  - roles
  - permissions
  - subscriptions
  - audit_logs (platform-level only)

Company DB (premgiri_company_<uuid>):
  - Everything in the current Prisma schema except companies/users/roles
  - Created atomically when a new company is provisioned
  - Migrated independently per company
  - Backed up independently per company
```

The `TenantClientFactory` (`src/lib/tenant-client-factory.ts`) resolves the correct
Prisma client for a company on each request. Connection pooling via PgBouncer prevents
N×M connection explosion (N companies × M pods).

---

## Redis Architecture (Super Admin Toggle)

Redis is deployed as a Redis Cluster (3 primary + 3 replica nodes in K8s StatefulSet).

Super Admin can enable or disable Redis from `/administration/infrastructure`:
- **Enabled**: all cache reads/writes go through Redis first
- **Disabled**: all cache reads/writes fall through to PostgreSQL directly

Cache key namespacing: `premgiri:{companyId}:{domain}:{key}`

Cache TTLs:
| Key type | TTL |
|---|---|
| User session | 24 hours |
| Company settings | 1 hour |
| Product catalog | 15 minutes |
| Stock balance | 60 seconds |
| GST rates | 6 hours |
| Reports | 5 minutes |

**Invariant**: The application must produce correct results with Redis disabled.
Redis is a performance optimization, never a source of truth.

---

## Kafka Architecture

Kafka runs in KRaft mode (no ZooKeeper) as a StatefulSet in K8s.

Topic naming: `premgiri.{domain}.{event}` (e.g., `premgiri.sales.invoice.posted`)

Partition strategy: Partition by `companyId` so all events for a company are
processed in order by the same consumer.

Consumer groups: one consumer group per consuming service
(e.g., `inventory-service`, `accounting-service`).

Dead Letter Queue: `premgiri.{topic}.dlq` — failed messages land here for manual
inspection and replay.

---

## Kubernetes Resource Structure

```
k8s/
├── namespaces/
│   ├── premgiri-platform/    (auth, company, admin services)
│   ├── premgiri-business/    (masters, sales, purchase, inventory, accounting, gst)
│   ├── premgiri-data/        (postgres, redis, kafka)
│   ├── premgiri-frontend/    (next.js web frontend)
│   └── premgiri-infra/       (ingress, cert-manager, vault, argocd)
├── services/
│   ├── auth-service/         (Deployment, Service, HPA, ConfigMap, NetworkPolicy)
│   ├── company-service/
│   ├── masters-service/
│   ├── sales-service/
│   ├── purchase-service/
│   ├── inventory-service/
│   ├── accounting-service/
│   ├── gst-service/
│   ├── reporting-service/
│   └── engine-service/
├── data/
│   ├── postgres/             (StatefulSet, PVC, PgBouncer)
│   ├── redis/                (StatefulSet, Redis Cluster)
│   └── kafka/                (StatefulSet, KRaft mode)
└── infra/
    ├── ingress/              (NGINX Ingress / Kong)
    ├── cert-manager/         (TLS certificates via Let's Encrypt)
    ├── vault/                (HashiCorp Vault)
    └── monitoring/           (Prometheus, Grafana, Loki, Jaeger)
```

---

## Invariants (v4 — Additional)

19. Every microservice owns exactly one domain — no service reads another service's
    database tables directly.
20. All cross-domain writes go through Kafka events — never direct cross-service DB calls.
21. Redis must never be the source of truth for any financial data.
22. Every pod must pass a readiness probe before receiving traffic.
23. Every pod must pass a liveness probe — failed pods are restarted automatically.
24. No secret (DB password, API key, JWT signing key) is stored in a K8s ConfigMap or
    environment variable in plain text — all secrets are injected from Vault.
25. Electron desktop app must never be broken by a cloud architecture change.
26. A new company database must be provisioned, migrated, and seeded in < 30 seconds.
27. Kafka consumer failures must never lose messages — DLQ + manual replay required.
28. The system must scale to 0 pods for idle services (with KEDA) and back to N pods
    in < 60 seconds.
