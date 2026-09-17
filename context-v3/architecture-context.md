# Architecture Context — Milestone v3

## Base Architecture (Unchanged)

Premgiri Books ERP continues to follow the **Offline-First Modular Monolith** design
established in v1/v2. All v3 changes are additive — no existing module boundaries,
engine interfaces, or invariants are removed or violated.

Read `context/architecture-context.md` in full before reading this file. This document
records only the **architectural decisions, additions, and amendments** introduced by
Milestone v3.

---

## New Architectural Decisions in v3

### Decision 1 — Universal Audit Trail (spec 93)

Every business-model write (create/update/cancel/post) must record `actorUserId`,
`action`, `targetType`, `targetId`, `companyId`, and `metadata` in `AuditLog`.

- `createdBy` and `updatedBy` columns are added to **all** business tables in a single
  migration.
- `AuditLog.record()` is called from every Service method that performs a write, via
  `SystemContext.actorUserId`, never from repositories or UI.
- The existing 5-event Platform-level audit trail is extended, not replaced.

---

### Decision 2 — CompanyUser Join Table (spec 99)

`User.companyId` (the current direct nullable FK) is migrated to a `CompanyUser` join
table. This enables multi-company access for consultants and CA firms without changing
the tenant isolation rule (every query still filters by `companyId` from the session).

Migration path:
1. Create `CompanyUser` table with `(userId, companyId, roleId, isActive)`.
2. Backfill from existing `User.companyId` / `User.roleId` rows.
3. Make `User.companyId` and `User.roleId` nullable (they become deprecated columns).
4. Update `getCurrentCompanyUser()` to read from the join table.
5. Remove deprecated columns in a follow-up migration after full verification.

---

### Decision 3 — FIFO / Weighted Average Costing (spec 98)

A new `CostingMethod` enum (`LATEST_PURCHASE_COST`, `FIFO`, `WEIGHTED_AVERAGE`) is
added to `CompanySettings`. The Inventory Engine gains a `getCostLayer(productId,
warehouseId, method)` function that computes the effective cost from the
`StockTransaction` trail. The Pricing Engine reads this function for Pricing and
inventory valuation. No existing `StockTransaction` schema is changed — cost is
always computed from the existing immutable transaction trail.

---

### Decision 4 — E-Invoice / E-Way Bill (specs 94, 95)

A new `ExternalIntegration` engine (`src/engines/external-integrations/`) wraps calls
to the NIC/IRP API and the NIC EWB API. It is:
- Optional and non-blocking: if E-Invoice configuration is absent, posting continues
  without IRN generation (the invoice is flagged `eInvoiceStatus: PENDING` for retry).
- Isolated from core engines: the Voucher Engine, GST Engine, and Inventory Engine have
  no dependency on this new engine.
- Idempotent: retrying IRN generation for the same invoice is always safe.

New Prisma columns on `SalesInvoice`: `irn`, `ackNumber`, `ackDate`, `qrCode`,
`eInvoiceStatus` (`NOT_APPLICABLE` / `PENDING` / `GENERATED` / `CANCELLED`).
New Prisma model: `EWayBill` with FK to `SalesInvoice` and `DeliveryChallan`.

---

### Decision 5 — PDF Engine Migration (spec 103)

Puppeteer and its bundled Chromium are removed from the Electron bundle and replaced with
`@react-pdf/renderer`. All existing PDF templates (Sales Invoice) are rewritten as React
component trees using `@react-pdf/renderer` primitives. The Electron IPC channel
`pdf:generate` is retained; the handler implementation changes from launching a headless
browser to calling `renderToBuffer()`.

This is a **breaking change** to PDF appearance (fonts, layout, fidelity) — the new
templates must be reviewed by the user before the migration is merged.

---

### Decision 6 — Thermal Printing (spec 96)

A new Electron IPC channel `print:thermal` accepts a structured receipt payload and
converts it to ESC/POS byte sequences. No third-party print driver is required —
the printer must expose a raw USB or network socket. Configuration (printer name, paper
width) is stored in `CompanySettings.thermalPrinterConfig` (JSON column).

---

### Decision 7 — Rate Limiting (spec 100)

A Next.js middleware layer (`src/middleware.ts`, which already exists as `src/proxy.ts`)
is extended with an in-memory sliding-window rate limiter using `lru-cache`. Limits:
- Login endpoint: 5 attempts per IP per minute.
- API routes: 100 requests per IP per minute.
- Report generation: 10 requests per user per minute.

For a local-only Electron deployment, "per IP" reduces to "per localhost" — the limiter
still guards against runaway client-side loops or automated scripts on the local network.

---

### Decision 8 — SystemContext as Universal Standard (spec 105)

`src/lib/system-context.ts` (`SystemContext`) becomes the **sole** way to access the
current user and company context in Server Actions and services. The legacy
`getCurrentUser()`, `getCurrentCompanyUser()`, and `getCurrentCompany()` helpers are
deprecated. After spec 105 is complete, those functions remain in place but call through
to `SystemContext` internally (they are not deleted, to avoid breaking any future code
that imports them, but new code must not call them directly).

---

## Updated Technology Stack (v3 Additions)

| Layer | Technology | Purpose |
|---|---|---|
| External Integrations | NIC/IRP API + NIC EWB API | E-Invoice IRN, E-Way Bill |
| PDF Generation | @react-pdf/renderer | Replaces Puppeteer (removed) |
| Thermal Printing | ESC/POS via Electron IPC | 80mm receipt printing |
| AI Insights | Ollama (local) or OpenAI API | Business insights |
| Mobile PWA | Next.js PWA plugin | Read-only mobile access |
| Cloud Sync | PostgreSQL logical replication | Optional cloud backup |
| Rate Limiting | lru-cache in Next.js middleware | Brute-force protection |

