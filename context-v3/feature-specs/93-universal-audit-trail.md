# 93 - Universal Audit Trail

> Feature-spec file number 93 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 2 — Compliance &
> Commercial**, tracker item **#84 Universal Audit Trail**.
>
> This spec retrofits the existing narrow `AuditLog` model (which records only 5
> Super Admin lifecycle events) to cover every Company-side business-module write.
>
> Depends On: All v2 business modules (this is a cross-cutting retrofit).
> Must be implemented first in Phase 2 — its `createdBy`/`updatedBy` migration
> is required by all subsequent Phase 2 features.

## Goal

Retrofit the `AuditLog` model and add `createdBy` / `updatedBy` columns to every
business table so that the system can answer:

- Who created this voucher?
- Who posted this Sales Invoice?
- Who adjusted stock?
- Who changed a customer's credit limit?

Every service write (create/update/post/cancel/delete/activate/deactivate) records
the actor, the target, and metadata. The audit trail is visible in the
Administration panel at `/administration/audit-logs`.

---

## Project Context

Read before implementation:

1. `context/architecture-context.md` (v2) — Known Implementation Gaps items 3 and 4:
   the narrow audit log and missing `createdBy`/`updatedBy`.
2. `context-v3/architecture-context.md` — Decision 1 (Universal Audit Trail).
3. `context-v3/code-standards.md` — Audit Trail Standards section.
4. `context/feature-specs/18-super-admin-company-lifecycle.md` — existing
   `AuditLog` model; the 5 events already recorded remain unchanged.
5. `src/modules/administration/services/audit-log-service.ts` — the existing
   `auditLogService.record()` — this spec extends its usage, never replaces it.

---

## Module Responsibilities

1. **Schema migration**: add `createdBy String?` and `updatedBy String?` to all 27
   business tables listed below.
2. **AuditLog model**: confirm the existing model covers all fields needed; add
   `changedFields Json?` for UPDATED events.
3. **`auditLogService.record()`**: extend to accept all new event types.
4. **Service retrofit**: add `auditLogService.record()` calls to every service method
   that writes a business record.
5. **Audit Log UI**: `/administration/audit-logs` — list with company/actor/date/type
   filters, paginated.

---

## Data Model

### Tables Requiring `createdBy` / `updatedBy`

Every table below gains `createdBy String?` and `updatedBy String?`:

Accounting: `Voucher`, `VoucherEntry`, `Ledger`, `LedgerGroup`, `BankAccount`
Sales: `SalesInvoice`, `SalesInvoiceItem`, `SalesReturn`, `CreditNote`, `DebitNote`
Sales workflow: `Quotation`, `SalesOrder`, `DeliveryChallan`
Purchase: `PurchaseInvoice`, `PurchaseReturn`, `PurchaseOrder`, `GoodsReceiptNote`
Inventory: `StockTransaction`, `StockAdjustment`, `StockTransfer`, `PhysicalVerification`
Masters: `Customer`, `Supplier`, `Product`, `Employee`
Settings: `CompanySettings`, `PaymentMode`
GST: `GstFilingRecord`
HR: `PayrollRun`

### AuditLog Model Amendment

```prisma
model AuditLog {
  id           String   @id @default(uuid())
  companyId    String?
  actorUserId  String
  action       AuditAction
  targetType   String
  targetId     String
  metadata     Json?
  changedFields Json?   // NEW: {field: [oldValue, newValue]} for UPDATED events
  ipAddress    String?  // NEW: for security audit purposes
  createdAt    DateTime @default(now())

  company Company? @relation(...)
  actor   User     @relation(...)
}

enum AuditAction {
  CREATED
  UPDATED
  POSTED
  CANCELLED
  DELETED
  ACTIVATED
  DEACTIVATED
  // Existing Platform events (unchanged):
  COMPANY_CREATED
  COMPANY_ADMIN_CREATED
  COMPANY_ACTIVATED
  COMPANY_DEACTIVATED
  COMPANY_ADMIN_PASSWORD_RESET
}
```

---

## Business Rules

1. Every create/update/post/cancel/activate/deactivate service call writes one
   `AuditLog` record — inside the same database transaction.
2. `AuditLog` is append-only — never updated or deleted.
3. `metadata` contains human-readable identifying fields only (e.g., `invoiceNumber`,
   `customerName`) — never serialized full entities.
4. `changedFields` for UPDATED events records `{ fieldName: [previousValue, newValue] }`
   for the fields that changed — only scalar fields (no nested objects).
5. `actorUserId` is always taken from `SystemContext` — never from client input.
6. `createdBy` on business tables is set at record creation and never changed.
7. `updatedBy` is set on every update.

---

## Validation Rules

- `auditLogService.record()` silently drops and logs a Pino warning if `actorUserId`
  is missing (can happen for system-initiated writes) — never throws.
- `targetType` must be a valid Prisma model name (validated against a hardcoded allow-list
  in `auditLogService` to prevent injection).

---

## API / Server Actions

- `auditLogActions.listAuditLogs(companyId, filters)` — paginated, filterable by
  actorUserId, targetType, action, dateRange
- `auditLogActions.getAuditLogEntry(id)` — single entry detail

---

## UI

### Audit Logs Page (`/administration/audit-logs`)
- Access: Super Admin only (or Company Admin for their own company's logs)
- Filters: date range, actor (user picker), target type, action
- Table: date/time, actor name, action badge, target type, target ID/number,
  metadata summary
- Click to expand: full metadata and changedFields JSON viewer

---

## Security Considerations

- Super Admin sees all companies' audit logs on the Administration panel.
- Company Admin sees only their own company's logs.
- Audit log entries are never exposed via Company-side API without `companyId` scoping.
- `ipAddress` is recorded from the Next.js request headers — `x-forwarded-for` or
  the direct remote address.

---

## Testing Requirements

- At least one test per service asserting an `AuditLog` record is written on each
  CREATED / POSTED / CANCELLED event.
- Test that `createdBy` is set on insert and `updatedBy` is updated on subsequent writes.
- Test that `changedFields` captures correct old/new values for UPDATED events.
- Test that a write failure does not produce an orphan audit log (same transaction).
- Cross-company isolation: Company Admin cannot see another company's audit entries.
