# AI Development Workflow Rules — Milestone v3

## Base Workflow Rules (Unchanged)

All development workflow rules from `context/ai-workflow-rules.md` remain in force.
This file documents only **amendments and additions** for Milestone v3.

---

## Milestone v3 Phase Numbers

The v3 feature-spec numbers start at **91** (continuing from the highest v2 spec, 90).
The v3 tracker numbers start at **82** (continuing from the highest v2 tracker item, #81).

When referencing v2 specs from v3 specs, always use the full path:
`context/feature-specs/<spec-number>-<name>.md`

When referencing v3 specs, use:
`context-v3/feature-specs/<spec-number>-<name>.md`

---

## Context Files to Read Before Starting Any v3 Feature

In addition to the v2 context reading order, read these v3 files first:

1. `context-v3/project-overview.md`
2. `context-v3/architecture-context.md`
3. `context-v3/code-standards.md`
4. `context-v3/Phases/phase-tracker.md` — check current phase/status
5. `context-v3/progress-tracker.md` — check current session state

---

## Phase Ordering Rule (v3)

Phases must be completed in order: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5.

**Exception**: Phase 4 (Code Quality) items — specs 105 and 106 — may be worked on
concurrently with Phase 3 items, since they have no dependency on Phase 3 changes.

Within each phase, respect the dependency order defined in the feature-spec's
"Depends On" column in `context-v3/Phases/phase-tracker.md`.

---

## New Rule: Non-Blocking External Integrations

Any feature that calls an external API (NIC/IRP, NIC EWB) must be designed so that:
- A network failure does not fail the primary business operation.
- The integration status is surfaced to the user as a separate, retriable action.
- No external API call may be made inside a database transaction.

---

## New Rule: Audit Trail in Every Service Write

Every new service method introduced in v3 that writes a business record must include an
`auditLogService.record()` call. This is part of the "Done" definition for every v3
feature — a feature is not complete if its writes are not audited.

---

## New Rule: @react-pdf/renderer Only

No new code may import or use Puppeteer. All PDF generation must use
`@react-pdf/renderer`. The Puppeteer dependency is removed in spec 103 — any spec
implemented before spec 103 that needs PDF output must wait for spec 103 or implement
a placeholder that returns the existing Puppeteer path unchanged.

---

## Tracker Update Rule (v3)

After every v3 feature is merged into `main`, update **both**:
1. `context-v3/Phases/phase-tracker.md` — update the feature's status to ✅
2. `context-v3/progress-tracker.md` — add a dated session entry

The v2 tracker (`context/Phases/phase-tracker.md`) and v2 progress tracker
(`context/progress-tracker.md`) are read-only from this point forward — do not add
v3 entries to v2 tracking files.

---

## New Rule: OpenAPI-First Service Contracts

Every new Server Action handler (or equivalent HTTP entry point) introduced in v3 must
include a JSDoc `@openapi` block describing its path, method, request body, and
response codes. See `context-v3/architecture-context.md` — Bridge Decision D.

This annotation is the documentation contract — it must be kept in sync with the
implementation. If the request/response shape changes, the `@openapi` block changes
in the same commit.

---

## New Rule: Context-as-Parameter (Dependency Injection Pattern)

New v3 service classes must receive `SystemContext` (or the user/company context
objects they need) as **constructor parameters**, not by calling `getSystemContext()`
internally.

```typescript
// ✅ Correct (v3 / v4-ready):
export class PayrollService {
  constructor(
    private readonly db: PrismaClient,
    private readonly eventBus: DomainEventBus,
  ) {}
  async processPayroll(ctx: SystemContext, periodId: string) {
    // ctx is passed in, not fetched internally
  }
}

// ❌ Wrong (legacy pattern — do not use in new v3 code):
export class PayrollService {
  async processPayroll(periodId: string) {
    const ctx = await getSystemContext(); // internal resolution — breaks microservices
  }
}
```

The `SystemContext` object is resolved once at the Server Action layer and threaded
down into all service calls. Services do not call `getSystemContext()` internally.
This pattern is required for all new service code in v3; existing services are
retrofitted in spec 105.

---

## New Rule: Bridge Spec Compatibility

All v3 specs must be implemented in a way that does not block the v4 migration.
Specifically:

1. **No new cross-domain Prisma `@relation`** — see Bridge Decision E in
   `context-v3/architecture-context.md`.
2. **No new internal `getSystemContext()` calls inside services** — see the
   Context-as-Parameter rule above.
3. **No new direct `prisma` singleton imports inside service classes** — see
   Bridge Decision A in `context-v3/architecture-context.md`.
4. **Health endpoints must be implemented before any v4 migration begins** — see
   spec 110a.

If a feature cannot be implemented without violating one of these rules, stop and
document the constraint in `context-v3/v4-bridge-analysis.md` before proceeding.
