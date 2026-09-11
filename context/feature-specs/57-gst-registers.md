# 57 - GST Registers

> Feature-spec file number 57 (spec-file numbers are sequential and never reused — the
> highest prior file was `56-product-detail-page.md`). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 8 — GST** item **#55 GST Registers** — the
> first of the phase's four items (#55–#58). Depends on the GST Engine (feature-spec 33,
> implemented) and, transitively, on every GST-bearing document already implemented:
> Sales Invoice (38), Sales Return (39), Credit Note (40), Debit Note (41), Purchase
> Invoice (44), Purchase Return (45). **Read `33-gst-engine.md`'s Goal section first** —
> its own text names this phase's four items as "#54–#57," which is a **stale tracker
> reference** from before Phase 6 (Product Detail Page) was inserted ahead of the
> then-Phase-6 Accounting phase on 2026-09-11, shifting every later tracker number up by
> one. `context/Phases/phase-tracker.md` is the authoritative live numbering — this spec is
> tracker **#55**, not #54, and the correct range for this phase is **#55–#58** as this
> file's own header states.

## Goal

Implement **GST Registers** for **Premgiri Books ERP** — the transaction-level outward
and inward supply registers every GST-registered business keeps: a chronological listing
of every GST-bearing document line, showing party, place of supply, HSN, rate, and the
CGST/SGST/IGST/CESS breakup, filterable by date range. This is the **raw data view** —
GSTR-1 (feature-spec 58) and GSTR-3B (feature-spec 59) are *derived, statutorily-shaped*
summaries built from the same underlying lines; HSN Summary (feature-spec 60) is a
third, HSN-grouped derivation. GST Registers itself performs no statutory grouping at
all — it is the audit trail a business (or its accountant) scans line-by-line, and the
drill-down target the other three reports should eventually link back to.

**This spec establishes the shared aggregation primitive the other three specs in this
batch build on** (`getOutwardSupplyLines`/`getInwardSupplyLines`, see Service /
Repository) — implement this spec first within the phase; specs 58–60 all consume it
without re-deriving it.

**Architectural tension, resolved (read before implementing any of the four Phase 8
specs).** `architecture-context.md`'s Core Engines → **GST Engine** section lists "HSN
Summary, GST Registers, GSTR-1, GSTR-3B" as that engine's own responsibilities; its
**Reporting Engine** section separately lists "GST Reports" as one of *its*
responsibilities too; and its Module Boundaries → **GST** section says the GST module
owns "GST Reports, GST Registers, Return Generation." All three are true at once, at
different layers, and this spec (and 58–60) resolve the apparent overlap the same way
every other module boundary in this codebase resolves such tension — explicitly, not by
picking one document to be "right":

- **Aggregation logic** (reading posted document rows and shaping them into the common
  line format) lives inside `src/engines/gst/` — extending the already-implemented GST
  Engine (spec 33) rather than opening a new `src/engines/reporting/` tree. This matches
  architecture-context.md's most specific naming (the GST Engine section names these four
  artifacts explicitly, by name) over the more generic "GST Reports" bullet under
  Reporting Engine. It is also **pure, read-only aggregation, no schema** — the same "no
  schema, no UI" convention spec 33 itself established, just extended from
  calculating-fresh-lines to also aggregating-already-posted-lines.
