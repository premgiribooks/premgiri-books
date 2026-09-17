# Code Standards — Milestone v3

## Base Standards (Unchanged)

All coding standards from `context/code-standards.md` remain in force.
This file documents only the **additions and amendments** introduced in Milestone v3.

---

## Audit Trail Standards (New in v3)

Every service method that performs a business-model write (create, update, post,
cancel, activate, deactivate) must call `auditLogService.record()` before returning.

Pattern

```typescript
// At the end of every write method in a Service class:
await auditLogService.record({
  actorUserId: ctx.user.id,
  companyId: ctx.company?.id ?? null,
  action: "CREATED",            // CREATED | UPDATED | POSTED | CANCELLED | DELETED
  targetType: "SalesInvoice",   // Prisma model name, Pascal-cased
  targetId: result.id,
  metadata: { invoiceNumber: result.invoiceNumber },
});
```

Rules
- `auditLogService.record()` is called from **services only** — never from repositories,
  UI components, or route handlers.
- Audit records are never deleted or updated — `AuditLog` is append-only.
- `metadata` must include only the fields needed to identify the change in a human-
  readable audit report — never the full serialized entity.
- Audit writes are part of the same transaction as the business write they record.

---

## SystemContext Standard (New in v3)

All new code must use `SystemContext` to resolve the current user and company.
Legacy helpers (`getCurrentUser()`, `getCurrentCompanyUser()`, `getCurrentCompany()`)
are deprecated — new code must not call them.

```typescript
// In a Server Action or Service:
const ctx = await getSystemContext();
assertPermission(ctx.user, "sales", "create");
const company = ctx.assertCompany(); // throws if no company context
```

Retrofitting existing code to `SystemContext` is spec 105's job — do not retrofit
pre-v3 services as a side effect of unrelated v3 work.

---

## External Integration Standards (New in v3)

All calls to external APIs (NIC/IRP, NIC EWB) must follow these rules:

1. Wrapped in `src/engines/external-integrations/` — never called directly from
   services or UI.
2. Non-blocking by default — the calling service must handle a failure gracefully
   (mark the record `PENDING`, log the error, return success to the UI).
3. Idempotent — retrying the same request for the same `targetId` must never create
   duplicates.
4. Credential storage: API credentials stored in `CompanySettings` (encrypted at rest
   in v3 after spec 101 lands), never in `.env` or code.
5. All external responses must be logged to `AuditLog` with `targetType` matching the
   business document.

---

## FIFO Costing Standards (New in v3)

FIFO and weighted-average cost calculations must:

1. Always compute from the `StockTransaction` trail — never from a stored balance.
2. Use `Decimal` arithmetic (the existing `decimal.js` library) for all cost
   accumulation — never native `number`.
3. Never exceed the oldest-available lot's quantity during a FIFO OUT movement.
4. Return the cost layer breakdown alongside the computed unit cost so callers can
   display it.

---

## PDF Standards (New in v3 — Replaces Puppeteer Rules)

All PDF generation must use `@react-pdf/renderer`:

1. Templates live in `src/modules/<module>/pdf/<TemplateName>.tsx`.
2. Templates are pure React components — no browser APIs, no `window`, no `document`.
3. `renderToBuffer()` is the only export — never `renderToStream()` for Electron IPC.
4. Fonts must be embedded using `@react-pdf/renderer`'s `Font.register()` — no system
   font lookups.
5. The Electron IPC handler `pdf:generate` wraps `renderToBuffer()` and sends the
   resulting `Uint8Array` back to the renderer process.

---

## Testing Standards (Amendments for v3)

In addition to the engine unit and integration tests required by `context/code-standards.md`:

- Every `AuditLog.record()` call site must have at least one test asserting that a
  record is written with the correct `action`, `targetType`, and `targetId`.
- External integration functions must be tested with a mock HTTP client — never against
  the real NIC API in CI.
- FIFO costing must include tests for: single lot, multi-lot, partial lot, zero-stock
  underrun, and FIFO-vs-WA difference on the same data set.
- PDF rendering must include a snapshot test using `renderToBuffer()` output size as a
  smoke check (not pixel-level comparison).

---

## Rate Limiting Standards (New in v3)

The rate-limiter middleware in `src/middleware.ts` must:

1. Use sliding-window algorithm (not fixed-window) to avoid burst exploitation.
2. Return `429 Too Many Requests` with a `Retry-After` header in seconds.
3. Log every rate-limit rejection to Pino at `warn` level with `ip`, `route`, and
   `requestCount`.
4. Never store rate-limit state in the database — in-memory `lru-cache` only.
5. Rate limits are configurable via `src/config/rate-limits.ts` constants — not
   hardcoded inline.


---

## v4-Readiness Standards (New in v3 — Bridge to Microservices)

These standards are introduced in v3 specifically to make the v4 microservices
extraction smooth. Code written to these standards in v3 requires zero
refactoring to work inside a v4 microservice.

### Rule: Services Must Accept Context as a Parameter (not resolve it internally)

