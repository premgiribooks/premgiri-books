# 79 - Barcode Billing

> Feature-spec file number 79 (spec-file numbers are sequential and never reused; the
> highest prior file was `74-gst-reports.md` — files 75–78 belong to the four sibling
> Phase 11 specs (Global Search, Excel Import, Excel Export, PDF Generation) a teammate is
> drafting concurrently). This feature is `context/Phases/phase-tracker.md`'s **Phase 11 —
> Productivity Features** item **#77 Barcode Billing**, `Depends On: Sales`. Depends on
> Product Management (feature-spec 25, implemented — `Product.barcode`) and Sales Invoice
> (feature-spec 38, implemented) — both consumed as-is, **no engine changes, no new
> Prisma model, no migration**.

**Stale tracker-number note**: `prisma/schema.prisma`'s own `Product` model comment (near
`ProductType`) reads `"...Barcode Billing #76)"`. That is a **stale** reference left over
from before Phase 6 — Product Detail Page was inserted 2026-09-11, which shifted every
Phase 6+ tracker number up by one (`context/Phases/phase-tracker.md`'s own note under
Phase 6: "old #50–#78 are now #51–#79"). The current, correct tracker number for this
feature is **#77**, as used throughout this spec and in the table at the top of the
drafting task. The schema comment itself is not being touched by this spec (documentation
only, no `schema.prisma` edits) — a future pass that does touch that file's comments
should correct it in passing.

## Goal

Add a **barcode-driven fast-entry input** to the Sales Invoice line-item entry screen
(feature-spec 38) that resolves a scanned or typed barcode to an active,
company-owned `Product` (feature-spec 25's already-stored, optional, per-company-unique
`Product.barcode` field) and adds — or increments — a line in the exact same
`lines` array the existing manual "select a product from the dropdown" path already
populates. This is a **UI/workflow feature over existing data**: no new Prisma model, no
new document type, no new calculation path. Barcode entry is purely an alternate *input
method* into Sales Invoice's existing line-item flow; pricing, tax, and stock continue to
be delegated exactly as they are today (Invariants 6/7/8 — Pricing Engine, Inventory
Engine, GST Engine).

---

# Project Context

Before implementation, review

- `25-product-management.md` (`Product.barcode` — optional, unique per company when
  present, "stored now so Barcode Billing has data to build on; no scanning/printing in
  this task" — this spec is exactly that follow-up; the field, its uniqueness
  constraint, and its 4–50-character validation bounds already exist unchanged)