- **The screens themselves** (this spec's `/gst/registers` page and its siblings) live
  under `src/modules/gst/`, gated by the `gst` permission module — matching
  architecture-context.md's GST module ownership of "GST Reports, GST Registers, Return
  Generation" literally.
- **Phase 10's own "GST Reports" item (tracker #72, not yet drafted)** is expected to
  *reuse* `getOutwardSupplyLines`/`getInwardSupplyLines` from this spec — whatever shape
  #72 turns out to need (a dashboard tile, a trend chart, a different rollup) is a
  presentation concern over the same primitive, never a second, independently-derived
  aggregation of the same document rows (code-standards.md: "Never duplicate business
  logic across modules"). This spec flags that forward dependency explicitly so #72's
  eventual author does not re-derive it.

---

# Project Context

Before implementation, review

- `33-gst-engine.md` (**read the Goal section's stale-tracker note above** — the engine
  whose namespace this spec extends; `calculateLine`/`calculateDocument` compute
  *fresh* lines, this spec aggregates *posted* ones — a different job, same directory)
- `38-sales-invoice.md`, `39-sales-return.md`, `40-credit-note.md`, `41-debit-note.md`,
  `44-purchase-invoice.md`, `45-purchase-return.md` — **read all six in full**; this
  spec's entire value is knowing exactly which columns each of these six tables actually
  stores. Confirmed from each spec's own Data Model (cross-checked against the live
  schema):
  - `SalesInvoiceItem`/`PurchaseInvoiceItem` store `ratePercent`, `cessPercent`,
    `taxableAmount`, `cgst`/`sgst`/`igst`/`cess`, `totalAmount` **per line**, plus
    `isTaxOverridden`/`overridden*` (the audit-trail values to prefer when present —
    never the pre-override computed values, since the overridden figures are what was
    actually posted to the ledger and what the business actually owes/paid tax on).
    Neither item table stores an HSN code column directly, nor an `isReverseCharge` flag
    — see Known Limitations below, both apply to every report in this batch.
  - `SalesReturnItem`/`PurchaseReturnItem` store the same tax columns, derived from the
    **source invoice line's** rate/tax (its overridden values when applicable) —
    correct to read at face value, no re-derivation needed. Neither return header nor
    item carries its own `placeOfSupplyStateCode` — it must be read from the **parent
    invoice** (`SalesReturn.salesInvoiceId` → `SalesInvoice.placeOfSupplyStateCode`, and
    the Purchase mirror), never assumed to match the reporting company's own state.
  - `CreditNoteItem`/`DebitNoteItem` store freeform `description` + `taxableAmount` +
    `ratePercent`/`cessPercent` + the four tax columns, **no `productId`** — these lines
    have no HSN to report at all (freeform adjustments are not tied to a specific
    product; see Known Limitations).
  - Only `SalesInvoice`, `PurchaseInvoice`, `CreditNote`, and `DebitNote` **headers**
    carry `placeOfSupplyStateCode` directly.
- `22-hsn-management.md` (`HsnCode.code`/`description`; Product's `hsnCodeId` FK — the
  join path to an HSN code, since no invoice line stores one directly)
- `23-gst-rate-management.md` (confirms `ratePercent`/`cessPercent` are stored as plain
  numbers per line, not a `GstRate` FK — grouping by rate needs no join back to
  `GstRate` at all, the numbers are already on every line)
- `08-company-management.md` / the live `Company` model (`gstin`, `stateCode` — **both
  already exist**, added by spec 33's own migration for `stateCode` and spec 08's
  original schema for `gstin`; this spec adds neither)

**Known Limitations, applying to every report in this batch (recorded once here, not
re-derived by specs 58–60):**

1. **No HSN snapshot on posted lines.** `22-hsn-management.md`'s own forward-note
   promised "once transactional documents reference HSN data on posted lines, those
   documents must snapshot the code at posting time" — specs 38/44 never implemented
   this (`SalesInvoiceItem`/`PurchaseInvoiceItem` have no `hsnCode` column; only
   `Product.hsnCodeId` exists, resolved live). Every report in this batch that shows an
   HSN code therefore resolves it via **the product's current HSN assignment** at
   report-generation time, not the assignment at posting time — if a business
   reclassifies a product's HSN code after invoicing, historical reports silently
   reflect the new code. This is an accepted MVP limitation, not fixed here (fixing it
   means amending `SalesInvoiceItem`/`PurchaseInvoiceItem`'s schema and posting logic,
   out of scope for a documentation-only reporting batch) — flagged as a named follow-up
   for whichever future spec revisits Sales/Purchase Invoice posting.
2. **No reverse-charge flag persisted anywhere.** The GST Engine's `calculateLine`
   accepts and echoes `isReverseCharge`, but neither `SalesInvoiceItem` nor
   `PurchaseInvoiceItem` has a column for it — specs 38/44 never persisted it. No report
   in this batch can identify a reverse-charge line; GSTR-3B's reverse-charge row (3.1(d))
   is explicitly left uncomputed for this reason (see `59-gstr-3b.md`).
3. **Credit Note / Debit Note lines carry no `productId`, hence no HSN.** Freeform
   adjustment lines are, by `40-credit-note.md`'s own design, not tied to a specific
   product — HSN Summary (spec 60) therefore excludes Credit/Debit Note lines from its
   HSN grouping entirely (they have nothing to group by), while GST Registers (this
   spec) and GSTR-1 (spec 58) still list them, with a blank HSN column.

---

# Module Responsibilities

The GST Registers module is responsible for

- A read-only **Outward Supply Register** (Sales Invoice, net of Sales Return, plus
  Credit Note and Debit Note lines) and a read-only **Inward Supply Register** (Purchase
  Invoice, net of Purchase Return), each filterable by date range and, within that,
  searchable/filterable by party, HSN, and rate
- The shared aggregation primitive (`getOutwardSupplyLines`/`getInwardSupplyLines`,
  `src/engines/gst/`) every other Phase 8 spec (58–60) and Phase 10's future GST Reports
  (#72) build on
- The `/gst` hub page (new — no GST screen exists yet; the Sidebar's "GST" entry
  currently has no `href`, see UI)

The GST Registers module is **not** responsible for

- Any statutory return shaping (GSTR-1's B2B/B2C/HSN-summary tables, GSTR-3B's
  liability/ITC summary — specs 58, 59)
- HSN-grouped turnover totals (spec 60 — this spec lists lines, it does not group them)
- Filing-period lock/status (specs 58/59's `GstFilingRecord` — this spec has no filing
  concept, it is pure transaction listing)
- Any mutation of Sales/Purchase Invoice, Return, Credit Note, or Debit Note data
  (Invariant 3: "Reports are read-only" — this module never writes to any of the six
  source tables)

---

# Data Model

**No new Prisma model, enum, or migration.** This is the fourth spec since spec 33 (GST
Engine, spec 41/Debit Note also added none) to add no schema — correct, not an omission:
GST Registers is a pure read/aggregation layer over six already-implemented tables
(`SalesInvoice(Item)`, `SalesReturn(Item)`, `CreditNote(Item)`, `DebitNote(Item)`,
`PurchaseInvoice(Item)`, `PurchaseReturn(Item)`), matching Invariant 3 ("Reports are
read-only") and the GST Engine's own "no schema, no UI, no persistence" convention
(spec 33) extended one step further to aggregation.

---

# Business Rules

- **Only `POSTED` documents are ever included.** `DRAFT` rows have no committed tax
  effect yet; `CANCELLED` rows have had their effect reversed by their own mirrored
  voucher/stock reversal (specs 38–45's own cancellation sections) — including either
  would double-count or show phantom liability. This is re-verified at the query layer
  itself (`status: "POSTED"` in every underlying Prisma query), not left to a UI filter
  a user could accidentally clear.
- **Sign convention**: Sales Invoice and Debit Note lines are **positive** (increase
  outward liability); Sales Return and Credit Note lines are **negative** (decrease it).
  Purchase Invoice lines are **positive** (increase input tax); Purchase Return lines are
  **negative**. Every aggregation in this batch (Registers, GSTR-1, GSTR-3B, HSN
  Summary) nets these signs rather than summing absolute values — a return correctly
  reduces the period's outward register total, it does not appear as unrelated inward
  activity.
- **Place of supply resolution**: read directly from the document's own header
  (`SalesInvoice`/`PurchaseInvoice`/`CreditNote`/`DebitNote.placeOfSupplyStateCode`) where
  it exists; for Sales Return / Purchase Return, resolved via the parent invoice (see
  Project Context) — never defaulted to the company's own `stateCode` when a document's
  own field is absent, since a return's place of supply is whatever the original invoice
  used, not assumed.
- **Tax values always prefer the overridden figures** (`overriddenCgst`/`overriddenSgst`/
  `overriddenIgst`/`overriddenCess` when `isTaxOverridden`, falling back to `cgst`/`sgst`/
  `igst`/`cess` otherwise) — the overridden values are what was actually posted to the
  ledger; reporting the pre-override computed values would misstate real tax liability.
  Credit Note / Debit Note / Return lines have no override concept of their own (they
  inherit or freely enter their tax values directly) — read their stored columns as-is.
- **Party resolution for Sales-side lines**: `PERMANENT` → `Customer.displayName`/`gstin`;
  `QUICK` → `quickCustomerName`/`quickCustomerGstin` (even after later conversion to a
  real `Customer` — a `QUICK` invoice that auto-converted mid-transaction, per spec 38,
  now has a real `customerId`; resolve the party from whichever is actually set, current
  customer row preferred when present); `WALK_IN` → the literal label "Walk-in Customer",
  no GSTIN. Purchase-side lines always resolve `Supplier.displayName`/`gstin` (no
  Quick/Walk-in equivalent exists for purchases, per `44-purchase-invoice.md`).
- **Company-scoped for every query**, identical posture to every spec in this project —
  every underlying Prisma query filters on the caller's own `companyId` at the query
  level, never post-filtered after an unscoped read.

---

# Service / Repository

Create

```text
src/engines/gst/gst-report-queries.ts   // getOutwardSupplyLines, getInwardSupplyLines
src/engines/gst/gst-report-types.ts     // GstSupplyLine and its discriminated variants
src/modules/gst/services/gst-register-service.ts
src/modules/gst/validation/gst-report-filters-schema.ts   // shared date-range/filter shape, reused by 58-60
src/modules/gst/actions/gst-register-actions.ts
src/modules/gst/components/…
src/types/gst-report.ts
```

- **`getOutwardSupplyLines(companyId, from, to, tx?)`** (`src/engines/gst/`, pure
  read-only aggregation, no permission check — same engine convention as spec 33's
  calculation functions; callers gate) — queries, in parallel, `SalesInvoiceItem` (joined
  to its `SalesInvoice`, `status: "POSTED"`, `invoiceDate` in range), `SalesReturnItem`
  (joined to its `SalesReturn` and, through it, the source `SalesInvoice` for place of
  supply/party), `CreditNoteItem`, and `DebitNoteItem` (same POSTED/date-range
  filtering), each mapped to the common `GstSupplyLine` shape below, sign-adjusted per
  Business Rules, and returned as one combined, date-sorted array.
- **`getInwardSupplyLines(companyId, from, to, tx?)`** — the mirror, over
  `PurchaseInvoiceItem` and `PurchaseReturnItem`.
- **`GstSupplyLine`** (`gst-report-types.ts`):

  ```text
  {
    documentType: "SALES_INVOICE" | "SALES_RETURN" | "CREDIT_NOTE" | "DEBIT_NOTE"
                | "PURCHASE_INVOICE" | "PURCHASE_RETURN"
    documentId: string
    documentNumber: string
    documentDate: Date
    partyId: string | null          // Customer/Supplier id when resolvable
    partyName: string               // see Business Rules' party-resolution rule
    partyGstin: string | null
    placeOfSupplyStateCode: string
    hsnCode: string | null          // null for Credit/Debit Note lines (Known Limitation 3)
    productId: string | null        // null for Credit/Debit Note lines
    quantity: number | null         // null for Credit/Debit Note lines (freeform, no quantity)
    ratePercent: number
    cessPercent: number
    taxableAmount: number           // signed per Business Rules
    cgst: number; sgst: number; igst: number; cess: number; totalAmount: number  // signed
  }
  ```

- `gstRegisterService`: `getOutwardRegister(filters)`, `getInwardRegister(filters)` — thin
  wrappers around the two engine functions, applying the optional party/HSN/rate filters
  a user adds on top of the required date range, plus pagination (Performance Goal:
  "Large reports should support pagination," code-standards.md).
- No Server Action or component ever calls `src/engines/gst/gst-report-queries.ts`
  directly — always through `gstRegisterService` (Repository → Service → Server Action →
  UI still holds, with the engine's read functions standing in for a repository this
  module doesn't otherwise need).

---

# Validation

Zod (`gst-report-filters-schema.ts`, shared by specs 58–60): `from`/`to` calendar dates
(`to >= from`, both required — an unbounded report has no place in a Performance Goal of
"Report Generation < 5 seconds"), optional `partyId` uuid, optional `hsnCode` string,
optional `ratePercent` number, optional `page`/`pageSize` (bounded, e.g. max 200 rows per
page).

---

# UI

Pages (new `/gst` hub — the Sidebar's "GST" entry currently renders with no `href`; this
spec is the first to give it one)

- `/gst` — hub page (cards: GST Registers, GSTR-1, GSTR-3B, HSN Summary — this spec adds
  all four cards even though it only implements the first, matching this project's "hub
  page exists before every card's own screen does" precedent is **not** followed exactly
  here — instead, since all four specs in this batch are drafted together and typically
  implemented close together, this spec creates the hub with its own card wired and the
  other three cards present but pointing at not-yet-built routes; whichever of 58–60 is
  implemented next fixes its own card's link if this spec's implementer chooses to leave
  it disabled/placeholder instead — implementer's call, recorded here as an open,
  low-stakes decision)
- `/gst/registers` — GST Registers screen: a toggle between **Outward** and **Inward**
  register, a required date-range picker, optional party/HSN/rate filters, a paginated
  table (Date, Document Type, Document Number, Party, Place of Supply, HSN, Rate %,
  Taxable Amount, CGST, SGST, IGST, CESS, Total — signed, so a return/credit-note row
  visibly shows as negative), a running period total row, and a link from each row to its
  source document's own detail page (e.g. a Sales Invoice row links to
  `/sales/invoices/[id]`) — the drill-down this report exists to provide. An **Export**
  action is present but, per this batch's scope, delegates to a not-yet-built Excel
  Export feature (tracker #75, Phase 11 — not yet drafted); this spec renders the button
  and wires no actual file generation (forward-note, matching this project's convention
  of noting future integration points without building them early — see Do Not).

Components (`src/modules/gst/components/`): GST Register Table (+ Outward/Inward
toggle), GST Report Filter Bar (shared date-range/party/HSN/rate filter UI, reused by
specs 58–60's own screens where applicable), GST Report Export Button (the forward-noted
stub).

Wire-up

- Add `href: "/gst"` to the Sidebar's existing `{ icon: Receipt, label: "GST" }` entry
  (`src/components/layout/sidebar.tsx`) — the previously-unlinked entry this spec is the
  first to connect (the same pattern Opening Stock used for the previously-unlinked
  "Inventory" entry).
- Add `gst: "GST"` and `registers: "GST Registers"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `gst` permission module (already exists in `src/constants/permissions.ts`'s
`PERMISSION_MODULES` — no new module needed): `view` (read the registers), `export`
(the forward-noted Export action). No `create`/`edit`/`delete`/`approve` — this module
never writes anything, matching Invariant 3 ("Reports are read-only"). Company-scoped
identically to every spec in this project — every query derives `companyId` from the
requesting user's own session, never a client-supplied value.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, pure aggregation functions in `src/engines/gst/`
(deterministic given the same posted rows — no I/O beyond the read queries themselves),
no GST arithmetic invented here (every tax figure is read verbatim from an
already-computed, already-posted column — this module aggregates, it never calculates),
vitest coverage for:

- `getOutwardSupplyLines`/`getInwardSupplyLines` against a seeded fixture spanning all
  six source tables (Sales Invoice, Sales Return, Credit Note, Debit Note, Purchase
  Invoice, Purchase Return), asserting correct sign per document type, correct
  overridden-vs-computed tax value selection, and correct place-of-supply resolution for
  a Sales/Purchase Return (via its parent invoice, not the company's own state)
- `DRAFT`/`CANCELLED` documents excluded from both functions
- party-resolution matrix (`PERMANENT`/`QUICK`/`WALK_IN`/`Supplier`, including a
  mid-transaction-converted `QUICK` invoice)
- date-range boundary inclusion/exclusion and pagination bounds
- cross-company isolation (a second company's postings never appear in the first
  company's register, even with an otherwise-matching date range)

---

# Do Not

Do not implement

- GSTR-1, GSTR-3B, or HSN Summary (specs 58–60 — this spec only supplies their shared
  read primitive)
- Any statutory grouping (B2B/B2C split, HSN-wise rollup, liability/ITC summary) — this
  screen is line-level only
- Any write path to Sales/Purchase Invoice, Return, Credit Note, or Debit Note data
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76 — button
  present, wiring deferred)
- A filing-period lock/status concept (specs 58/59's own `GstFilingRecord` — this report
  has no filing concept at all)
- Reverse-charge identification or HSN-at-posting-time snapshotting (Known Limitations
  1–2 — both pre-existing gaps in already-implemented specs, not fixed here)

---

# Success Criteria

Verify

- The Outward register correctly nets Sales Invoice (+), Sales Return (−), Credit Note
  (−), and Debit Note (+) lines for a date range, with `DRAFT`/`CANCELLED` documents of
  every type excluded.
- The Inward register correctly nets Purchase Invoice (+) and Purchase Return (−) lines.
- A Sales/Purchase Return line reports the place of supply of its **parent invoice**, not
  the reporting company's own state.
- Every tax figure prefers the overridden value over the computed value when
  `isTaxOverridden` is set, for every document type that supports overrides.
- A second company's data never appears in the first company's register output.
- `getOutwardSupplyLines`/`getInwardSupplyLines` are consumed, unmodified, by
  `58-gstr-1.md`, `59-gstr-3b.md`, and `60-hsn-summary.md` — no duplicate aggregation
  query exists anywhere else in the codebase (grep-able).
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/gst/registers` appears in the build route table and the Sidebar's "GST" entry
  now links there.

Feature-spec 57 (this spec) is `context/Phases/phase-tracker.md`'s Phase 8 item #55.
Feature-specs 58 (GSTR-1, tracker #56), 59 (GSTR-3B, tracker #57), and 60 (HSN Summary,
tracker #58) all depend on this spec's `getOutwardSupplyLines`/`getInwardSupplyLines` and
reuse them without re-deriving.
