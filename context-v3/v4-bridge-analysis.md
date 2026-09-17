# V3 → V4 Bridge Analysis
# These are the gaps found in v3 that must be addressed to make v4 migration smooth.
# Written as amendments to be applied to context-v3/ files.

## Gap 1: No CacheService Abstraction in v3
v3 has no CacheService interface. v4's Redis toggle (spec 124) requires every
service to use `CacheService` / `NullCacheService` from day one.
FIX: Add CacheService interface stub to v3 code-standards.md.
STATUS: will be added to context-v3/code-standards.md

## Gap 2: No Kafka Event Schema preparation in v3
v3's cloud sync (spec 109) uses PostgreSQL logical replication, not Kafka.
v4 uses Kafka for ALL cross-domain writes. v3 services emit no events at all.
FIX: Add "Domain Event" interface standard to v3 — services should emit
typed DomainEvent objects on writes (even if nothing consumes them yet in v3).
STATUS: new v3 spec needed

## Gap 3: v3 auth stays cookie/session; v4 needs JWT
v3 never changes the auth model. v4 changes to JWT + RS256 + OIDC.
The CompanyUser join table (v3 spec 99) is necessary for v4 JWT multi-company
switching but the JWT-readiness of the user model is not mentioned in v3.
FIX: Add JWT-readiness notes to v3 spec 99 (CompanyUser join table).
STATUS: amendment to context-v3/feature-specs/99-company-user-join-table.md

## Gap 4: src/lib/prisma.ts is a global singleton — incompatible with per-tenant model
The real code at src/lib/prisma.ts exports a single global PrismaClient.
v4's TenantClientFactory (spec 126) requires per-company Prisma clients.
v3 must introduce the concept of a "database abstraction layer" that v4 can swap.
FIX: v3 code-standards must say services should receive a `prisma` client as
a parameter (not import it directly) — enabling v4 to inject per-tenant clients.
STATUS: amendment to context-v3/code-standards.md

## Gap 5: v3 services import `getCurrentCompanyUser` directly — breaks microservice extraction
Real code shows: sales-invoice-service.ts imports getCurrentCompanyUser from current-user.ts.
This direct import makes it impossible to extract into a microservice in v4.
The SystemContext retrofit (spec 105) partially fixes this but doesn't go far enough.
FIX: v3 spec 105 must explicitly require that after retrofit, services accept
context as a PARAMETER (dependency injection), not call context-resolution functions internally.
STATUS: amendment to context-v3/feature-specs/105-system-context-retrofit.md

## Gap 6: No OpenAPI contract documented anywhere in v3
v4 requires every service to have an openapi.yaml before implementation (contract-first).
v3 has no API contract documentation at all.
FIX: Add OpenAPI-first rule to v3 ai-workflow-rules.md as a "v4 preparation" standard.
STATUS: amendment to context-v3/ai-workflow-rules.md

## Gap 7: v3 rate limiter uses lru-cache (in-memory, single process)
v4 moves rate limiting to the API Gateway (distributed, cluster-wide).
The in-memory lru-cache from v3 spec 100 will be replaced entirely.
FIX: Document in v3 spec 100 that the rate limiter is intentionally a single-process
solution and will be superseded by the API Gateway in v4.
STATUS: amendment to context-v3/feature-specs/100-rate-limiting.md

## Gap 8: v3 cloud sync uses PostgreSQL logical replication
v4 uses Kafka, not logical replication, for sync.
v3 spec 109 (Cloud Sync Foundation) must note it will be superseded.
FIX: Add a "v4 Supersession Note" to spec 109.
STATUS: amendment to context-v3/feature-specs/109-cloud-sync-foundation.md

## Gap 9: v3 has no concept of per-service Prisma schemas
v4 requires each microservice to have its own Prisma schema.
v3 must prepare the schema for this by ensuring the monolith schema is
cleanly segmented along domain lines (no cross-domain FKs except through
explicitly defined domain IDs).
FIX: New v3 spec: "Schema Domain Segmentation Audit" — verify no cross-domain
FK violations exist that would block microservice extraction.
STATUS: new spec needed in context-v3/feature-specs/

## Gap 10: No healthcheck endpoints in v3
v4 requires /health/live, /health/ready, /health/startup on every pod.
v3 Next.js app has no health endpoints.
FIX: Add health endpoint spec to v3.
STATUS: new spec needed in context-v3/feature-specs/
