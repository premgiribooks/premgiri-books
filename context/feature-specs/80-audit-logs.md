# 80 - Audit Logs

> Feature-spec file number 80 (sequential, never reused). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 11 — Productivity Features** item **#78
> Audit Logs**, `Depends On: Platform`. "Platform" here means this feature depends on the
> Super-Admin/Administration migration's infrastructure already existing (the `AuditLog`
> model, `auditLogService`, the `userType`-discriminated `PLATFORM`/`COMPANY` split) — it
> does **not** mean this feature itself is a Platform/Super-Admin feature. See the
> Company-vs-Platform Disambiguation section immediately below; this was a real, resolved
> design decision, not an assumption.

## Goal

**Retrofit** the existing, generic `AuditLog` model (`actorUserId, action, targetType,
targetId, companyId?, metadata Json?, createdAt` — `prisma/schema.prisma`, already
implemented) to cover **ordinary Company-side business-module writes** — starting with
voucher/document posting and cancellation — beyond the 5 narrow Administration/Super-Admin
tenant-lifecycle events it covers today, **plus** a Company-scoped screen to browse,
filter, and export that log. This is explicitly a retrofit of the existing model and its
existing `auditLogService.record()` function — **no second `AuditLog`-shaped model is
introduced**, and `auditLogService`'s own shape is not changed, only its set of callers is
extended.

---

# Company-vs-Platform Disambiguation (resolved)

Two facts must be reconciled before any design here makes sense:

1. `src/constants/breadcrumbs.ts` already reserves `audit → "Audit"` as a segment label,
   and `src/app/administration/audit/page.tsx` **already exists** — read in full for this
   spec. It renders:

   ```tsx
   export default async function AuditPage() {
     await requireSuperAdmin();
     return (
       <PlatformShell>
         <ComingSoon title="Audit" description="An audit log viewer is not implemented yet." />
       </PlatformShell>
     );
   }
   ```

   That is, `/administration/audit` is a **Super-Admin-only** (`requireSuperAdmin()`),
   **Platform-shell** (`PlatformShell`, the cross-company Super-Admin UI, not the
   Company-side `AppShell`), currently-a-stub page. Per
   `architecture-Migration-Super-Admin-Administration.md` and
   `architecture-context.md`'s User Hierarchy section, the Super Admin persona
   (`User.userType === "PLATFORM"`) sees every company and is gated by the single
   hardcoded `assertSuperAdmin()` check, never RBAC/`PERMISSION_MODULES`.

2. `context/Phases/phase-tracker.md`'s Phase 11 table lists `#78 Audit Logs`,
   `Depends On: Platform` — alongside `#79 Backup & Restore`, `Depends On: Database` — as
   ordinary Phase 11 **Productivity Features**, in the same tracker section as Global
   Search, Excel Import/Export, PDF Generation, and Barcode Billing, none of which are
   Platform/Super-Admin concerns. "Depends On: Platform" reads as a *prerequisite*
   (the Super-Admin migration's `AuditLog` model/service must already exist, which it
   does), not a scope statement that this feature itself lives under `/administration`.

**Conclusion: these are two different features that happen to share an evocative English
word.** `/administration/audit`'s still-unbuilt screen is (or will be, if a future spec
ever completes it) a Super-Admin, **cross-company** view over the 5 narrow tenant-
lifecycle events (`architecture-context.md`'s Known Implementation Gap item 3) — company
creation, company admin creation/password reset, company activation/deactivation. This
spec's Audit Logs feature is a **Company-scoped**, RBAC-permissioned view over **ordinary
business-transaction events** (see v1 Scope below) happening *inside* one company, read
only by users of that company. They must not collide:

- **Route**: this spec's screen lives at **`/settings/audit-logs`**, *not*
  `/administration/audit` — a new page under the Company-side `/settings` hub (alongside
  `/settings/users`, `/settings/roles`, `/settings/document-numbering`,
  `/settings/sales-ledgers`), gated the same way those are (`isCurrentUserCompanyAdmin()`
  hub-level gate plus a real `assertPermission` check per action — see Security).
  `/administration/audit` is left exactly as it is (a Super-Admin stub, untouched by this
  spec — completing it is a separate, not-yet-scheduled Platform-side feature).
- **Breadcrumb**: per `breadcrumbs.ts`'s own documented "parent/segment" disambiguation
  convention (the file's comment gives `"purchase/orders"` as the example of two modules
  reusing a segment name), add a **new**, more specific key
  `"settings/audit-logs": "Audit Logs"` rather than touching the existing bare
  `audit: "Audit"` key, which stays reserved for the Administration tree.
- **Model reuse is still correct despite the split**: both features read from the *same*
  underlying `AuditLog` table (there is only one `AuditLog` model) — the Company-side
  screen this spec builds simply **filters to rows where `companyId` equals the requesting
  user's own company**, which already excludes the handful of Administration-side rows
  that are Super-Admin actions without a company context, or whose `companyId` belongs to
  a *different* company. No new column or flag is needed to keep the two screens'
  results apart — the existing `companyId` scoping already does it, identically to every
  other repository in this codebase (Tenant Isolation Rule).

---

# Project Context

Before implementation, review

- `architecture-context.md`'s Known Implementation Gaps items 3 and 4 (the exact current
  scope of `AuditLog` writes — 5 Administration events only — and the absence of
  `createdBy`/`updatedBy` columns anywhere else)
