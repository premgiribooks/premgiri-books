# 76 - Excel Import

> Feature-spec file number 76 (spec-file numbers are sequential and never reused — the
> highest prior file was `75-global-search.md`, drafted in this same batch). This feature
> is `context/Phases/phase-tracker.md`'s **Phase 11 — Productivity Features** item **#74
> Excel Import**. Depends on Masters (Product Management #23, Customer Management #24,
> Supplier Management #25 — all implemented). Documentation only, drafted 2026-09-11 —
> nothing in this spec is implemented yet. **Read `77-excel-export.md` before
> implementing** — this spec's template-download step reuses that spec's shared Excel-
> writing utility rather than introducing a second one.

## Goal

Implement **Excel Import** for **Premgiri Books ERP** — bulk create (and update, for a
row that matches an existing record by its natural key) of master records from an
uploaded `.xlsx`/`.csv` file, for the one scenario every ERP onboarding hits on day one:
a business migrating from a legacy system or a spreadsheet has hundreds of Products/
Customers/Suppliers to enter, and typing each one by hand through the existing Create
form is real, avoidable cost. This spec is a **bulk front door to each target master's own
existing create path** — it introduces no parallel validation, no parallel business
rules, and no new way for a row to become an invalid Product/Customer/Supplier that the
existing single-record Create screen would have rejected.

**Scope decision, stated up front — which masters are in v1.** `code-standards.md`/
`architecture-context.md` list many masters (Customers, Suppliers, Products, Categories,
Brands, Units, Warehouses, HSN Codes, GST Rates, Price Lists, Margin Profiles). This spec
scopes v1 to the three highest-volume, highest-value bulk-entry masters: **Products,
Customers, Suppliers** — the three a business migrating in typically has hundreds of, and
the three that already expose a `search`-capable list method and a stable, well-
documented Zod create schema (specs 25, 26, 27) this feature reuses verbatim. Categories/
Brands/Units/Warehouses/HSN Codes/GST Rates are typically a handful of rows a business
sets up once, by hand, during initial configuration — bulk-importing a dozen categories
saves negligible time compared to the validation-and-template-design cost of adding a
fourth/fifth/sixth target type today (YAGNI, `code-standards.md`). The import pipeline
this spec builds is **generic and target-parameterized** by design (see Service /
Repository), so adding a fourth target later is a small, mechanical extension — not a
rewrite — once a real business need for bulk-importing one of those smaller masters
surfaces.

**The one real business-rule exposure in this batch, and its resolution.** Unlike Global
Search or Excel Export (both purely read-only/presentational), a bad bulk import has real
cleanup cost: this codebase has no hard delete for masters (Activate/Deactivate only, per
the research brief's ground-truth facts), so 500 badly-imported products become 500 rows
someone must manually deactivate one by one. This spec's design directly answers the two
open questions the research brief calls out:

1. **Row validation must reuse the target master's own Zod schema and company-scoping —
   never a parallel, looser validation path.** Every imported row is run through the
   *exact same* `productSchema`/`customerSchema`/`supplierSchema` (specs 25/26/27) and
   the *exact same* `productService.createProduct`/`customerService.createCustomer`/
   `supplierService.createSupplier` call a human filling out the Create form would
   trigger — this feature only gets the data *into* that shape (resolving natural-key
   columns like a Category/Brand/Unit code into their internal ids, since a spreadsheet
   cannot carry a Prisma UUID — see Business Rules), it never re-implements or loosens
   any rule the target module already enforces.
2. **Partial-success handling: row-by-row, not all-or-nothing — decided and justified
   below.**

---

# Project Context

Before implementation, review

- `25-product-management.md`, `26-customer-management.md`, `27-supplier-management.md`
  (**read all three in full**) — each module's exact Zod create schema, its `create`
  service method's signature and side effects (Customer/Supplier creation also creates
  the backing `Ledger` row per those specs — this feature must call the *service* method,
  never construct a `Ledger` row itself), and its own `search`/`list` filter shape (reused
  by the dry-run duplicate-detection step below)
- `77-excel-export.md` (**read before implementing**) — this spec's Template Download and
  Error Report Download both reuse that spec's shared `src/lib/excel-export.ts` utility;
  do not introduce a second Excel-writing code path
- `ai-workflow-rules.md` Database Workflow ("avoid duplicate tables… prefer extending
  existing entities") and Engine Usage Rules ("Business logic must never be duplicated")
  — the exact rules this spec's "reuse the target's own schema/service" design follows
- `code-standards.md` Financial Rules/Inventory Rules are **not** engaged by this spec at
  all — Products/Customers/Suppliers are masters, not financial documents; nothing this
  spec creates ever touches `Voucher`/`StockTransaction` directly (a bulk-imported
  Product's `openingStock`, if any, still must go through Opening Stock, `46-opening-
  stock.md`, exactly as a manually-created product would — this spec does not shortcut
  that rule for imported rows)

---

# Module Responsibilities

The Excel Import module is responsible for

- Accepting an uploaded `.xlsx`/`.csv` file for one target master (Products, Customers,
  or Suppliers, chosen by the user before uploading)
- Parsing the file into rows, resolving each row's natural-key columns (Category/Brand/
  Unit/HSN/GST-Rate codes for Products; nothing beyond direct fields for Customers/
  Suppliers) into the internal ids the target's own create schema expects
  ("Resolution," see Business Rules)
- A **dry-run/preview step**: validating every row (via the target's own Zod schema, once
  natural keys are resolved) **without writing anything**, showing the user a per-row
  pass/fail preview before any commit
- A **commit step**: creating each still-valid row, one at a time, through the target
  module's own existing `create` service method, producing a final per-row success/error
  report
- A downloadable **import template** (`.xlsx`, exact importable columns for the chosen
  target) and a downloadable **error report** (the failed rows, with reasons, in the same
  template shape, ready to fix and re-upload)

The Excel Import module is **not** responsible for

- Any new business rule, validation, or company-scoping logic beyond what the target
  module's own schema/service already enforces (see Goal)
- Updating a target module's own create/edit behavior — this spec is a caller of that
  behavior, never a modifier of it
- Importing Categories, Brands, Units, Warehouses, HSN Codes, GST Rates, Price Lists, or
  Margin Profiles (deferred — see Goal's scope decision)
- Excel *export* mechanics (`77-excel-export.md`'s job; this spec only *consumes* its
  shared writer for the template/error-report downloads)
- Recording a persisted, queryable history of past import runs (see Data Model — a
  deliberate, recorded omission, not a silent one)

---

# Data Model

**No new Prisma model, enum, or migration.** An import run's outcome (which rows
succeeded, which failed and why) is computed and returned to the client within a single
request/response cycle (upload → preview → confirm → report) — it is never persisted as
a queryable history. This is a deliberate scope decision, not an oversight: nothing in
this batch's tracker item or in `architecture-context.md` calls for a "view past imports"
screen, and `code-standards.md`'s Logging section already requires "Data Import" to be
logged (via Pino, this codebase's existing logger, per `architecture-context.md`'s
Technology Stack) — which captures the operational audit trail (who imported what, how
many rows, when) without a new table. **If a future requirement asks for queryable import
history** (e.g. "show me every import run from the last 90 days"), that is a genuinely new
persisted `ImportBatch`/`ImportRow` model and its own scoped feature spec — not silently
introduced here.

Every row this spec creates lands in the target's own existing table (`Product`,
`Customer`+`Ledger`, `Supplier`+`Ledger`) exactly as a manually-created row would — no new
column is added to any of those tables for import provenance in v1 (a future
`importBatchId` column is a natural, separately-justified extension if history tracking
is added later).

---

# Business Rules

## Resolution (natural keys → internal ids)

A spreadsheet cannot carry a Prisma UUID a human never sees. Each target's importable
columns therefore include **natural-key columns** the target's own schema does not
itself accept directly — this spec resolves them to ids *before* invoking the target
schema/service, so the schema/service boundary itself never changes:

- **Products**: `categoryCode`, `brandCode`, `unitCode`, `hsnCode`, `warehouseCode`
  (matching each master's own existing unique code/name field) resolved via that
  master's own existing repository lookup (`categoryRepository.findByCode`, etc. —
  confirm exact method names per each spec at implementation time; add a `findByCode`
  read method only where one does not already exist, never a duplicate of an existing
  one). An unresolvable code (typo, wrong case, belongs to another company) is a
  **row-level validation failure**, reported exactly like a Zod failure — never silently
  defaulted or skipped.
- **Customers/Suppliers**: no natural-key resolution needed beyond the row's own direct
  fields (name, mobile, GSTIN, address, credit terms, opening balance) — these two
  targets' own create schemas already accept plain scalar fields only.
- Resolution runs **before** the target's Zod schema, using the *same company-scoped*
  lookup every other read in this codebase uses (never a cross-company match) — the
  resolved input object handed to the schema/service is indistinguishable from one a
  human typed into the existing Create form.

## Partial-success handling — row-by-row, not all-or-nothing

**Decision: each row is created independently, in its own attempt; one bad row never
discards the batch.** Reasoning:

- Unlike a `Voucher`'s entries (which represent *one* accounting event and must be
  atomic — spec 31's "sum(Debit) === sum(Credit)" balance rule has no meaning applied to
  half a voucher), 500 imported product rows are **500 independent business events**
  with no relationship to one another. An all-or-nothing transaction wrapping the whole
  file means a single duplicate SKU on row 437 silently discards 499 good rows the user
  already reviewed and approved — a strictly worse outcome for the exact "large file,
  one bad row" scenario the research brief calls out, and inconsistent with how this
  codebase treats every other independent-row operation (Product/Customer/Supplier list
  screens create one record at a time already; there is no existing precedent in this
  codebase for batching independent master rows into one transaction).
- Row-by-row does **not** mean "no transaction at all" — each individual row's own
  creation still runs through the target's own `create` service method exactly as built,
  which already wraps its own Customer/Supplier-plus-Ledger creation in one atomic
  transaction per spec 26/27 (a single row is never left half-created; only the *batch*
  is non-atomic across rows, by design).
- The **two-phase preview-before-commit flow is what prevents "inconsistent partial
  state without a clear report"** (the research brief's stated risk): phase one (dry
  run) validates every row and shows the user exactly which rows will fail *before any
  write happens at all* — a user can fix the source file and re-upload before committing
  anything. Phase two (commit) then creates only the rows still marked valid at commit
  time (a row could still fail at commit — e.g. a concurrent duplicate created by another
  user between preview and commit — this is re-validated, not assumed unchanged), and
  produces a final **Import Report**: `{ rowNumber, status: "created" | "failed", error?:
  string, recordId?: string }[]`, downloadable as an `.xlsx` (via the shared Excel Export
  utility) in the same column shape as the original template, so the failed rows can be
  corrected and re-uploaded directly without hand-editing row numbers back in.
- **A hard cap of 1,000 rows per file** in v1 (rejected at upload time with a clear
  message above the cap) — keeps the whole upload → preview → commit cycle synchronous
  within one request/response cycle (no background job queue exists in this codebase;
  introducing one for this feature alone would be disproportionate — YAGNI). A business
  migrating more than 1,000 rows of one master splits the source file, a reasonable and
  clearly-documented limitation, not a silent truncation.

## Company-scoping and permissions

- Every created row is scoped to the requesting user's own company — exactly as the
  target service's own `create` method already resolves `companyId` from the session;
  this spec never reads or writes a client-supplied company id anywhere, including
  inside the uploaded file (a `companyId` column, if present in an uploaded file, is
  ignored entirely, never trusted).
- Gated by each target module's own **`create`** permission action (`masters:create`) —
  **not a new "import" permission action.** `PERMISSION_ACTIONS` is a fixed, shared enum
  (`view, create, edit, delete, approve, export`); bulk-creating 500 rows is still,
  semantically, `create` — the same action a single manual Create already requires. No
  new permission module or action is introduced.

---

# Service / Repository

**Create** (a new shared module — the pipeline is target-parameterized, not one module
per target):

```text
src/modules/bulk-import/services/bulk-import-service.ts
src/modules/bulk-import/validation/bulk-import-schema.ts
src/modules/bulk-import/actions/bulk-import-actions.ts
src/modules/bulk-import/components/…
src/modules/bulk-import/targets/product-import-target.ts
src/modules/bulk-import/targets/customer-import-target.ts
src/modules/bulk-import/targets/supplier-import-target.ts
src/types/bulk-import.ts
```

- **No repository of its own** — every write goes through the target module's own
  existing service (`productService.createProduct`, `customerService.createCustomer`,
  `supplierService.createSupplier`); every read (natural-key resolution, duplicate
  pre-check) goes through the target module's own existing repository/service, never a
  new Prisma query against another module's table.
- An `ImportTarget` interface (`src/types/bulk-import.ts`) each of the three
  `*-import-target.ts` files implements: `{ key: "products" | "customers" | "suppliers";
  columns: ImportColumn[]; resolveRow(rawRow, companyId): Promise<ResolvedRowResult>;
  createRow(resolvedInput): Promise<{ id: string }> }` — `resolveRow` does natural-key
  lookup + Zod-schema parse (returning either a resolved, schema-valid input or a
  row-level error list), `createRow` is a **thin pass-through** to the target's own
  existing `create` service method (never a duplicate implementation).
- `bulkImportService.parseFile(target, file)` — parses `.xlsx`/`.csv` into raw rows
  (via the shared library, see UI/library choice), enforces the 1,000-row cap.
- `bulkImportService.previewImport(target, rows, companyId)` — calls each row through
  `resolveRow`, returns the per-row preview (valid/invalid + reasons) with **zero
  writes**.
- `bulkImportService.commitImport(target, validRows, companyId)` — calls each still-valid
  row through `createRow` **one at a time** (never inside a shared cross-row
  transaction, per the Business Rules decision above), collecting the final Import
  Report; a single row's own failure never aborts the remaining rows.
- `bulkImportService.buildTemplate(target)` — returns the target's `columns` definition
  to the shared Excel Export utility (`77-excel-export.md`) to produce a downloadable
  blank `.xlsx` template with the exact importable columns as headers (including the
  natural-key columns from Resolution above) — **no separate template-writing code path**
  is introduced here.
- `bulkImportService.buildErrorReport(target, report)` — same shared utility, producing
  the downloadable failed-rows `.xlsx`.

---

# Validation

Zod (`bulk-import-schema.ts`): `target` enum (`"products" | "customers" | "suppliers"`),
file MIME-type/extension check (`.xlsx` or `.csv` only, rejected otherwise with a clear
message), row-count cap (1,000) enforced after parsing, before any resolution/validation
work begins (fail fast, per `code-standards.md`'s Input Validation rule). **Per-row
validation is entirely delegated to the target's own existing Zod schema** once natural
keys are resolved — this spec's own schema file validates only the *upload request
shape* (which target, which file), never re-expresses a single target field's own rules
(never a parallel, looser `z.string()` where the target's own schema has a stricter
`z.string().regex(gstinPattern)`, for example).

---

# UI

Pages (a shared, target-parameterized wizard — mirroring the manual-voucher module's
`ManualVoucherForm` precedent, spec 52/55, of one shared component over near-identical
per-target instances rather than three near-duplicate screens)

- `/masters/products/import`, `/masters/customers/import`, `/masters/suppliers/import` —
  each a thin route rendering `<BulkImportWizard target="products" | "customers" |
  "suppliers" />`, reached via a new "Import" button on each target's own existing list
  screen (alongside the existing "New" button)
- Wizard steps: **1. Choose file** (with a "Download Template" link using
  `bulkImportService.buildTemplate`) → **2. Preview** (a table of every parsed row,
  valid rows shown normally, invalid rows highlighted with their specific error(s); a
  running "N valid / M invalid" summary; the user may proceed with only the valid rows,
  or cancel and re-upload a corrected file) → **3. Commit** (creates every still-valid
  row, shows a progress indicator for a large batch) → **4. Report** (final per-row
  outcome, with a "Download Error Report" link for any failed rows, using
  `bulkImportService.buildErrorReport`).

Components (`src/modules/bulk-import/components/`): `BulkImportWizard` (the shared,
target-parameterized step shell), `ImportPreviewTable`, `ImportReportTable`, a thin
`ImportFileDropzone`.

Wire-up

- Add an "Import" action/button to `/masters/products`, `/masters/customers`, and
  `/masters/suppliers`' existing list screens.
- Add `"masters/products/import"`, `"masters/customers/import"`,
  `"masters/suppliers/import"`-style keys (or the single bare `import: "Import"` segment
  if it is not reused ambiguously elsewhere — confirm against `breadcrumbs.ts`'s existing
  keys at implementation time, using the documented `"parent/segment"` disambiguation
  form only if a collision exists) to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `masters` permission module's existing **`create`** action for every target
in this batch (`masters:create`) — no new permission module or action (per the research
brief's explicit instruction: `PERMISSION_ACTIONS` is fixed; bulk-creating rows is still
`create`). Template download requires only `masters:view` (reading the column shape is
not itself a write). Every write is company-scoped through the requesting user's own
session, identical posture to every other spec in this project; no uploaded file column
is ever trusted for `companyId` or any other cross-tenant field.

---

# Database

No new model, enum, or migration. See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, zero parallel validation logic (every row's business rules
are enforced by the target module's own existing Zod schema and service — this module
only resolves natural keys and orchestrates the two-phase flow), vitest coverage for:

- `resolveRow` correctly resolves valid natural-key codes and rejects unresolvable ones
  per target (Products: category/brand/unit/HSN/warehouse code; Customers/Suppliers: no
  resolution needed, direct schema validation only)
- `previewImport` performs zero writes (a spy/mock on the target's `createRow` never
  fires during preview) and correctly separates valid/invalid rows with per-row reasons
- `commitImport` creates every valid row independently — a failure on one row (simulated
  duplicate/constraint violation) does not prevent subsequent valid rows from being
  created, and the final report correctly attributes success/failure per row
- The 1,000-row cap rejects an oversized file before any resolution work begins
- Cross-company isolation: a natural-key code belonging to another company never
  resolves (Category/Brand/Unit/HSN/Warehouse lookups are company-scoped identically to
  every other read in this codebase)
- Template and error-report generation produce the exact column set the target's
  `ImportTarget.columns` declares (a structural/shape test against the shared Excel
  Export utility's own contract, not a re-implementation of it)

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration (including a persisted import-history model —
  see Data Model's recorded, deliberate omission)
- A parallel or looser validation path for any target field — every rule lives in the
  target module's own existing Zod schema, always
- A new "import" permission action — bulk creation is gated by the existing `create`
  action on the target's own module
- Importing Categories, Brands, Units, Warehouses, HSN Codes, GST Rates, Price Lists, or
  Margin Profiles (deferred — see Goal)
- An all-or-nothing cross-row transaction (see Business Rules' partial-success decision)
- A background job queue or async processing of any kind — the whole flow is synchronous
  within one request/response cycle, bounded by the 1,000-row cap
- A second Excel-writing code path — Template Download and Error Report Download both go
  through `77-excel-export.md`'s shared utility

---

# Success Criteria

Verify

- A user can download a target-specific template, fill it with valid and deliberately
  invalid rows (e.g. a duplicate SKU, an unresolvable category code), upload it, and see
  an accurate per-row preview before anything is written.
- Committing an import creates every valid row through the target's own existing
  `create` service method (confirmed identical in effect to a manually-created record —
  same validation, same company-scoping, same Ledger-creation side effect for Customer/
  Supplier) and produces a downloadable error report for any rows that failed at commit
  time, without discarding the rows that succeeded.
- A file exceeding 1,000 rows is rejected before any row is processed.
- No new permission action exists; the feature is gated entirely by each target's
  existing `masters:create`/`masters:view`.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/masters/products/import`, `/masters/customers/import`, and
  `/masters/suppliers/import` all appear in the build route table.

Feature-spec 76 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #74.
Feature-spec 77 (Excel Export, tracker #75) provides the shared Excel-writing utility this
spec's Template Download and Error Report Download both consume.