After the SystemContext retrofit (spec 105), services must not call
`getSystemContext()` / `getCurrentUser()` / `getCurrentCompanyUser()` inside
their method bodies. Instead, context is resolved once in the Server Action layer
and passed down as a parameter.

Wrong (current pattern — to be eliminated by spec 105):
```typescript
// Inside a service method — breaks microservice extraction
export const salesInvoiceService = {
  async postInvoice(id: string) {
    const user = await getCurrentCompanyUser()   // ← internal resolution
    assertPermission(user, "sales", "create")
    const prisma = globalPrisma                  // ← global singleton
    ...
  }
}
```

Correct (v3 target pattern — v4-compatible):
```typescript
// Service method receives context and a prisma client
export const salesInvoiceService = {
  async postInvoice(ctx: SystemContext, prisma: PrismaClient, id: string) {
    assertPermission(ctx.user, "sales", "create")
    // prisma is injected — v4 will inject the per-tenant client
    ...
  }
}
```

The Server Action calls `getSystemContext()` once and passes it in:
```typescript
// Server Action (Next.js server-side only)
export async function postSalesInvoiceAction(id: string) {
  const ctx = await getSystemContext()
  return salesInvoiceService.postInvoice(ctx, prisma, id)
}
```

This pattern makes the service layer testable without mocking Next.js globals,
and directly portable to a v4 microservice where context comes from a JWT header.

---

### Rule: CacheService Abstraction (v4 Bridge)

All code that would benefit from caching must use a `CacheService` interface
rather than caching directly. v3 uses an in-process implementation; v4 swaps
it for Redis without changing any service code.

```typescript
// src/lib/cache-service.ts (new in v3)
export interface CacheService {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
}

// In-memory implementation for v3 (no Redis yet)
export class InMemoryCacheService implements CacheService {
  private store = new Map<string, { value: unknown; expiresAt: number }>()
  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry || Date.now() > entry.expiresAt) return null
    return entry.value as T
  }
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }
  async del(key: string): Promise<void> { this.store.delete(key) }
}

// No-op for tests / when caching disabled
export class NullCacheService implements CacheService {
  async get() { return null }
  async set() {}
  async del() {}
}
```

Cache key format (matches v4 Redis namespace):
`{companyId}:{domain}:{entity}:{id}` — e.g., `abc123:masters:product:xyz789`

---

### Rule: Domain Events Interface (v4 Bridge)

All cross-domain side effects must be triggered through a `DomainEventBus`
interface. v3 uses a synchronous in-process bus; v4 swaps it for Kafka
without changing service code.

```typescript
// src/lib/domain-event-bus.ts (new in v3)
export interface DomainEvent {
  eventId: string       // UUID — used for idempotency in v4
  eventType: string     // e.g. "SALES_INVOICE_POSTED"
  companyId: string
  timestamp: string     // ISO8601
  payload: Record<string, unknown>  // domain-specific fields
}

export interface DomainEventBus {
  emit(event: DomainEvent): Promise<void>
}

// Synchronous in-process bus for v3 (no Kafka yet)
// Registered handlers are called immediately in the same transaction
export class InProcessEventBus implements DomainEventBus {
  private handlers = new Map<string, Array<(e: DomainEvent) => Promise<void>>>()
  on(eventType: string, handler: (e: DomainEvent) => Promise<void>) {
    const existing = this.handlers.get(eventType) ?? []
    this.handlers.set(eventType, [...existing, handler])
  }
  async emit(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? []
    for (const h of handlers) await h(event)
  }
}
```

Services emit events instead of calling other services directly:
```typescript
// In sales-invoice-service.ts postInvoice():
await eventBus.emit({
  eventId: uuid(),
  eventType: "SALES_INVOICE_POSTED",
  companyId,
  timestamp: new Date().toISOString(),
  payload: { invoiceId, lines, grandTotal }
})
// In v3: inventoryEngine and voucherEngine are called as handlers registered
//         on this event — same behavior, event-driven shape
// In v4: this exact emit() call sends to Kafka; handlers become consumers
```

---

### Rule: Health Endpoints Required

Every v3 route added must be accessible without a session for health checking.
The application must expose these three endpoints (new in v3, required by v4):

```
GET /health/live    → 200 { status: "ok" }         (always — just process alive)
GET /health/ready   → 200 / 503                     (DB connection + basic check)
GET /health/startup → 200 / 503                     (migrations applied check)
```

These endpoints are added as part of spec 110b (Health Endpoints) in v3.
v4 wires them to K8s liveness/readiness/startup probes with no changes.

---

### Rule: OpenAPI Contract Documentation

Every new REST endpoint added in v3 must have a corresponding entry in
`docs/api/openapi.yaml`. This is the contract v4 uses to generate gRPC
Protobuf definitions and client SDKs.

v3 does not enforce runtime validation against the OpenAPI spec — that is v4's
job. v3 only requires the spec to be written and kept up to date.

Format: OpenAPI 3.1 YAML, path per endpoint, request/response schemas
using `$ref` to component schemas defined in `docs/api/components/`.
