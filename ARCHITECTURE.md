# Premgiri Books ERP — Final Architecture Design

> This document is the canonical architecture reference for the entire Premgiri Books ERP
> platform across three evolutionary milestones: **v2 (Offline Monolith)**, **v3 (Hardened
> Monolith + Bridge)**, and **v4 (Cloud-Native Microservices)**. It covers every layer,
> every service, every engine, every data model, and every integration point.
>
> Read the milestone-specific context files alongside this document:
> - v2 base: `context/architecture-context.md`
> - v3 amendments: `context-v3/architecture-context.md`
> - v4 transformation: `context-v4/architecture-context.md`

---

## Table of Contents

1. [Architecture Evolution Overview](#1-architecture-evolution-overview)
2. [v2 — Offline-First Modular Monolith](#2-v2--offline-first-modular-monolith)
3. [v3 — Hardened Monolith + v4 Bridge](#3-v3--hardened-monolith--v4-bridge)
4. [v4 — Cloud-Native Microservices](#4-v4--cloud-native-microservices)
5. [Core Business Engines](#5-core-business-engines)
6. [Domain Module Architecture](#6-domain-module-architecture)
7. [Data Architecture](#7-data-architecture)
8. [Security Architecture](#8-security-architecture)
9. [Observability Architecture](#9-observability-architecture)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Cross-Cutting Invariants](#11-cross-cutting-invariants)

---

## 1. Architecture Evolution Overview

Premgiri Books ERP evolves in three distinct milestones. The **business logic is preserved
across all three** — only deployment model, communication, and infrastructure change.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ARCHITECTURE EVOLUTION                                  │
│                                                                             │
│  v2 — Monolith        v3 — Hardened              v4 — Microservices        │
│  ──────────────        ────────────────           ──────────────────────    │
│  Single process        Same process +             9 independent pods        │
│  Local Postgres        bridge patterns            Per-tenant Postgres       │
│  Cookie/session        Cookie/session             JWT + OIDC (Keycloak)     │
│  Electron only         Electron only              Electron + Web + PWA      │
│  No events             DomainEventBus             Apache Kafka              │
│  No cache              CacheService stub          Redis Cluster             │
│  No health checks      /health/*  routes          K8s probes                │
│  Puppeteer PDF         @react-pdf                 @react-pdf (unchanged)    │
│  Single DB             Single DB                  Per-company DB            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Principle**: v3 is the "bridge" — code written in v3 must compile and run
identically in v3's single-process environment AND be extractable into v4's
microservice pods without internal rewrites. This is enforced by the
Context-as-Parameter rule, the injected PrismaClient rule, and the DomainEventBus
interface rule (see `context-v3/architecture-context.md` Bridge Decisions A–E).

---

## 2. v2 — Offline-First Modular Monolith

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON DESKTOP SHELL                        │
│  Chromium Window ──► Next.js App Router (localhost:3000)        │
│  IPC: pdf:generate, print:thermal (future)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴──────────────┐
                │                            │
                ▼                            ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│  PRESENTATION LAYER      │   │  API LAYER                   │
│  Next.js App Router      │   │  Server Actions (RSC)        │
│  React Server Components │   │  Route Handlers (/api/*)     │
│  shadcn/ui + Tailwind    │   │  src/proxy.ts (middleware)   │
└─────────────────────────┘   └─────────────────────────────┘
                │                            │
                └─────────────┬──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                  │
│                                                                  │
│  Auth           Company      Masters        Sales               │
│  UserService    CompanyService  ProductService  SalesInvoiceService │
│  RoleService    SettingsService CustomerService  QuotationService  │
│                                                                  │
│  Purchase       Inventory    Accounting      GST                │
│  PurchaseInv.   StockAdj.    VoucherService  GstrService        │
│                 StockTransfer LedgerService  ItcService         │
│                                                                  │
│  HR / Payroll   Reports      Dashboard       Admin              │
│  EmployeeService ReportService DashboardService AuditLogService │
│  PayrollService                               BackupService     │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ENGINE LAYER (Pure Functions)                  │
│                                                                  │
│  VoucherEngine    PricingEngine    InventoryEngine               │
│  GSTEngine        ReportingEngine  DocumentNumberEngine          │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                     │
│                                                                  │
│  Prisma ORM (PrismaPg adapter)                                  │
│  PostgreSQL 15 (local)   Local File Storage                     │
│  Single shared database  PDFs / Backups / Uploads               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Request Flow (v2)

```
Browser Tab (Electron)
  │
  ├─► GET /dashboard
  │     → src/proxy.ts (auth gate, session renewal)
  │     → src/app/page.tsx (RSC)
  │     → dashboardService.getDashboard()
  │         → resolveSystemContext() [cookie → DB session lookup]
  │         → hasPermission(ctx, "dashboard", "view")
  │         → trialBalanceService.getTrialBalance() [Voucher Engine]
  │         → salesReportService.getSalesReport() [Reporting Engine]
  │     → React renders HTML → Electron window
  │
  └─► POST /api/sales-invoices (Server Action)
        → src/proxy.ts (auth gate)
        → salesInvoiceActions.postSalesInvoice(input)
            → getSystemContext() [cookie → DB lookup]
            → assertPermission(ctx, "sales", "create")
            → runInTransaction(tx =>
                gstEngine.calculateDocument(...)
                inventoryEngine.recordMovements(..., tx)
                voucherEngine.postVoucher(..., tx)
                salesInvoiceRepository.create(..., tx)
              )
            → auditLogService.record(...)
        → return { success: true, id }
```

### 2.3 Module Layer Boundaries (v2)

```
┌──────────────────────────────────────────────────────────┐
│  INVARIANT: Layer call direction is strictly top-down     │
│                                                          │
│  UI → Server Action → Service → Engine → Repository      │
│                                                          │
│  NEVER: Repository calls Engine                          │
│  NEVER: Engine calls Service                             │
│  NEVER: UI calls Repository directly                     │
│  NEVER: Service calls another domain's Repository        │
└──────────────────────────────────────────────────────────┘
```

---

## 3. v3 — Hardened Monolith + v4 Bridge

v3 is **additive only** — no v2 module boundaries, engine interfaces, or invariants
are changed. v3 introduces new features AND the bridge patterns that make v4 extraction
safe.

### 3.1 v3 Additional Architecture Layers

```
                     v2 Monolith (unchanged)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐  ┌────────────────────┐  ┌──────────────────┐
│ External       │  │ Health Endpoints   │  │ DomainEventBus   │
│ Integrations   │  │ /health/live       │  │ (in-process)     │
│ Engine (new)   │  │ /health/ready      │  │                  │
│                │  │ /health/startup    │  │ SalesInvoice     │
│ E-Invoice IRP  │  │                   │  │ posted → emit    │
│ E-Way Bill NIC │  │ Used by Electron   │  │ DomainEvent      │
│ Non-blocking   │  │ IPC health check   │  │ (nothing consumes│
└───────────────┘  └────────────────────┘  │ it yet in v3 —   │
                                           │ v4 Kafka will)   │
┌───────────────────────────────────────┐  └──────────────────┘
│ v4 Bridge Design Patterns (enforced)  │
│                                       │
│ ✅ Services receive PrismaClient as   │
│    constructor parameter (not import) │
│                                       │
│ ✅ Services receive SystemContext as  │
│    method parameter (not resolved     │
│    internally)                        │
│                                       │
│ ✅ No cross-domain @relation in new   │
│    Prisma models                      │
│                                       │
│ ✅ @openapi JSDoc on all new handlers │
└───────────────────────────────────────┘
```

### 3.2 New v3 Features Map

```
Phase 1 — Carry-Overs
  spec 91  Serial Number Tracking      (Inventory Engine extension)
  spec 92  Payroll                     (HR domain, VoucherEngine.SALARY)

Phase 2 — Compliance
  spec 94  E-Invoice (IRP/NIC API)     → ExternalIntegrations Engine
  spec 95  E-Way Bill (NIC EWB API)    → ExternalIntegrations Engine
  spec 96  Thermal Printing            → Electron IPC print:thermal
  spec 97  Barcode Billing             → UI-only (Product.barcode exists)

Phase 3 — Architecture Hardening
  spec 98  FIFO / Weighted Avg Costing → InventoryEngine.getCostLayer()
  spec 99  CompanyUser Join Table      → Auth domain schema migration
  spec 100 Rate Limiting               → src/proxy.ts + lru-cache
  spec 101 Database Encryption         → at-rest + Bytes columns
  spec 102 Backup Verification         → BackupJob + pg_restore verify
  spec 103 PDF Engine Migration        → Puppeteer OUT, @react-pdf IN
  spec 104 Default Voucher Types       → TenantBootstrapService seeder
  spec 110a Health Endpoints           → /health/* routes
  spec 110b Schema Domain Audit        → schema-domain-map.md artifact

Phase 4 — Code Quality
  spec 105 SystemContext Retrofit      → Pattern A + Pattern B DI
  spec 106 Global Error Boundaries     → React error boundaries

Phase 5 — Growth
  spec 107 AI Insights Engine          → Ollama (local) / OpenAI
  spec 108 Mobile PWA                  → next-pwa plugin
  spec 109 Cloud Sync Foundation       → PostgreSQL logical replication
```

### 3.3 ExternalIntegrations Engine (new in v3)

```
Sales Invoice Posted
  │
  ├─ [Inside transaction] ─────────────────────────────────────────
  │   VoucherEngine.postVoucher()
  │   InventoryEngine.recordMovements()
  │   SalesInvoiceRepository.create()
  │
  └─ [After transaction commits] ──────────────────────────────────
      ExternalIntegrationsEngine.generateIRN(invoiceId)
        │
        ├─ eInvoiceStatus === GENERATED? → return existing IRN (idempotent)
        ├─ CompanySettings.erpApiKey absent? → set PENDING, return (optional)
        └─ Call NIC/IRP API → set IRN, ackNumber, ackDate, QR
             → eInvoiceStatus = GENERATED
             → Failure → eInvoiceStatus = PENDING (retry-safe)

RULE: No external API call inside a Prisma transaction
RULE: ExternalIntegrations Engine has no import from VoucherEngine / GSTEngine / InventoryEngine
```

---

## 4. v4 — Cloud-Native Microservices

### 4.1 Full Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET / CLIENT TIER                                  │
│                                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │  Electron    │  │  Web Browser │  │  Mobile Browser  │  │  API Client        │  │
│  │  Desktop     │  │  (Chrome/    │  │  (PWA / iOS /    │  │  (3rd party /      │  │
│  │  (Offline)   │  │   Firefox)   │  │   Android)       │  │   integrations)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  └────────┬───────────┘  │
│         │                 │                   │                      │              │
│    runs locally      HTTPS + CDN         HTTPS + PWA           HTTPS REST          │
└─────────┼─────────────────┼───────────────────┼──────────────────────┼──────────────┘
          │                 │                   │                      │
          │         ┌───────┴───────────────────┴──────────────────────┘
          │         │             Cloudflare WAF / AWS WAF + Shield
          │         ▼
          │  ┌─────────────────────────────────────────────────────────────┐
          │  │              CDN (CloudFront / Cloudflare)                   │
          │  │  Static assets, frontend JS/CSS, image optimization          │
          │  └──────────────────────────┬──────────────────────────────────┘
          │                             │ Dynamic requests only
          │                             ▼
          │  ┌─────────────────────────────────────────────────────────────┐
          │  │           API GATEWAY (Kong / NGINX Ingress)                 │
          │  │                                                              │
          │  │  • JWT validation (public key from Keycloak JWKS)            │
          │  │  • Distributed rate limiting (Redis token bucket)            │
          │  │  • Request routing → correct microservice                    │
          │  │  • TLS termination                                           │
          │  │  • Request/response logging                                  │
          │  │  • OpenAPI contract enforcement                              │
          │  └──────────────────────────┬──────────────────────────────────┘
          │                             │
          │              ┌──────────────┼──────────────┐
          │              │ Kubernetes Cluster           │
          │              │ (premgiri-business NS)       │
          │              │                             │
          │    ┌─────────┴────────┐                   │
          │    │                  │                   │
          │    ▼                  ▼                   ▼
          │  auth-svc        company-svc         masters-svc
          │    │                  │                   │
          │    ▼                  ▼                   ▼
          │  sales-svc      purchase-svc        inventory-svc
          │    │                  │                   │
          │    └──────────────────┼───────────────────┘
          │                       │ Kafka Events
          │                       ▼
          │              accounting-svc     gst-svc     reporting-svc
          │                       │
          │                       ▼
          │              engine-svc (gRPC, internal only)
          │
          │ [Electron: local Next.js server talks to local Postgres directly]
          │ [Hybrid mode: Electron Sync Bridge pushes to cloud on reconnect]
          └─────────────────────────────────────────────────────────────────
```

### 4.2 Microservice Internal Architecture

Every microservice follows the **identical internal pattern** — only domain differs:

```
┌──────────────────────────────────────────────────────────────┐
│  microservice-name (e.g. sales-service)                       │
│                                                              │
│  ┌─────────────────┐   ┌──────────────────────────────────┐ │
│  │  HTTP Server     │   │  Kafka Consumer                  │ │
│  │  (Express/Fastify│   │  (for events this service        │ │
│  │   or Next.js API)│   │   reacts to)                     │ │
│  └────────┬─────────┘   └────────────────┬─────────────────┘ │
│           │                              │                   │
│           ▼                              ▼                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Service Layer                                           │ │
│  │  SalesInvoiceService(db: PrismaClient, bus: EventBus)    │ │
│  │    async postInvoice(ctx: SystemContext, input) {        │ │
│  │      // 1. Validate, 2. Run transaction, 3. Emit event   │ │
│  │    }                                                     │ │
│  └────────────────────────────┬────────────────────────────┘ │
│                               │                              │
│              ┌────────────────┼────────────────┐            │
│              ▼                ▼                ▼            │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Repository   │  │  Engine Service  │  │  Kafka       │  │
│  │ (Prisma)     │  │  (gRPC call to   │  │  Producer    │  │
│  │ tenant-scoped│  │   engine-service)│  │              │  │
│  └──────┬───────┘  └──────────────────┘  └──────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  TenantClientFactory                                     │ │
│  │  getPrismaForTenant(companyId) → PrismaClient            │ │
│  │  Connection pooling: PgBouncer per company DB            │ │
│  └─────────────────────────────────────────────────────────┘ │
│         │                                                   │
│         ▼                                                   │
│  PostgreSQL (premgiri_company_<uuid>)                        │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Kafka Event Flow

```
    ┌───────────────┐   sales.invoice.posted   ┌───────────────────┐
    │  sales-service│ ───────────────────────► │ inventory-service  │
    │               │                          │ (decrements stock) │
    │               │ ───────────────────────► │ accounting-service │
    └───────────────┘                          │ (posts voucher)    │
                                               └───────────────────┘

    ┌───────────────┐  purchase.invoice.posted  ┌───────────────────┐
    │purchase-service───────────────────────► │ inventory-service  │
    │               │                          │ (increments stock) │
    │               │ ───────────────────────► │ accounting-service │
    └───────────────┘                          │ (posts AP voucher) │
                                               └───────────────────┘

    ┌───────────────────┐  accounting.voucher.posted  ┌──────────────────┐
    │ accounting-service│ ─────────────────────────► │ reporting-service │
    │                   │                            │ (invalidate cache)│
    └───────────────────┘                            └──────────────────┘

Topic naming:  premgiri.{domain}.{entity}.{event}
Partitioning:  by companyId (events for same company processed in order)
DLQ:           premgiri.{topic}.dlq (failed messages, manual replay)
```

### 4.4 Auth Flow (v4)

```
  User Login (Web)
    │
    ▼
  Keycloak OIDC
    │
    ├─ POST /auth/token
    │   → Username + Password (or SSO)
    │   → Keycloak validates against auth-service User store
    │   → Returns JWT (RS256) + Refresh Token
    │
    │   JWT Payload:
    │   {
    │     sub: userId,
    │     companyId: "uuid",        ← from CompanyUser join table
    │     roleId: "uuid",           ← from CompanyUser join table
    │     permissions: ["sales:create", "purchase:view", ...],
    │     exp: 1800,                ← 30 min access token
    │     iss: "https://auth.premgiri.com"
    │   }
    │
    ├─ API Gateway validates JWT (JWKS endpoint, public key only)
    │   → No DB lookup on every request
    │   → Checks exp, iss, aud
    │
    ├─ x-company-id, x-role-id headers injected by gateway
    │
    └─ Service receives JWT claims → extracts SystemContext without DB call
```

### 4.5 Per-Tenant Database Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  PLATFORM DATABASE (premgiri_platform)                        │
│                                                              │
│  tables: companies, users, company_users, roles,             │
│          permissions, subscriptions, audit_logs (platform)   │
│                                                              │
│  Accessed by: auth-service, company-service only             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  COMPANY DATABASE (premgiri_company_<uuid> per company)       │
│                                                              │
│  tables: all business tables (products, invoices, vouchers,  │
│          ledgers, stock, employees, payroll, …)              │
│                                                              │
│  Created: atomically when company is provisioned             │
│  Migrated: independently per company (no downtime on others) │
│  Backed up: independently per company                        │
│  Accessed by: masters, sales, purchase, inventory,           │
│               accounting, gst, reporting services            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  CONNECTION POOLING (PgBouncer)                               │
│                                                              │
│  Without pooling: 9 services × N replicas × M companies      │
│  = thousands of Postgres connections                          │
│                                                              │
│  With PgBouncer transaction-mode pooling:                    │
│  each company DB holds a small, bounded connection pool      │
│  PgBouncer multiplexes all service connections into it       │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Core Business Engines

All engines are **pure functions** — no I/O, no permission checks, no `companyId`
lookup, no HTTP calls. They receive data in, return data out. Tests are deterministic.

### 5.1 Voucher Engine

```
Purpose: Double-entry bookkeeping — the financial backbone of every transaction.

Input:  VoucherInput { companyId, voucherType, entries: [{ledgerId, debit, credit}], tx? }
Output: Voucher { id, number, entries, totalDebit, totalCredit }

Rules enforced:
  ✓ Sum of all debits === sum of all credits (balanced entries)
  ✓ VoucherType determines allowed ledger classes (SALES must credit Sales Accounts)
  ✓ Every posted voucher is immutable (no UPDATE on posted rows)
  ✓ Cancellation creates a reversing voucher, never deletes

Called by:
  SalesInvoiceService  → VoucherType.SALES
  PurchaseInvoiceService → VoucherType.PURCHASE
  SalesReturnService   → VoucherType.SALES_RETURN
  PurchaseReturnService → VoucherType.PURCHASE_RETURN
  PaymentVoucherService → VoucherType.PAYMENT
  ReceiptVoucherService → VoucherType.RECEIPT
  ContraVoucherService  → VoucherType.CONTRA
  JournalVoucherService → VoucherType.JOURNAL
  PayrollRunService    → VoucherType.SALARY

v3 additions:
  CreditNoteService    → VoucherType.CREDIT_NOTE
  DebitNoteService     → VoucherType.DEBIT_NOTE

v4 note:
  Engine becomes engine-service (gRPC). Same interface. All callers switch
  from in-process function call to gRPC stub — no service rewrites.
```

### 5.2 Inventory Engine

```
Purpose: Track stock movements across warehouses for all products.

Core functions:
  recordMovements(companyId, lines, tx?) → StockTransaction[]
  hasSufficientStock(companyId, productId, warehouseId, qty) → boolean
  getStockBalance(companyId, productId, warehouseId?) → Decimal
  getCostLayer(productId, warehouseId, method) → CostLayerResult    ← NEW v3

Costing Methods (v3):
  LATEST_PURCHASE_COST  — last purchase price (v2 behaviour)
  FIFO                  — oldest cost layers consumed first
  WEIGHTED_AVERAGE      — running weighted average

StockTransaction Types:
  SALES        (OUT) ← Sales Invoice
  PURCHASE     (IN)  ← Purchase Invoice / GRN
  SALES_RETURN (IN)  ← Sales Return
  PURCHASE_RETURN (OUT) ← Purchase Return
  ADJUSTMENT   (IN/OUT) ← Stock Adjustment
  TRANSFER_IN  (IN)  ← Stock Transfer destination
  TRANSFER_OUT (OUT) ← Stock Transfer source
  OPENING      (IN)  ← Opening Stock

Batch + Serial tracking (opt-in per product):
  Batch:  batchId on StockTransaction (nullable, required if product.batchTracked)
  Serial: serialId on StockTransaction (qty must === 1 when tracked)
          Serial status derived from movement history, never stored directly
```

### 5.3 GST Engine

```
Purpose: Indian GST calculation for all supply types.

Core functions:
  calculateLine(input) → GstLineResult { cgst, sgst, igst, cess, taxableAmount }
  calculateDocument(lines) → DocumentGroupResult { b2b, b2c, nil, exempt }
  determineSupplyType(sellerState, buyerState, partyType) → SupplyType
  isHsnRequired(annualTurnover, lineValue) → boolean

Supply Types:
  INTRA_STATE  → CGST + SGST (equal split)
  INTER_STATE  → IGST (full amount)
  B2C_LARGE    → IGST (inter-state B2C above threshold)
  EXPORT       → IGST (or zero-rated)
  EXEMPT       → No GST
  NIL_RATED    → 0% GST (listed separately in GSTR-1)

v3 additions:
  E-Invoice (IRN) generation — post-transaction, via ExternalIntegrations Engine
  E-Way Bill generation — post-transaction, via ExternalIntegrations Engine
```

### 5.4 Pricing Engine

```
Purpose: Compute the effective selling price for a product on a sales document.

Priority chain (highest wins):
  1. Manual override on line item (explicit price entered by user)
  2. Customer-specific price list (CustomerPriceList)
  3. Company-wide price list (PriceList)
  4. Margin profile (Margin % over cost)
  5. Latest purchase cost (fallback)

v3 costing integration:
  Cost base for margin calculation = InventoryEngine.getCostLayer()
  (respects FIFO / WA / LatestPurchaseCost per CompanySettings)

Inputs:
  productId, customerId, qty, companyId, financialYearId
Output:
  EffectivePrice { unitPrice, priceSource, discountPercent, finalPrice }
```

### 5.5 Reporting Engine

```
Purpose: Aggregate financial and operational data into report shapes.

Pure builder functions (no I/O):
  buildTrialBalanceReport(trialBalance, ledgerGroups) → TrialBalanceReport
  buildProfitAndLoss(trialBalance, ledgerGroups) → PAndLReport
  buildBalanceSheet(trialBalance, ledgerGroups) → BalanceSheetReport
  buildCashFlowReport(vouchers, dateRange) → CashFlowReport (direct method)
  buildLiabilitySettlementReport(trialBalance, ledgerGroups) → LiabilityReport
  buildDashboardSummary(allReports) → DashboardData
  bucketByMonth(transactions) → MonthlyBucket[]
  topN(items, n, key) → TopNResult[]

Data sources (resolved by service layer, passed in):
  VoucherEngine.getTrialBalance() → drives financial reports
  SalesInvoiceRepository.findMany() → drives sales reports
  PurchaseInvoiceRepository.findMany() → drives purchase reports
  StockTransactionRepository.findMany() → drives inventory reports

v4 note:
  Reporting engine becomes reporting-service. Reads from all domain DBs
  via gRPC (read-only). Results are cached in Redis (5 min TTL).
```

### 5.6 ExternalIntegrations Engine (v3 NEW)

```
Purpose: Wrap outbound government API calls for E-Invoice and E-Way Bill.

Design contract:
  ✓ Non-blocking: called AFTER the primary transaction commits
  ✓ Idempotent: safe to retry on the same document
  ✓ Optional: if credentials absent, sets status PENDING and returns
  ✓ Isolated: no import from VoucherEngine / GSTEngine / InventoryEngine

E-Invoice flow:
  generateIRN(invoiceId)
    → load SalesInvoice (already posted)
    → check eInvoiceStatus (skip if GENERATED)
    → check CompanySettings.erpApiKey (skip if absent, set PENDING)
    → call NIC/IRP API → IRN, ackNumber, ackDate, QR code
    → update SalesInvoice.irn + eInvoiceStatus = GENERATED
    → on failure: eInvoiceStatus = PENDING (retry-safe)

E-Way Bill flow:
  generateEWB(invoiceId / deliveryChallanId)
    → similar pattern: non-blocking, idempotent, optional
    → creates EWayBill row with FK to SalesInvoice or DeliveryChallan
```

### 5.7 Document Number Engine

```
Purpose: Generate unique, sequential, per-company document numbers.

Pattern: [prefix]-[financial-year-short]-[padded-sequence]
Example: SI-2425-00042 (Sales Invoice, FY 2024-25, sequence 42)

DocumentTypes:
  SALES_INVOICE, SALES_ORDER, DELIVERY_CHALLAN, QUOTATION,
  SALES_RETURN, CREDIT_NOTE, DEBIT_NOTE,
  PURCHASE_INVOICE, PURCHASE_ORDER, GRN, PURCHASE_RETURN,
  PAYMENT_VOUCHER, RECEIPT_VOUCHER, CONTRA_VOUCHER, JOURNAL_VOUCHER,
  SALARY_VOUCHER, PAYROLL

Sequence is per (companyId, documentType, financialYearId) — never shared across companies.
Sequences are locked at increment time within the posting transaction.
```

---

## 6. Domain Module Architecture

### 6.1 Module Standard Structure

Every module follows this file layout (exemplified by `sales-invoices`):

```
src/modules/sales-invoices/
├── repositories/
│   └── sales-invoice-repository.ts    ← Prisma queries only, no business logic
├── services/
│   └── sales-invoice-service.ts       ← Business logic, engine calls, transactions
├── actions/
│   └── sales-invoice-actions.ts       ← Server Actions (auth gate, call service)
├── validation/
│   └── sales-invoice-schema.ts        ← Zod schemas for input validation
├── components/                        ← React components for this module
├── pdf/                               ← PDF template (v3+)
│   └── sales-invoice-pdf.tsx
└── utils/                             ← Pure helper functions
```

### 6.2 Domain Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AUTH DOMAIN                      │ COMPANY DOMAIN                        │
│                                  │                                       │
│ User, Session, Platform          │ Company, CompanySettings, Branch,     │
│ Role, Permission, RolePermission │ FinancialYear, CompanyUser (v3)        │
│                                  │                                       │
│ Auth: Local cookie/session (v2/v3│ CompanyUser enables multi-company     │
│ Auth: JWT + OIDC Keycloak (v4)   │ access for CAs / consultants          │
└──────────────────────────────────┴───────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│ MASTERS DOMAIN                                                           │
│                                                                         │
│ Ledger, LedgerGroup, Product, ProductCategory, Brand, Unit,             │
│ Tax, TaxRate, Warehouse, Customer, Supplier, MarginProfile,             │
│ PriceList, BankAccount, PaymentMode (v3), Employee (v3)                 │
│                                                                         │
│ All master data is company-scoped (every row has companyId).            │
│ Reused by every transactional domain (Sales, Purchase, Inventory, etc.) │
└─────────────────────────────────────────────────────────────────────────┘
┌────────────────────┐  ┌───────────────────┐  ┌────────────────────────┐
│ SALES DOMAIN        │  │ PURCHASE DOMAIN    │  │ INVENTORY DOMAIN        │
│                     │  │                   │  │                        │
│ Quotation           │  │ PurchaseOrder      │  │ StockTransaction        │
│ SalesOrder          │  │ GoodsReceiptNote   │  │ StockAdjustment         │
│ DeliveryChallan     │  │ PurchaseInvoice    │  │ StockTransfer           │
│ SalesInvoice        │  │ PurchaseReturn     │  │ PhysicalVerification    │
│ SalesReturn         │  │                   │  │ OpeningStock            │
│ CreditNote          │  │ v3: paymentModeId  │  │ Batch, SerialNumber     │
│ DebitNote           │  │ on payments[]      │  │                        │
│ EWayBill (v3)       │  │                   │  │ No financial engine;   │
│                     │  │                   │  │ reads from StockTx     │
│ v3: IRN, ackNumber  │  │                   │  │ trail only             │
└────────────────────┘  └───────────────────┘  └────────────────────────┘
┌─────────────────────────────────┐  ┌────────────────────────────────────┐
│ ACCOUNTING DOMAIN                │  │ GST DOMAIN                          │
│                                 │  │                                    │
│ Voucher, VoucherEntry           │  │ GstRegister, GstFilingRecord        │
│ VoucherType (seeded by v3)      │  │ GSTR1, GSTR2, GSTR3B               │
│ ManualVouchers (4 types)        │  │ HsnSummary, ITCRegister            │
│ LiabilitySettlement             │  │                                    │
│ v3: PaymentMode on Vouchers     │  │ Read-only aggregation over         │
│                                 │  │ SalesInvoice + PurchaseInvoice     │
│ Source of truth for all         │  │ posted data via VoucherEngine      │
│ financial reports               │  │                                    │
└─────────────────────────────────┘  └────────────────────────────────────┘
┌─────────────────────────────────┐  ┌────────────────────────────────────┐
│ HR DOMAIN                        │  │ REPORTING DOMAIN                    │
│                                 │  │                                    │
│ Employee (v3)                   │  │ TrialBalance, P&L, BalanceSheet     │
│ Attendance (v3)                 │  │ CashFlow, SalesReports             │
│ PayrollPeriod, PayslipEntry     │  │ PurchaseReports, InventoryReports  │
│                                 │  │ CustomerReports, SupplierReports   │
│ Payroll posts VoucherType.SALARY│  │ EmployeeReports, GstReports        │
│ via VoucherEngine               │  │ ERP Dashboard                      │
│ Attendance feeds payroll calc   │  │                                    │
│                                 │  │ Pure read — never writes           │
└─────────────────────────────────┘  └────────────────────────────────────┘
```

### 6.3 Document Lifecycle

```
Every business document follows this state machine:

  DRAFT ──► POSTED ──► CANCELLED
    │
    └── (some docs skip DRAFT: Vouchers post immediately)

State transitions:
  DRAFT → POSTED:      service.post*() — validates, runs engines, creates voucher
  POSTED → CANCELLED:  service.cancel*() — posts reversing voucher, immutable history

INVARIANT: A POSTED document's financial entries can never be deleted.
           Cancellation always creates a compensating entry in the ledger.
```

---

## 7. Data Architecture

### 7.1 Schema Domain Map

```
Domain     Key Models                          Cross-domain FKs
─────────  ──────────────────────────────────  ─────────────────────────────────
Auth       User, Session                       None (root domain)
Company    Company, CompanyUser, FinancialYear  User (via userId in CompanyUser)
Masters    Ledger, Product, Customer, Employee  Company (via companyId — all rows)
Sales      SalesInvoice, SalesInvoicePayment    Customer, Ledger, Product (→ Masters)
Purchase   PurchaseInvoice, PurchaseReturn      Supplier, Ledger, Product (→ Masters)
Inventory  StockTransaction, StockAdjustment    Product, Warehouse (→ Masters)
Accounting Voucher, VoucherEntry, Ledger        Ledger (Masters), User (Actor)
GST        GstRegister, GstFilingRecord         SalesInvoice (→ Sales)
HR         Employee, PayrollRun                 User (optional link), Branch (→ Company)
```

Cross-domain FKs that must be resolved to plain `String` IDs in v4 (spec 110b):
- `SalesInvoicePayment.paymentModeId` (Sales → Masters)
- `PurchaseInvoicePayment.paymentModeId` (Purchase → Masters)
- `Voucher.paymentModeId` (Accounting → Masters)
- `StockTransaction.salesInvoiceId` (Inventory → Sales)

### 7.2 Tenant Isolation

```
INVARIANT: Every query in every repository must include a WHERE companyId = ?

Single enforcement point:
  Server Action → getSystemContext() → ctx.company.id → passed to repository

Repository pattern:
  async findMany(companyId: string, filters: Filters) {
    return prisma.model.findMany({
      where: { companyId, ...filters }   // companyId is NEVER optional
    });
  }

Defense in depth (v4):
  JWT claim x-company-id → TenantClientFactory → per-company DB connection
  A service literally cannot query another company's DB (different connection string)
```

### 7.3 Audit Trail Architecture

```
v2: Platform-only AuditLog (5 events: company created, user created, etc.)

v3 spec 80: Extend to 10 document post/cancel events
  recordDocumentAuditEvent(actorUserId, companyId, action, targetType, targetId, metadata)
  Actions: DOCUMENT_POSTED, DOCUMENT_CANCELLED

v3 spec 93: Universal Audit Trail (all ~50 service writes)
  Every service write method calls auditLogService.record()
  createdBy / updatedBy columns on all business tables
  Actions: CREATED, UPDATED, POSTED, CANCELLED, DELETED

v4: AuditLog events flow through Kafka → dedicated Audit microservice
  Transport changes; interface unchanged
```

---

## 8. Security Architecture

### 8.1 Security Layers

```
Layer 1 — Network
  v2/v3: Electron localhost only (no public network exposure)
  v4:    Cloudflare WAF + AWS WAF + Shield (DDoS protection)
         HTTPS everywhere (TLS 1.3 minimum)
         Cloudflare Tunnel or AWS PrivateLink for internal services

Layer 2 — Authentication
  v2/v3: Cookie-based session
         COOKIE_KEYS (encrypted signed cookies)
         src/proxy.ts validates every request
         Session stored in PostgreSQL Session table

  v4:    JWT + OIDC (Keycloak)
         RS256 signed tokens (private key in Vault)
         30-minute access tokens + 7-day refresh tokens
         PKCE flow for web/PWA clients
         API Gateway validates JWT via JWKS (no DB on every request)

Layer 3 — Authorization
  All versions: Role-Based Access Control (RBAC)
  assertPermission(user, module, action)
  PERMISSION_MODULES × PERMISSION_ACTIONS matrix
  Company Admin always has all permissions (seeded by TenantBootstrapService)
  Platform Admin (Super Admin) never uses RBAC — gated by userType === PLATFORM

Layer 4 — Service-to-Service (v4 only)
  mTLS via Istio/Linkerd service mesh
  Every pod has its own X.509 certificate (rotated automatically)
  NetworkPolicy: engine-service only accepts connections from business pods

Layer 5 — Secrets Management (v4 only)
  HashiCorp Vault — all DB passwords, JWT signing keys, API keys
  Vault Agent Sidecar injects secrets as files (never env vars in ConfigMap)
  Secrets rotated on schedule without pod restart (dynamic secrets)

Layer 6 — Data at Rest
  v3: Database encryption documented + scripted (spec 101)
      Sensitive columns stored as Bytes (encrypted before persistence)
      Cloud connection string encrypted (spec 109)
  v4: EBS/PVC encryption at provider level + Vault-encrypted column values

Layer 7 — Rate Limiting
  v3: lru-cache sliding window in src/proxy.ts
      Login: 5/min/IP, API: 100/min/IP, Reports: 10/min/user
  v4: API Gateway distributed rate limiting (Redis token bucket)
      Per-company + per-endpoint granularity
```

### 8.2 Authorization Flow

```
Request arrives at Server Action / Route Handler
  │
  ▼
getSystemContext()   ← resolves user + company from session/JWT
  │
  ├─ userType === PLATFORM?
  │     └─ assertSuperAdmin() (hardcoded check, not RBAC)
  │
  └─ userType === COMPANY?
        └─ assertPermission(ctx.user, module, action)
              │
              └─ checks Role.permissions[] for (module, action) pair
                    │
                    ├─ PASS → continue
                    └─ FAIL → throw AuthorizationError (HTTP 403)
```

---

## 9. Observability Architecture

### 9.1 v2/v3 — Local Observability

```
Logging:    Pino (structured JSON logs, local stdout)
            Log levels: error, warn, info, debug
            Every 429, every auth failure, every engine error logged at warn+

Errors:     Global Error Boundaries (React, v3 spec 106)
            AppError (typed), AuthenticationError, AuthorizationError
            Server-side errors never leak stack traces to client

Health:     /health/live, /health/ready, /health/startup (v3 spec 110a)
            Electron IPC health-check call before opening app window
```

### 9.2 v4 — Full Observability Stack

```
┌──────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK (v4)                   │
│                                                              │
│  Metrics         Logs              Traces           Alerts   │
│  ─────────       ────────          ──────           ──────   │
│  Prometheus      Loki              Jaeger           Alertmanager
│  (pull model)    (log aggregation) (distributed     (PagerDuty/
│                                    tracing)          Slack)  │
│       │               │                │                     │
│       └───────────────┴────────────────┘                     │
│                       │                                      │
│                  Grafana Dashboards                           │
│                  (unified view)                              │
│                                                              │
│  Per-service metrics exposed at /metrics (Prometheus format) │
│  Log correlation via traceId header (injected at API Gateway)│
│  SLO targets: 99.9% uptime, p99 < 500ms, error rate < 0.1%  │
└──────────────────────────────────────────────────────────────┘

Standard metrics per service:
  http_request_duration_seconds  (histogram, by route + status)
  http_requests_total            (counter, by route + method + status)
  kafka_consumer_lag             (gauge, by topic + partition)
  db_query_duration_seconds      (histogram, by query type)
  cache_hit_ratio                (gauge, Redis enabled only)
```

---

## 10. Deployment Architecture

### 10.1 v2/v3 Desktop Deployment

```
Installer (NSIS / electron-builder)
  │
  ├─ Electron + Next.js bundled
  ├─ Node.js runtime included
  ├─ PostgreSQL installer (Windows: chocolatey / bundled)
  ├─ Prisma migrations run on first launch (spec 88)
  └─ TenantBootstrapService seeds Platform Admin account

Runtime:
  Electron Main Process ──IPC──► Next.js Server (localhost:3000)
  Next.js Server ──Prisma──► PostgreSQL (localhost:5432)

Auto-update:
  electron-updater checks GitHub Releases on startup
  Silent download → prompt to restart → new version applied
```

### 10.2 v4 Kubernetes Deployment

```
┌────────────────────────────────────────────────────────────────────┐
│  KUBERNETES CLUSTER                                                  │
│                                                                    │
│  Namespace: premgiri-platform                                       │
│    auth-service        (2–10 pods, HPA on CPU)                     │
│    company-service     (2–10 pods, HPA on CPU)                     │
│                                                                    │
│  Namespace: premgiri-business                                       │
│    masters-service     (2–20 pods, HPA on CPU + RPS)               │
│    sales-service       (2–20 pods, HPA)                            │
│    purchase-service    (2–20 pods, HPA)                            │
│    inventory-service   (2–20 pods, HPA)                            │
│    accounting-service  (2–20 pods, HPA)                            │
│    gst-service         (2–10 pods, HPA)                            │
│    reporting-service   (2–10 pods, HPA + KEDA on Kafka lag)        │
│    engine-service      (2–10 pods, HPA on gRPC RPS)               │
│                                                                    │
│  Namespace: premgiri-frontend                                       │
│    frontend (Next.js)  (2–20 pods, HPA on CPU)                     │
│                                                                    │
│  Namespace: premgiri-data                                           │
│    postgres            (StatefulSet, PersistentVolumeClaim)        │
│    pgbouncer           (DaemonSet per company DB pool)             │
│    redis               (StatefulSet, 3 primary + 3 replica)        │
│    kafka               (StatefulSet, 3 brokers, KRaft mode)        │
│                                                                    │
│  Namespace: premgiri-infra                                          │
│    nginx-ingress       (LoadBalancer Service)                      │
│    cert-manager        (Let's Encrypt TLS)                         │
│    vault               (StatefulSet, HA mode)                      │
│    argocd              (GitOps controller)                         │
│    prometheus-stack     (Operator-managed)                         │
└────────────────────────────────────────────────────────────────────┘

CI/CD Pipeline:
  Git push → GitHub Actions
    → npm test + tsc + eslint
    → Docker build + push (ECR/GHCR)
    → Update image tag in Helm values
    → ArgoCD detects drift → syncs Kubernetes → rolling update

Kubernetes Probes (spec 110a + v4 K8s config):
  livenessProbe:   GET /health/live    (fail → restart pod)
  readinessProbe:  GET /health/ready   (fail → remove from load balancer)
  startupProbe:    GET /health/startup (delay liveness/readiness until ready)
```

### 10.3 Hybrid Desktop + Cloud

```
Electron Desktop (Offline Mode)
  │
  ├─ Local Next.js + Local Postgres (unchanged from v3)
  │
  └─ Electron Sync Bridge (spec 130, enabled in Hybrid mode)
       │
       ├─ On reconnect: push local changes to cloud Kafka
       ├─ Conflict resolution: last-write-wins per document (v4 initial)
       └─ Cloud → Local sync: subscribe to company Kafka topic
```

---

## 11. Cross-Cutting Invariants

These invariants hold across **all versions** and must never be violated:

### Financial Invariants
1. Every financial transaction produces a balanced Voucher (Σ debits = Σ credits).
2. Posted Vouchers are immutable — cancellation creates a reversing entry, never deletes.
3. Financial reports are always derived from the Voucher/VoucherEntry trail only — never from invoice totals directly.
4. Every inventory movement is recorded in `StockTransaction` — stock balance is always computed from the transaction trail, never stored as a balance column.

### Tenant Isolation Invariants
5. Every repository query filters by `companyId` — no cross-tenant data leakage is possible at the query level.
6. `companyId` is always resolved from the authenticated session or JWT claim — never from client-supplied request parameters.
7. A PLATFORM user (Super Admin) never holds a company context — they operate cross-company through the Administration module only.

### Engine Invariants
8. Engines are pure functions — no I/O, no permission checks, no `companyId` lookup inside engine functions.
9. UI components never calculate GST, stock balances, margins, or ledger entries — always via engine calls.
10. External API calls (E-Invoice, E-Way Bill) are never made inside a database transaction.

### Architecture Invariants
11. Service → Engine is the only allowed direction; Engine → Service calls are forbidden.
12. Repository → Service calls are forbidden; Services call Repositories, not vice versa.
13. UI → Repository direct calls are forbidden; UI always goes through Server Actions → Service.
14. Cross-domain data access in v4 goes through gRPC (reads) or Kafka (writes) — never direct DB queries across service boundaries.

### v3/v4 Bridge Invariants
15. New v3 service classes receive `PrismaClient` as a constructor parameter — no direct import of the global singleton inside service classes.
16. New v3 service methods receive `SystemContext` as a method parameter — no internal calls to `getSystemContext()` inside a service class.
17. No new `@relation` in v3 Prisma models crosses a domain boundary (see spec 110b for the domain boundary definitions).
18. Redis must never be the source of truth for any financial data (v4).
19. Every pod passes its liveness and readiness probes before receiving traffic (v4).
20. No secret is stored in plaintext in a ConfigMap or environment variable — all from Vault (v4).

---

*Last updated: Milestone v3 documentation complete, v4 specs drafted.*
*Source files: `context/`, `context-v3/`, `context-v4/`, `context-v2/`*