- `src/modules/administration/services/audit-log-service.ts` (**read in full — the real
  file, already read for this spec**):

  ```ts
  export interface RecordAuditLogInput {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    companyId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }

  export const auditLogService = {
    async record(input: RecordAuditLogInput, client: Prisma.TransactionClient | typeof prisma = prisma): Promise<void> {
      await client.auditLog.create({ data: { ...input, metadata: input.metadata ?? undefined } });
    },
  };
  ```

  Its shape is already generic enough for this retrofit as-is — `action`/`targetType` are
  plain strings, `metadata` is a free-form `Json?` bag, and `client` already accepts a
  `Prisma.TransactionClient` so a caller can record inside its own posting transaction.
  **Nothing about this function changes.** Only its *callers* are extended.
- `architecture-Migration-Super-Admin-Administration.md` (confirms the 5 existing call
  sites and why `AuditLog` was introduced narrowly, company-optional, for tenant-lifecycle
  events specifically)
- `31-voucher-engine.md` (`postVoucher`/`cancelVoucher` — pure engine functions taking
  `companyId` and a validated input, with **no** actor/session awareness — this is why the
  audit write cannot live inside the engine itself; see Mechanism Decision below)
- `52-payment-voucher.md` / `53-receipt-voucher.md` / `54-contra-voucher.md` /
  `55-journal-voucher.md`, `38-sales-invoice.md`, `39-sales-return.md`, `40-credit-note.md`,
  `41-debit-note.md`, `44-purchase-invoice.md`, `45-purchase-return.md` (the ten existing
  document/voucher services this spec's v1 retrofit touches — see v1 Scope)

---

# Module Responsibilities

The Audit Logs feature is responsible for

- Extending `AuditLog` write coverage to the v1 scope of business events below, via new
  call sites in existing services — **not** a new model, **not** a change to
  `auditLogService`'s own shape
- A Company-scoped, permission-gated `/settings/audit-logs` screen: list, filter (date
  range, action, target type, actor), and export

The Audit Logs feature is **not** responsible for

- The 5 existing Administration/tenant-lifecycle events or the `/administration/audit`
  Super-Admin screen — untouched, a separate feature (see Disambiguation above)
- Universal coverage of every mutation in the codebase — an explicit, named v1 scope (see
  below), not a claim of completeness
- Any change to `voucherEngine`, `inventoryEngine`, `gstEngine`, or `pricingEngine`
  themselves
- Backup/Restore's own operational logging (feature-spec 81) — a separate concern,
  Platform-gated, not routed through this model in this spec (see that spec's own
  forward-note)

---

# v1 Scope Decision (explicit, not universal)

`ai-workflow-rules.md`'s Development Scope calls for "small, testable changes" and warns
against feature requests spanning multiple subsystems at once. Retrofitting audit logging
onto *every* mutation across Masters, Sales, Purchase, Inventory, Accounting, GST,
Employees, and Settings in one spec would violate that directly, and would produce a log
so noisy (every minor master edit alongside every financial posting) that the browse
screen's own filtering becomes the only way to find anything meaningful — defeating the
point.

**v1 scope: financial-transaction-level events only** — every existing service function
that calls `voucherEngine.postVoucher` or `voucherEngine.cancelVoucher` (directly, or via
a document service that wraps them) gets one matching `AuditLog` row, recorded inside the
**same transaction** as the posting/cancellation itself. This is a clean, mechanically
identifiable boundary (grep for the two engine call names) that exactly matches "voucher
posted/cancelled, invoice posted" from the drafting brief, and covers:

| Module (existing service file)                                              | Events                              |
| ----------------------------------------------------------------------------- | ------------------------------------ |
| `manual-vouchers/services/payment-voucher-service.ts`                        | Payment Voucher post / cancel       |
| `manual-vouchers/services/receipt-voucher-service.ts`                       | Receipt Voucher post / cancel       |
| `manual-vouchers/services/contra-voucher-service.ts`                        | Contra Voucher post / cancel        |
| `manual-vouchers/services/journal-voucher-service.ts`                       | Journal Voucher post / cancel       |
| `sales-invoices/services/sales-invoice-service.ts`                          | Sales Invoice post / cancel         |
| `sales-returns/services/sales-return-service.ts`                           | Sales Return post / cancel          |
| `credit-notes/services/credit-note-service.ts`                             | Credit Note post / cancel           |
| `debit-notes/services/debit-note-service.ts`                               | Debit Note post / cancel            |
| `purchase-invoices/services/purchase-invoice-service.ts`                   | Purchase Invoice post / cancel      |
| `purchase-returns/services/purchase-return-service.ts`                     | Purchase Return post / cancel       |

**Deliberately deferred to a named v2 follow-up** (recorded here, not silently dropped):

- Stock-only movements with no voucher/GST involvement — Opening Stock, Stock Adjustment,
  Stock Transfer, Physical Verification (each of those specs explicitly notes "no GST/
  Voucher Engine call anywhere") — these have no natural hook into the
  `postVoucher`/`cancelVoucher` boundary this v1 uses, and a inventory-movement audit
  trail is a different-shaped follow-up (it would hook `inventoryEngine.recordMovements`
  instead), not an oversight of this scope.
- Master-level create/edit/activate/deactivate events (Products, Customers, Suppliers,
  Ledgers, etc.) — genuinely useful, but a much larger surface (every master module) that
  deserves its own scoped spec rather than being folded silently into this one.
- GST return generation/filing events (Phase 8, not yet implemented at all).

---

# Mechanism Decision: call-site convention, not an engine wrapper

**Decision: add a call to a new, thin, shared helper immediately after each existing
`voucherEngine.postVoucher`/`cancelVoucher` call, inside the same transaction — not a
cross-cutting middleware/decorator wrapped around the engine functions themselves.**

Reasoning, weighed against this codebase's Repository → Service → Engine layering:

- `voucherEngine.postVoucher(companyId, input, tx?)` and `cancelVoucher(companyId, id,
  tx?)` (spec 31) are **pure**, engine-layer functions — they take a validated input and a
  `companyId`, and have **no** concept of the acting user or session. Every module
  Service that calls them (Payment Voucher, Sales Invoice, etc.) already resolved the
  actor via `getCurrentCompanyUser()`/`SystemContext` and already ran its own
  `assertPermission` check *before* reaching the engine call. A wrapper placed at the
  engine boundary would need the engine to either accept a new `actorUserId` parameter on
  every call (leaking session/actor concerns into a layer the whole project has kept
  actor-free) or reach for `getCurrentUser()` itself (violating Permanent Architecture
  Principle 3 — repositories/engines never resolve identity or authorize; that branching
  lives in Services only, per `architecture-context.md`'s Repository Rules).
- Each calling Service already has every piece of information an audit row needs sitting
  in scope at the exact point it calls `postVoucher`/`cancelVoucher`: the actor, the
  `companyId`, the just-posted/cancelled record's id and type, and the open `tx`. Adding
  one line there is the smallest, most local change — consistent with "extending existing
  callers, not the shape of `auditLogService`," which is exactly what the drafting brief
  asked for.
- This mirrors the existing precedent: `auditLogService.record()` is *already* called
  directly from inside `companyService.createCompany()`'s own transaction for the Company
  Created event (per `architecture-Migration-Super-Admin-Administration.md`) — a plain
  call-site, not a wrapper. This spec's retrofit is the same pattern, at ten more call
  sites.

**New shared helper** (thin, so the ten call sites stay one line each and use consistent
`action`/`metadata` shapes — not a second copy of `auditLogService` itself):

```text
src/modules/audit/services/audit-event-recorder.ts
```

```ts
export type DocumentAuditAction = "DOCUMENT_POSTED" | "DOCUMENT_CANCELLED";

export interface RecordDocumentAuditEventInput {
  actorUserId: string;
  companyId: string;
  action: DocumentAuditAction;
  targetType: string;   // e.g. "SalesInvoice", "Voucher" (manual-voucher screens have no own document model — see Data Model)
  targetId: string;
  metadata?: Record<string, unknown>; // e.g. { documentType, voucherNumber, grandTotal }
}

export async function recordDocumentAuditEvent(
  input: RecordDocumentAuditEventInput,
  client: Prisma.TransactionClient
): Promise<void> {
  await auditLogService.record(
    { actorUserId: input.actorUserId, action: input.action, targetType: input.targetType, targetId: input.targetId, companyId: input.companyId, metadata: input.metadata },
    client
  );
}
```

A fixed, two-value `DocumentAuditAction` union (`DOCUMENT_POSTED`/`DOCUMENT_CANCELLED`)
rather than one action string per document type (`SALES_INVOICE_POSTED`,
`PAYMENT_VOUCHER_POSTED`, …) keeps the browse screen's action filter short and keeps the
mechanical retrofit uniform; **which** document/voucher type is recorded in `targetType`
and `metadata.documentType` (the existing `DocumentType` enum value, e.g.
`"SALES_INVOICE"`, `"PAYMENT_VOUCHER"`) instead — the same information, just carried on a
different field, so the filter UI can still narrow by document type via `metadata`
without multiplying the action vocabulary.

`client` is **required** (not optional/defaulting to `prisma`) on this helper specifically
— every one of the ten call sites already has an open transaction at the point it posts/
cancels a voucher, and an audit record for a financial posting must never be written
outside that same atomic unit of work (a crash between "voucher posted" and "audit row
written" must never leave one without the other).

---

# Data Model

**No new Prisma model, enum, or migration.** The existing `AuditLog` model
(`actorUserId, action, targetType, targetId, companyId?, metadata Json?, createdAt`) is
reused exactly as it stands — this spec adds ten new *callers*, not a new table.

`targetType` values this spec introduces: `"SalesInvoice"`, `"SalesReturn"`,
`"CreditNote"`, `"DebitNote"`, `"PurchaseInvoice"`, `"PurchaseReturn"`, and `"Voucher"`
(the four manual-voucher screens — Payment/Receipt/Contra/Journal — have no own document
model per specs 52–55's own decision, so their `targetId` is the underlying `Voucher.id`
and `metadata.documentType` carries the specific `*_VOUCHER` `DocumentType` value that
distinguishes them). `companyId` is always populated for every v1 event (unlike some of
the 5 Administration events, which can precede a company's own existence) — this spec's
events never happen without an already-resolved company context.

---

# Business Rules

- Every v1 call site records **exactly one** `AuditLog` row per posting and one per
  cancellation — never more, never a row for a Draft save/edit (Drafts are not yet
  financial events; only posting and cancellation are).
- The audit write happens **after** the `postVoucher`/`cancelVoucher` call succeeds but
  **inside the same transaction** — if the transaction later rolls back for any reason
  (a subsequent step in a multi-step posting orchestration fails, e.g. Sales Invoice's
  Quick-Customer-conversion-then-post sequence), the audit row rolls back with it; there
  is never an audit row for a posting that did not actually commit.
- `AuditLog` rows are **never edited or deleted** by any code path this spec introduces —
  the browse screen (below) is read-only, matching `architecture-context.md`'s "Reports
  are read-only" invariant applied here even though this isn't formally a Report.
- The browse screen is **Company-scoped only** — a user only ever sees rows for their own
  `companyId`; there is no cross-company view in this spec (see Disambiguation — that
  remains a distinct, not-yet-built Platform/Super-Admin capability at
  `/administration/audit`).

---

# Service / Repository

Create

```text
src/modules/audit/repositories/audit-log-repository.ts
src/modules/audit/services/audit-event-recorder.ts   // recordDocumentAuditEvent, see above
src/modules/audit/services/audit-log-service.ts       // listAuditLogs(filters) — the browse screen's read path
src/modules/audit/validation/audit-log-schema.ts       // filter-input Zod schema
src/modules/audit/actions/audit-log-actions.ts
src/modules/audit/components/…
```

- `auditLogRepository.list(companyId, filters)`: company-scoped (never a client-supplied
  `companyId`), supporting date-range, `action`, `targetType`, and `actorUserId` filters,
  paginated (this table can grow large — no unbounded "load everything" query;
  `code-standards.md`'s Performance goals apply the same "large reports should support
  pagination" rule here even though this is not formally under Reports).
- This new module's own `audit-log-service.ts` is a distinct file from
  `src/modules/administration/services/audit-log-service.ts` — same name, different
  module path, same reason the two features stay separate (Disambiguation above); do not
  merge them into one file, since the Administration one is Platform-scoped and this one
  is Company-scoped with a different repository underneath.
- Extend each of the ten existing services listed under v1 Scope with one call to
  `recordDocumentAuditEvent(...)`, immediately after (in the same transaction as) their
  own `voucherEngine.postVoucher`/`cancelVoucher` call — no other change to any of those
  ten files' existing logic, signatures, or tests beyond the one new call and its
  accompanying test case.

---

# Validation

Zod (`audit-log-schema.ts`), filter input only (there is no create/edit input — rows are
system-written): optional `dateFrom`/`dateTo` (calendar dates, `dateFrom <= dateTo`),
optional `action` (`"DOCUMENT_POSTED" | "DOCUMENT_CANCELLED"`), optional `targetType`
(string, matched against the fixed v1 vocabulary above), optional `actorUserId` (uuid),
`page`/`pageSize` (bounded, e.g. `pageSize` ≤ 100).

---

# UI

Pages (new, under the existing `/settings` hub)

- `/settings/audit-logs` — list (Date/Time, Action, Target Type, Target, Actor, a
  `metadata`-derived summary column e.g. "SALES_INVOICE INV-0004, ₹12,500.00") with the
  filters above; a row expands (or links) to show the full `metadata` JSON for that event.
  Read-only — no create/edit/delete UI of any kind.
- An "Export" action (CSV at minimum) over the current filtered result set — reuses
  whatever shared Excel/CSV export utility Phase 11's Excel Export spec (tracker #75,
  drafted concurrently by a teammate as one of spec files 75–78) establishes, if it has
  landed by the time this is implemented; falls back to a plain CSV writer otherwise. This
  is a forward cross-reference, not a hard dependency — Audit Logs' browse screen does not
  block on Excel Export existing first.

Wire-up

- Add an "Audit Logs" card to the `/settings` hub page
  (`src/app/settings/page.tsx`'s `SETTINGS_MODULES` array), alongside User Management/
  Roles & Permissions/Document Numbering/Sales & GST Ledgers.
- Add `"settings/audit-logs": "Audit Logs"` to `src/constants/breadcrumbs.ts` (the
  parent/segment form — see Disambiguation for why the bare `audit` key is *not* reused).

---

# Security

**New permission module: `audit`.** `audit` is **not** in the current
`src/constants/permissions.ts` `PERMISSION_MODULES` list (`dashboard, masters, sales,
purchase, inventory, accounting, gst, reports, employees, settings, company,
financial-year, users, roles`) — per the drafting brief's own instruction, this is named
explicitly rather than force-fit into `settings` or `reports`: an audit trail is neither
general company configuration (`settings`) nor a financial/business report over voucher
data (`reports`), and giving it its own module lets a company grant "view the audit trail"
without also granting `settings`'s broader configuration-editing permissions.

Add `"audit"` to `PERMISSION_MODULES`; only two of the six `PERMISSION_ACTIONS` are used —
`view` (see the list) and `export` (the CSV/export action) — `create`/`edit`/`delete`/
`approve` are never checked for this module, since nothing in this feature is ever
user-authored or user-modified. Seed the two new `audit`+action `Permission` catalog rows
the same way `gst`/`reports`/`employees` were added when those modules were introduced
(a global capability-definition catalog row per module×action pair — `Permission` remains
global, not per-company, per `architecture-context.md`'s Multi-Tenant Architecture
section). No default reserved role is granted `audit` automatically except Company Admin
(which, per `TenantBootstrapService`'s existing rule, always receives every module/action
pair) — a Company Admin decides which other roles (e.g. Accountant) also get `audit`/
`view` via the existing Roles & Permissions screen, no seed-time default assumed for them.

All reads scoped to the requesting user's own company (Business Rules above) — never a
cross-company view, and never gated by `assertSuperAdmin()` (that gate belongs exclusively
to the separate, untouched `/administration/audit` screen).

---

# Database

No new model, enum, or migration. `AuditLog` (existing) gains ten new callers across six
existing modules; no column, index, or constraint change.

---

# Code Standards

Strict TypeScript, no `any`, no business logic duplicated (the retrofit adds exactly one
call per site, never re-deriving what was posted/cancelled). Vitest coverage for:

- `recordDocumentAuditEvent` itself: correct `action`/`targetType`/`targetId`/`metadata`
  shape, and that it requires (never defaults) a transaction client.
- Each of the ten retrofitted service functions: a new test case per post/cancel path
  asserting exactly one matching `AuditLog` row is created inside the same transaction
  (mocked `prisma.auditLog.create` call, matching this codebase's existing mocking
  convention for engine calls) — and that a forced failure *after* the audit call but
  before the transaction commits rolls the audit row back too (no orphan audit entries for
  a posting that never actually committed).
- `auditLogRepository.list`: company-scoping (a cross-company row never appears), each
  filter dimension, and pagination bounds.
- The permission gate: `/settings/audit-logs` and its export action reject a user without
  `audit`/`view` (or `export`, respectively).

---

# Do Not

Do not implement

- A second `AuditLog`-shaped Prisma model, or any change to `auditLogService`'s existing
  signature/shape
- Coverage for the deferred v2 items (stock-only movements, master-level create/edit/
  activate/deactivate, GST returns) — named, not built, in this spec
- Any edit/delete UI for audit rows — read-only, forever, by design
- A cross-company view, or any use of `assertSuperAdmin()` — this feature is
  Company-scoped only; the existing `/administration/audit` stub remains the (separate,
  still-unbuilt) Platform-side feature
- An engine-level or middleware wrapper around `voucherEngine.postVoucher`/`cancelVoucher`
  — the call-site convention above is the decided mechanism
- Reusing the bare `audit` breadcrumb key — use `"settings/audit-logs"`

---

# Success Criteria

Verify

- Posting or cancelling a Payment/Receipt/Contra/Journal Voucher, Sales Invoice, Sales
  Return, Credit Note, Debit Note, Purchase Invoice, or Purchase Return produces exactly
  one new `AuditLog` row with the correct `action` (`DOCUMENT_POSTED`/`DOCUMENT_CANCELLED`),
  `targetType`, `targetId`, `companyId`, and `metadata.documentType`.
- A forced failure inside the same posting transaction after the audit call rolls back
  both the financial posting and the audit row together — never one without the other.
- `/settings/audit-logs` shows only the requesting user's own company's rows, supports
  every documented filter, and its Export action produces a file matching the current
  filtered result set.
- A user without the new `audit` permission module's `view` action cannot reach
  `/settings/audit-logs`; without `export`, cannot use its export action.
- `/administration/audit` is completely unaffected — still the same Super-Admin
  `ComingSoon` stub, not modified by this spec.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/settings/audit-logs` appears in the build route table.

Feature-spec 80 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #78.

---

## v3 Relationship Note — Spec 93 (Universal Audit Trail)

v3 spec 93 (`context-v3/feature-specs/93-universal-audit-trail.md`) extends the audit
trail significantly beyond this spec's scope. The two specs are **additive, not
conflicting** — this spec (80) is the foundation; spec 93 builds on top of it:

| This spec (80) | v3 spec 93 |
|---|---|
| Retrofits 10 existing voucher/document post/cancel call sites | Retrofits ALL ~50 service write methods |
| Adds `DOCUMENT_POSTED` / `DOCUMENT_CANCELLED` event types | Adds `CREATED`, `UPDATED`, `CANCELLED`, `POSTED`, `DELETED` generically |
| Adds `createdBy`/`updatedBy` to nothing | Adds `createdBy`/`updatedBy` to **all** business model tables |
| Introduces `audit` permission module + Company-scoped UI | Keeps the same UI, no duplicate screen |

**Implementation order:** This spec (80) must be implemented before v3 spec 93.
Spec 93 explicitly builds on this spec's `auditLogService.record()` call-site pattern
(which it names `recordDocumentAuditEvent` here) and extends it to all service writes.

**No conflict in `AuditLog` schema:** both specs use the same existing `AuditLog` model
and `auditLogService.record()` function — no second model, no schema change.

**After v3 spec 93 is implemented:** the "Deferred v2 items" in the Do Not section
(master-level create/edit events, stock-movement events, GST return events) are all
covered by v3 spec 93's universal retrofit. No separate follow-up spec is needed for them.

## v4 Relationship Note

In v4, each microservice writes its own audit events to the central `AuditLog` service
(or a dedicated Audit microservice, per v4 spec 136 — Observability). The v3 pattern of
calling `auditLogService.record()` from each service is unchanged at the interface level
— only the transport changes (direct call → Kafka event → Audit service consumer).