---

## Invariants (Updated for v3)

All original invariants from `context/architecture-context.md` remain in force.
The following are added or amended:

13. Every business-model write must record `actorUserId` in `AuditLog` (v3 addition).
14. E-Invoice generation must be non-blocking — a NIC API failure must never prevent
    Sales Invoice posting.
15. FIFO/weighted-average cost is always computed from the immutable `StockTransaction`
    trail — never stored as a denormalized balance.
16. PDF generation must not depend on a headless browser — use `@react-pdf/renderer`.
17. `SystemContext` is the sole entry point for current-user resolution in new code.
18. Cloud sync must remain optional — the application must function identically with or
    without a cloud connection configured.

---

## Known Implementation Gaps (v2 → v3 Carry-Over)

The following gaps were documented in `context/architecture-context.md` as of v2 and are
being resolved in v3:

| Gap | v2 Status | v3 Resolution |
|---|---|---|
| User↔Company join table | Direct `User.companyId` FK | spec 99 — `CompanyUser` join table |
| Audit logging narrow (5 events) | Platform events only | spec 93 — universal retrofit |
| `createdBy`/`updatedBy` missing | Not on any table | spec 93 — added to all tables |
| SystemContext inconsistently used | ~15 services use legacy helpers | spec 105 — universal retrofit |
| Default Voucher Types not seeded | `TenantBootstrapService` gap | spec 104 — seed in bootstrap |
| Puppeteer PDF fragile | Double installer size | spec 103 — replace with react-pdf |
| No rate limiting | Login/API unprotected | spec 100 — middleware rate limiter |
| No database encryption | Plaintext at rest | spec 101 — documented + scripted |
| No backup verification | Silent failures possible | spec 102 — restore-and-verify script |
| FIFO/WA costing not implemented | Latest cost only | spec 98 — engine extension |

---

## v4-Readiness Bridge Decisions

These decisions are made in v3 specifically to ensure smooth migration to v4's
cloud-native Kubernetes microservices architecture. They do not change visible behavior
in v3 but prevent architectural debt accumulation.

### Bridge Decision A — Prisma Client as Injected Dependency

The global `prisma` singleton in `src/lib/prisma.ts` (`globalForPrisma.prisma`) must
not be called directly in new v3 code. Instead, new v3 service classes receive a
`PrismaClient` (or compatible `PrismaPg` client) as a constructor parameter:

```typescript
// v3 pattern (bridge-ready):
export class SalesInvoiceService {
  constructor(private readonly db: PrismaClient) {}
}
```

In v3 the singleton is still used as the default at the call site (server actions pass
`prisma` from `src/lib/prisma.ts`). In v4 the call site switches to a per-tenant client
without changing any service internals. This is **mandatory for all new services
introduced in v3**. Existing services are retrofitted in spec 105.

---

### Bridge Decision B — DomainEventBus Interface

Any cross-module side effects triggered by a service write (e.g., "sales invoice posted
→ inventory decremented → ledger entry created") must be expressed through a
`DomainEventBus` interface, not direct service-to-service imports.

The `DomainEventBus` is defined in v3 as an in-process synchronous interface:

```typescript
// src/lib/domain-event-bus.ts
export interface DomainEventBus {
  publish(event: DomainEvent): Promise<void>;
}
export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
  companyId: string;
  actorUserId: string;
}
```

In v3 the implementation is a simple in-process fan-out. In v4 the implementation
switches to Kafka without changing any publishing service internals.

---

### Bridge Decision C — Health Endpoints (spec 110a)

The Next.js application must expose three health-check routes at:

- `GET /health/live` — process is up (always 200 if the route is reachable)
- `GET /health/ready` — database is reachable and accepting queries (200 / 503)
- `GET /health/startup` — all required environment variables are present (200 / 503)

In v3 these serve the Electron app's IPC health-check call. In v4 they become the
Kubernetes liveness, readiness, and startup probe targets. See spec 110a.

---

### Bridge Decision D — OpenAPI-First Service Contracts

Every new service introduced in v3 must have its public interface described in a JSDoc
`@openapi` block on the Server Action handler (or equivalent). The format follows the
OpenAPI 3.1 schema inline annotation standard. This is the v3 precursor to the full
OpenAPI contract generation pipeline in v4.

Example:
```typescript
/**
 * @openapi
 * /api/sales-invoices:
 *   post:
 *     summary: Post a sales invoice
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: Invoice posted
 *       422:
 *         description: Validation error
 */
export async function postSalesInvoiceAction(...) {}
```

---

### Bridge Decision E — No Cross-Domain Foreign Keys in New Schemas

New Prisma models introduced in v3 must not add foreign-key relationships that cross
domain boundaries (as defined in spec 110b — Schema Domain Segmentation Audit).
Domains are: Auth, Company, Masters, Sales, Purchase, Inventory, Accounting, GST, HR.

Cross-domain references must use `String` ID fields (no Prisma `@relation`) so that
each domain can be extracted into an independent microservice database in v4 without
requiring a cross-service migration.

**Invariant 19 (new):** No new `@relation` in any v3 Prisma model that crosses a domain
boundary. Use a plain `String` ID field and resolve the foreign entity in the service
layer.