- `38-sales-invoice.md` (**read the Module Responsibilities' "Not responsible for" list
  and the Do Not section carefully**: both explicitly name "the dedicated keyboard-first
  Billing Screen (`ui-context.md`'s Billing Screen is a future performance-optimized
  surface)" and "barcode scanning UX (`phase-tracker.md` #76 [now #77])" as things Sales
  Invoice's own spec deliberately deferred — this spec is that deferred work, scoped as an
  **addition to the existing Sales Invoice entry screen**, not a build-out of that
  separate future Billing Screen; see the UI section below for why)
- The actual line-entry components read for this spec:
  `src/modules/sales-invoices/components/sales-invoice-line-editor.tsx` (the
  `useFieldArray`-backed `lines` table; `append(BLANK_LINE)`/`remove(index)`) and
  `sales-invoice-line-row.tsx` (`handleProductChange` — on a manual dropdown selection via
  `ProductOptionSelector`, it sets `lines.${index}.productId`, then calls the existing
  `resolveLinePriceAction({ productId, quantity, customerId, asOfDate })` Server Action and
  writes the returned price into `lines.${index}.rate`). **This is the exact mechanism
  barcode resolution must feed into** — a scanned barcode ultimately produces a
  `productId`, and that `productId` is handed to the identical `handleProductChange`-shaped
  flow (append a new line or update an existing one, then call
  `resolveLinePriceAction`) rather than any parallel price/tax computation.
- `code-standards.md`'s UI Standards: "Support keyboard-first navigation" and "Minimize
  mouse dependency for billing screens" — the justification (see UI section) for adding a
  real, deliberate fast-entry mode rather than a single input-field tweak.

---

# Module Responsibilities

The Barcode Billing feature is responsible for

- A barcode/keyboard-wedge-scanner-friendly text input, toggle-able on the Sales Invoice
  Create/Edit-while-Draft screen, that resolves a scanned code to a product and adds/
  updates a line in the invoice's existing `lines` array
- Company-scoped, active-only, exact-match barcode → product resolution
- The no-match / inactive-product / duplicate-scan decision rules below

The Barcode Billing feature is **not** responsible for

- Any new document type, Prisma model, or migration (see Goal)
- Price, tax, or stock calculation of any kind — every resolved line is priced via the
  existing `resolveLinePriceAction` → Pricing Engine call, taxed via the existing GST
  Engine calls Sales Invoice already makes at posting time, and stocked via the existing
  Inventory Engine call at posting time; this feature only ever changes *how a line's
  `productId`/`quantity` get into the form*, never how they are subsequently priced/taxed/
  stocked
- Barcode **generation** or **printing** (label printing is a distinct, unbuilt future
  capability — this feature only ever reads the `barcode` string a product already has)
- Fuzzy, partial, or "starts with" barcode search — exact match only (see Business Rules)
- The dedicated keyboard-first Billing Screen named in `ui-context.md`/spec 38's Do Not —
  that remains separate, unbuilt, future work (see UI section)
- Wiring barcode entry into Purchase Invoice, Purchase Return, Sales Return, Credit Note,
  Debit Note, Stock Adjustment, Stock Transfer, or any other line-item screen — Sales
  Invoice only, per the tracker's `Depends On: Sales` and this spec's assigned scope; a
  future spec can extend the same underlying resolver to those screens without needing to
  redesign it, since the resolver itself is a plain Products-module service function, not
  Sales-Invoice-specific

---

# Data Model

**No new Prisma model, enum, field, or migration.** `Product.barcode` already exists
(feature-spec 25), already unique per company when present via
`@@unique([companyId, barcode])` — that same composite unique index is what makes an
exact-match lookup fast without adding a separate index. Nothing is added to
`schema.prisma`.

---

# Business Rules

- **Scanner input handling**: a plain, focused `<input type="text">` — no camera, no
  device/hardware barcode-scanning API. A USB/keyboard-wedge barcode scanner behaves
  exactly like a very fast typist: it emits the barcode's characters followed by an Enter
  keypress. The input listens for the Enter key (`onKeyDown`, `key === "Enter"`) to trigger
  resolution — not a debounced "type and wait" pattern, since a human accidentally typing
  a partial barcode into the same field must never trigger a spurious lookup mid-keystroke.
  After a successful resolution the input clears and **regains focus automatically**
  (mirrors a real billing counter: the operator never touches the mouse between scans),
  satisfying `code-standards.md`'s "Minimize mouse dependency for billing screens."
- **Resolution scope**: company-scoped (the requesting user's own active company, never a
  client-supplied id — Tenant Isolation Rule), **active products only**
  (`Product.isActive === true`), **exact match only** on the trimmed input string against
  `Product.barcode` — no case-folding beyond what Postgres's default collation already
  does, no partial/prefix/fuzzy matching, no matching against `productCode` or `name` as a
  fallback (a barcode scan is either a hit or a miss; falling back to a name search would
  reintroduce the same ambiguity this feature exists to avoid).
- **No match**: the scanned value matches no product (in any state) for this company.
  Rejected with a friendly, distinct message ("No product found for this barcode.") — the
  input clears and regains focus; no line is added or changed.
- **Inactive product match**: the scanned value matches a product that exists but is
  deactivated. Rejected with a **distinct** friendly message ("This product is inactive
  and cannot be billed.") rather than the generic no-match message — an operator scanning
  a discontinued item needs to know the difference between "wrong code" and "this item is
  no longer sellable," per Product Management's Activate/Deactivate lifecycle (spec 25).
  The input clears and regains focus; no line is added or changed.
- **Duplicate scan of the same product (increment, not a new line)**: if the invoice's
  `lines` array already contains a line whose `productId` matches the resolved product
  **and** whose `warehouseId` matches the warehouse that would be used for this scan (see
  the warehouse-defaulting rule below), that line's `quantity` is incremented by 1 (in the
  unit's own precision — always a whole-number increment regardless of `decimalPlaces`,
  since one scan always means "one more unit") rather than a new line being appended.
  **Decision and reasoning**: this mirrors how every real point-of-sale/billing counter
  behaves — scanning the same item twice means "two of these," not two separate rows for
  the same thing, and keeps the invoice readable when an operator scans quickly and
  imprecisely. A **different warehouse** is treated as a different line identity (see
  below), so it always gets its own row rather than being silently merged into an existing
  line for a different warehouse. A line that is part of a **locked** (Delivery-Challan-
  prefilled) invoice is never a target for either path — see UI below, the barcode input
  itself is disabled whenever the form is `locked`.
- **Warehouse defaulting for a new line**: barcode entry must still resolve a
  `warehouseId` (required per line, spec 38's schema) without forcing a manual pick on
  every single scan — that would defeat the point of fast entry. In order: (1) the
  resolved product's own `defaultWarehouseId` (spec 25), when set; else (2) the
  `warehouseId` of the invoice's own most-recently-added line, so a session of scanning
  many different products for the same counter/warehouse only ever needs one manual
  warehouse pick; else (3) — first line, product has no default warehouse — the new line
  is still added with `warehouseId` left unset, the input keeps focus, but a distinct
  inline warning is shown next to that line ("Select a warehouse for this line") since the
  invoice cannot be posted (or even fully priced/quantitied against stock rules) until
  every line's warehouse is chosen. This is a UI convenience only — the Sales Invoice
  Zod schema and posting-time validation (spec 38) are completely unchanged and still
  reject a missing `warehouseId` exactly as before.
- **Pricing/tax/stock remain fully delegated, never duplicated here** (Invariants 6/7/8):
  a barcode-resolved line calls the same `resolveLinePriceAction` (Pricing Engine) that a
  manually-selected line calls, computes the same way through `calculateLine`/
  `calculateDocument` (GST Engine) for on-screen totals, and — at posting time — moves
  stock through `inventoryEngine.recordMovements` exactly as spec 38 already does. Nothing
  in this feature ever computes a price, a tax amount, or a stock quantity itself.

---

# Service / Repository

Extend (no new module — this lives alongside the existing Products and Sales Invoice
modules)

```text
src/modules/products/repositories/product-repository.ts   // + findActiveByBarcode
src/modules/products/services/product-service.ts           // + resolveProductByBarcode
src/modules/sales-invoices/actions/sales-invoice-actions.ts // + resolveInvoiceLineByBarcodeAction
src/modules/sales-invoices/components/…                     // + BarcodeScanInput, wiring
```

- `productRepository.findActiveByBarcode(companyId, barcode)`: a plain
  `prisma.product.findFirst({ where: { companyId, barcode: trimmedValue } })` — deliberately
  **not** filtered to `isActive: true` at the query level, so the service layer above it
  can distinguish "no such barcode at all" from "found, but inactive" (see Business Rules)
  rather than collapsing both into one generic miss.
- `productService.resolveProductByBarcode(barcode)`: trims the input, calls the
  repository method above (company id resolved server-side from the session, never
  client-supplied), and returns a discriminated result —
  `{ status: "NOT_FOUND" } | { status: "INACTIVE"; product } | { status: "FOUND"; product }`
  — so callers can render the two distinct rejection messages from Business Rules without
  re-deriving the distinction themselves.
- `sales-invoice-actions.ts`'s new `resolveInvoiceLineByBarcodeAction(barcode)`: gated by
  the **same** `assertPermission(user, "sales", "create")` check every other Sales Invoice
  create-flow action already requires (this is not a general-purpose, independently-gated
  cross-module lookup endpoint — it is a Sales-Invoice-owned wrapper around
  `productService.resolveProductByBarcode`, scoped to this one caller for now). Returns the
  resolved product (id, name, productCode, defaultWarehouseId, isActive) or the
  NOT_FOUND/INACTIVE discriminator, via the shared `runAction` envelope
  (`src/lib/run-action.ts`). A future Purchase Invoice or POS-style barcode feature would
  add its own equivalently-gated wrapper around the same `productService` function rather
  than reusing this Sales-Invoice-scoped action — recorded as a named extension point, not
  built now.

No repository or service changes to `voucherEngine`, `inventoryEngine`, `gstEngine`,
`pricingEngine`, or `sales-invoice-service.ts` — barcode resolution stops at "which
`productId`/`warehouseId`/`quantity` goes into the form," exactly where a manual dropdown
pick already stops.

---

# Validation

No change to `sales-invoice-schema.ts` — a barcode-resolved line is validated by the
**exact same** `lines` array schema every other line already goes through (uuid
`productId`/`warehouseId`, `quantity` > 0 respecting unit precision, `rate` ≥ 0). The
barcode input itself validates only its own raw string before calling the resolver: `z.
string().trim().min(1).max(50)` (upper-bounded to match `Product.barcode`'s own 50-
character ceiling from spec 25 — a longer scan can never match anything and is rejected
client-side before a round-trip).

---

# UI

**Decision: extend the existing Sales Invoice Create/Edit screen in place with a
toggle-able "Barcode Entry" mode, rather than building a separate dedicated fast-billing
screen.** Reasoning:

- `38-sales-invoice.md`'s own Do Not section explicitly separates "the dedicated
  keyboard-first Billing Screen (`ui-context.md`)" from this feature — `ui-context.md`
  describes that screen as a distinct, future, performance-optimized surface, not
  something Sales Invoice's spec (or this one) builds. Building it now would silently
  expand this spec's scope into a different, larger, unscheduled feature.
- `ai-workflow-rules.md`'s Development Scope calls for "small, testable changes" and "one
  feature or subsystem at a time" — a toggle on an existing, already-shipped screen is a
  small, additive change; a new screen is a new subsystem (its own routing, its own
  header/customer/payment handling duplicated or abstracted from Sales Invoice's own form)
  that this spec's assigned scope (`Depends On: Sales`, tracker #77, "Barcode Billing," not
  "Fast Billing Screen") does not ask for.
- `code-standards.md`'s "Minimize mouse dependency for billing screens" / "Support
  keyboard-first navigation" are satisfied by the toggle + auto-refocus behavior described
  in Business Rules without needing a whole new surface.

Changes to `/sales/invoices/new` and `/sales/invoices/[id]/edit` (both already existing,
Draft-only per spec 38):

- A new `<BarcodeScanInput>` component rendered directly above the existing
  `SalesInvoiceLineEditor` table, hidden entirely when the form is `locked` (a
  Delivery-Challan-prefilled invoice — barcode entry never applies to a prefilled, fixed
  line set, mirroring how the existing "Add Line" button is already hidden in that case).
  A small toggle ("Barcode Entry" switch, default off) shows/hides the input — kept
  optional rather than always-on so a mouse-only user entering a handful of lines by
  dropdown is not forced to look at an extra control they don't use.
- On a successful resolution, `BarcodeScanInput` calls into the same `useFieldArray`
  instance `SalesInvoiceLineEditor` already owns (via a callback prop, not a second,
  independent form-state source) — appending a new line (`append`) or updating an existing
  matched line's `quantity` (`update`), then triggering the identical
  `resolveLinePriceAction` price-resolution path `handleProductChange` already calls for a
  newly-added line's `rate`.
- No new page, no new route.

Wire-up

- No new breadcrumb entries — this is a control within an existing page, not a new route.

---

# Security

No new permission module or action. Gated identically to the rest of Sales Invoice
Create/Edit: `assertPermission(user, "sales", "create")` (drafting) — the same check
already required to reach `/sales/invoices/new` or edit a Draft at all. The barcode
resolver action reuses this check explicitly (see Service/Repository) rather than
introducing an independent, more permissive lookup endpoint.

---

# Database

No new model, enum, field, or migration. No change to any existing table.

---

# Code Standards

Strict TypeScript, no `any`, no pricing/tax/stock arithmetic anywhere in this feature's
own code (every number reaching the form comes from the existing Pricing/GST/Inventory
Engine call paths, unmodified). Vitest coverage for:

- `productRepository.findActiveByBarcode` / `productService.resolveProductByBarcode`: the
  three-way discriminator (not found / found-but-inactive / found-and-active), company
  scoping (a same-barcode product belonging to a different company never matches), and
  exact-match-only behavior (a prefix or partial match never resolves).
- The duplicate-scan increment rule: same product + same resolved warehouse increments
  the existing line's quantity by exactly 1; same product + a *different* warehouse adds
  a new line instead of incrementing; a different product always adds a new line.
- The warehouse-defaulting order: product's own `defaultWarehouseId` wins when set; else
  the invoice's most-recently-added line's warehouse; else left unset with the line still
  added.
- `resolveInvoiceLineByBarcodeAction`'s permission gate (rejects without `sales`/`create`).

---

# Do Not

Do not implement

- Any new Prisma model, field, enum, or migration (see Data Model)
- A camera-based or native hardware barcode-scanning API — keyboard-wedge/USB-scanner
  text input only
- Fuzzy, partial, or name/code fallback matching — exact `barcode` match only
- Barcode/label generation or printing
- The dedicated keyboard-first Billing Screen (`ui-context.md`) — separate, unscheduled,
  future work; this spec is explicitly scoped as an addition to the existing Sales
  Invoice screen, not that screen
- Any duplicate or parallel price/tax/stock computation — every resolved line is priced,
  taxed, and (at posting time) stocked through the exact same engine calls every other
  Sales Invoice line already goes through
- Wiring barcode entry into any document other than Sales Invoice (Purchase Invoice,
  Sales/Purchase Return, Credit/Debit Note, Stock Adjustment/Transfer, etc.) — out of
  scope for this spec's assigned tracker item

---

# Success Criteria

Verify

- Scanning (typing + Enter) a valid, active, company-owned product's barcode into the
  Barcode Entry input on `/sales/invoices/new` adds a line with quantity 1 and a rate
  resolved via `resolveLinePriceAction`, identical to what selecting that same product
  from the dropdown would produce; the input clears and regains focus immediately after.
- Scanning an unknown barcode shows the friendly "No product found for this barcode"
  message and changes nothing in `lines`.
- Scanning a barcode belonging to a deactivated product shows the distinct friendly
  "This product is inactive and cannot be billed" message and changes nothing in `lines`.
- Scanning the same barcode a second time, resolving to the same product and the same
  already-used warehouse, increments that existing line's quantity by 1 rather than
  adding a second row; scanning it again with a different warehouse selected on a new
  line adds a separate row instead.
- The Barcode Entry input and toggle are hidden entirely on a `locked` (Delivery-Challan-
  prefilled) invoice form.
- The GST/tax breakdown, stock movement at posting, and voucher posting for an invoice
  built entirely via barcode entry are identical to the same invoice built via manual
  dropdown selection — no separate calculation path exists.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; no new route appears in the build route table (this feature adds no new page).

Feature-spec 79 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #77.
