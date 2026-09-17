# Codebase Map — Milestone v2 State

This file documents what actually exists in `src/` as of the Milestone v2 completion
audit. It is a snapshot — update it whenever a significant structural change is made.

---

## Top-Level `src/` Structure

```
src/
├── app/                         ← Next.js App Router pages and route handlers
├── components/                  ← Shared React components
├── config/                      ← App configuration (app-settings.ts, navigation.ts)
├── constants/                   ← Enums, cookie keys, static values
├── engines/                     ← Business logic engines (shared by modules)
├── lib/                         ← Infrastructure utilities
├── modules/                     ← Feature modules (50 modules)
├── types/                       ← TypeScript type definitions
├── middleware.ts                 ← Does NOT exist — replaced by src/proxy.ts
└── proxy.ts                     ← Next.js middleware (renamed in Next.js 16)
```

---

## Engines (`src/engines/`)

| Engine | Directory | Purpose |
|---|---|---|
| Document Number | `src/engines/document-number/` | Auto-numbering for invoices, vouchers |
| GST | `src/engines/gst/` | GST calculation, line-level tax breakdown |
| Inventory | `src/engines/inventory/` | Stock transactions, costing |
| Pricing | `src/engines/pricing/` | Price list, margin, discount application |
| Reporting | `src/engines/reporting/` | Report data aggregation |
| Voucher | `src/engines/voucher/` | Double-entry ledger posting |

**Missing engine (planned in v3):**
- `src/engines/external-integrations/` — does NOT exist yet (needed by specs 94/95)

---

## Infrastructure (`src/lib/`)

| File | Purpose | Known Issues |
|---|---|---|
| `prisma.ts` | Global `PrismaClient` singleton via `globalForPrisma` | **BLOCKER** — singleton incompatible with v4 per-tenant model. See FX-01. |
| `system-context.ts` | `SystemContext` type + `resolveSystemContext()` | **HIGH** — function is named `resolveSystemContext()`, not `getSystemContext()` — spec 105 refers to `getSystemContext()`. See FX-08. |
| `current-user.ts` | `getCurrentUser()`, `getCurrentCompanyUser()`, etc. | Still the primary auth helper for ~114 files |
| `current-company.ts` | `getCurrentCompany()` | Auth helper (indirect legacy) |
| `current-financial-year.ts` | `getCurrentFinancialYear()` | Auth helper (indirect legacy) |
| `session.ts` | `getSessionWithUser()`, `renewSession()` | Cookie-based session |
| `permissions.ts` | `assertPermission()` | Role-based permission check |
| `app-error.ts` | `AppError`, typed error base class | OK |
| `prisma-errors.ts` | `isUniqueConstraintError()` etc. | OK |
| `transaction.ts` | `runInTransaction()` | OK |
| `password.ts` | `hashPassword()` | OK |

---

## Configuration (`src/config/`)

| File | Purpose |
|---|---|
| `app-settings.ts` | App name, version, Electron config |
| `navigation.ts` | Navigation menu structure |

**Missing config files (needed by v3 specs):**
- `src/config/rate-limits.ts` — does NOT exist (needed by spec 100)
- `src/config/env.ts` — does NOT exist (needed by spec 101 / health endpoints)

---

## Middleware (`src/proxy.ts`)

The Next.js middleware file. In this app it is named `proxy.ts` (Next.js 16 convention).

**Current responsibilities:**
- Cookie-based session validation (`getSessionWithUser`)
- Route access control (PUBLIC_ROUTES, PLATFORM_ALLOWED_PREFIXES)
- Session renewal (`renewSession`)
- Stale auth cookie cleanup

**Missing features:**
- No rate limiting (spec 100 adds this)
- No health endpoint bypass (spec 110a adds this)

---

## Modules (`src/modules/`) — 50 modules

| Category | Modules |
|---|---|
| Auth / Users | `users/`, `profile/`, `roles/` |
| Company | `company/`, `branch/`, `financial-year/` |
| Masters | `ledgers/`, `ledger-groups/`, `categories/`, `brands/`, `units/`, `gst-rates/`, `hsn-codes/`, `products/`, `customers/`, `suppliers/`, `warehouses/`, `bank-accounts/`, `payment-modes/`, `margin-profiles/`, `price-lists/` |
| Sales | `sales-invoices/`, `sales-orders/`, `sales-returns/`, `delivery-challans/`, `quotations/` |
| Purchase | `purchase-invoices/`, `purchase-orders/`, `purchase-returns/`, `goods-receipt-notes/` |
| Inventory | `stock-adjustments/`, `stock-transfers/`, `physical-verifications/`, `opening-stock/`, `product-batches/`, `serial-numbers/` |
| Accounting | `manual-vouchers/`, `liability-settlement/` |
| GST | `gst/` |
| HR / Payroll | `employees/`, `attendance/`, `payroll/` |
| Administration | `administration/` |
| Reports | `reports/`, `dashboard/` |
| Document Numbers | `document-sequences/` |

### Auth/Context Usage in Modules

**Modules that import `getCurrentCompanyUser`, `getCurrentUser`, or `getCurrentSuperAdmin`
directly from `src/lib/current-user.ts`:** 114 files (services + actions + tests)
identified by grep. All are legacy pattern; see FX-02 for the retrofit plan.

---

## Schema (`prisma/schema.prisma`)

Key models present as of v2:

| Model | Domain | Notes |
|---|---|---|
| User | Auth | Has `companyId?` and `roleId?` — direct FK (not via join table) |
| Session | Auth | |
| Company | Company | Root tenant anchor |
| CompanySettings | Company | Settings + tax config |
| FinancialYear | Company | |
| Branch | Company | |
| Role | Masters | Company-scoped |
| Permission | Masters | |
| RolePermission | Masters | |
| Ledger | Masters | |
| LedgerGroup | Masters | |
| Product | Masters | |
| ProductCategory | Masters | |
| Unit | Masters | |
| Tax / TaxRate | Masters | |
| Warehouse | Masters | |
| Customer | Masters | |
| Supplier | Masters | |
| SalesInvoice | Sales | |
| SalesOrder | Sales | |
| SalesReturn | Sales | |
| DeliveryChallan | Sales | |
| PurchaseInvoice | Purchase | |
| PurchaseOrder | Purchase | |
| PurchaseReturn | Purchase | |
| GoodsReceiptNote | Purchase | |
| StockTransaction | Inventory | |
| StockAdjustment | Inventory | |
| StockTransfer | Inventory | |
| Voucher | Accounting | |
| VoucherEntry | Accounting | |
| VoucherType | Accounting | Has `SALARY` enum value (payroll partially exists) |
| Employee | HR | |
| PayrollPeriod | HR | |
| PayslipEntry | HR | |
| AuditLog | Platform | 5-event platform audit only |

**Not yet present (planned in v3):**
- `CompanyUser` join table (spec 99)
- `SerialNumber` tracking model (spec 91 — may already exist, verify)
- `EWayBill` (spec 95)
- `CostLayer` / FIFO models (spec 98)
