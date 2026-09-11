# 60 - HSN Summary

> Feature-spec file number 60 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 8 — GST** item **#58 HSN
> Summary** — the last item in the phase. Depends on GST Registers (feature-spec 57 —
> read first, for `getOutwardSupplyLines`) and, transitively, on HSN Management
> (feature-spec 22) and Product Management (feature-spec 25, for the `Product.hsnCodeId`
> join path). See `57-gst-registers.md`'s header note on the correct tracker range
> (#55–#58) versus `33-gst-engine.md`'s stale "#54–#57" reference. This is the report
> `58-gstr-1.md`'s own Table 12 embeds rather than re-implementing — **read that spec's
> Goal scope table first** to see exactly how it depends on this one.

## Goal

Implement **HSN Summary** for **Premgiri Books ERP** — the HSN-wise (and SAC-wise)
turnover and tax summary GSTR-1's own Table 12 requires: total quantity, unit, taxable
value, and tax breakup grouped by HSN/SAC code and rate, for a selected period. This is
the narrowest of the four Phase 8 reports — a single grouping operation over the same
outward-supply lines `57-gst-registers.md` already exposes — and the one **every other
spec in this phase reuses** rather than re-deriving (see `58-gstr-1.md`'s Table 12
scope decision).

---

# Project Context

Before implementation, review

- `57-gst-registers.md` (**read in full** — `getOutwardSupplyLines`, and specifically
  **Known Limitations 1 and 3**: no HSN snapshot on posted lines, so this report resolves
  HSN via the product's **current** assignment, not the assignment at the time of sale;
  and Credit Note / Debit Note lines carry no `productId`, hence no HSN, and are
  therefore excluded from this report's grouping entirely — the same lines
  `57-gst-registers.md`'s Outward Register still lists with a blank HSN column)
- `22-hsn-management.md` (`HsnCode.code`/`codeType`/`description` — the master this
  report groups by; `code` is unique per company, so grouping by the raw string is
  unambiguous)
- `19-unit-management.md` (`Unit.uqcCode` — the Quantity column's unit-of-measure code;
  confirmed present on the live `Unit` model, referenced by `22-hsn-management.md`'s own
  note about Unit's `uqcCode` precedent for storing a GST-adjacent code as plain data
  ahead of the engine that formalizes it)
- `25-product-management.md` (`Product.hsnCodeId`/`unitId` — the two join paths this
  report needs: product → HSN code, and product → unit → UQC code)

---

# Module Responsibilities

The HSN Summary module is responsible for

- Grouping `getOutwardSupplyLines`' (spec 57) product-bearing lines by
  `(hsnCode, ratePercent)` for a selected date range, summing quantity, taxable value,
  and tax
- Being the single source `58-gstr-1.md`'s Table 12 embeds — no other module aggregates
  HSN data independently

The HSN Summary module is **not** responsible for

- Any of GSTR-1's other tables (B2B/B2C/Credit-Debit Notes — feature-spec 58)
- Inward (purchase-side) HSN summaries — GSTR-1's Table 12 is an **outward**-supply
  table only; a purchase-side HSN breakdown has no statutory filing requirement in this
  codebase's scope and is not built here (see Do Not)
- HSN/SAC master maintenance (feature-spec 22) or GST rate maintenance (feature-spec 23)

---

# Data Model

**No new Prisma model, enum, or migration.** The fourth and final spec in this batch —
alongside GST Registers (spec 57) — to add no schema at all: this report is pure
grouping over `getOutwardSupplyLines`' already-computed output plus a read-only join to
`HsnCode`/`Product`/`Unit`.

---

# Business Rules

- **Scope: outward supply only, product-bearing lines only.** Sourced from
  `getOutwardSupplyLines(companyId, from, to)` (spec 57), filtered to lines where
  `hsnCode` is non-null — this excludes every Credit Note / Debit Note line (no
  `productId`, per Known Limitation 3) and any Sales Invoice/Return line whose product
  has no HSN code assigned (`Product.hsnCodeId` null — grouped separately under an
  explicit "No HSN Assigned" bucket, never silently dropped from the report's totals, so
  a business can spot and fix an unclassified product).
- **Grouping key: `(hsnCode, codeType, ratePercent)`** — matching `57-gst-registers.md`'s
  own decision that two lines sharing a rate but different cess belong in different GST
  Engine aggregation groups; here, HSN Summary groups by HSN + rate only (not cess),
  since the statutory GSTR-1 Table 12 shape is HSN/rate-keyed, with cess summed as one
  more column within that group rather than a further grouping dimension.
- **Quantity aggregation**: sum of `getOutwardSupplyLines`' signed `quantity` (Sales
  Invoice +, Sales Return −) per group — a returned quantity correctly reduces the
  period's net HSN-wise turnover, not treated as unrelated inward movement. **Mixed-unit
  caveat, recorded explicitly**: if two products sharing one HSN code use different
  `Unit`s (e.g. one sold by "PCS," another by "KG," both classified under the same HSN),
  their quantities are still summed numerically into one total — GSTR-1's own Table 12
  has exactly this same real-world ambiguity (it asks for one UQC per HSN row); this
  report's Quantity column shows the **first/most-common unit** encountered for that
  HSN group as its label and flags the row (a small inline badge) when more than one
  distinct unit was actually summed together, rather than silently presenting a
  mixed-unit total as if it were single-unit-consistent.
- **HSN resolved via the product's current assignment** (Known Limitation 1,
  `57-gst-registers.md`) — a product reclassified to a different HSN code after the
  reporting period's transactions were posted will show under its **new** code in a
  report generated today, not the code actually printed on the original invoice. This is
  an accepted MVP limitation stated again here (not re-derived, just restated for a
  reader who starts with this spec rather than spec 57) because it is the single most
  consequential caveat for this specific report's statutory accuracy.
- **Description** — `HsnCode.description` (required field, per spec 22) shown alongside
  the code; `codeType` (`HSN`/`SAC`) shown as a small badge distinguishing goods from
  services rows.
- **Company-scoped for every query**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/gst/services/hsn-summary-service.ts
src/modules/gst/actions/hsn-summary-actions.ts
src/modules/gst/components/…            // alongside specs 57-59's, same shared module
src/types/hsn-summary.ts
```

- `hsnSummaryService`: `getHsnSummary(filters)` — calls `getOutwardSupplyLines`
  (spec 57) once for the period, filters to `hsnCode !== null` lines (bucketing
  null-HSN lines into the explicit "No HSN Assigned" group described above), resolves
  each group's `HsnCode.description`/`codeType` and representative `Unit.uqcCode` via a
  single batched lookup (not one query per group — the same N+1-avoidance convention
  every list screen in this codebase already follows), and returns the grouped rows
  sorted by HSN code.
- No Server Action or component groups lines itself — always through
  `hsnSummaryService`.

---

# Validation

Zod: reuses `57-gst-registers.md`'s shared `gst-report-filters-schema.ts` — no new
schema file needed (this report has no filing/write concept at all).

---

# UI

Pages (under the `/gst` hub)

- `/gst/hsn-summary` — HSN Summary screen: a required date-range picker (reusing
  `57-gst-registers.md`'s Filter Bar), a table (HSN/SAC Code, Type badge, Description,
  UQC, Total Quantity — with the mixed-unit badge when applicable, Total Taxable Value,
  CGST, SGST, IGST, CESS, Total Value), a distinct "No HSN Assigned" row/section at the
  bottom for unclassified-product lines, and an Export action delegating to the
  not-yet-built Excel Export feature (Phase 11, #75), identical posture to specs 57–59.

Components (`src/modules/gst/components/`): HSN Summary Table, reusing
`57-gst-registers.md`'s GST Report Filter Bar and Export Button unmodified.

Wire-up

- Wire the `/gst` hub page's "HSN Summary" card (added, unlinked, by spec 57) to
  `/gst/hsn-summary`.
- Add `"hsn-summary": "HSN Summary"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `gst` permission module: `view`, `export`. No `create`/`edit`/`delete`/
`approve` — this report has no filing or workflow-state concept at all (unlike GSTR-1/
GSTR-3B's `GstFilingRecord`), matching Invariant 3 ("Reports are read-only") most
strictly of all four specs in this batch. Company-scoped identically to every spec in
this project.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, no GST arithmetic invented here (every figure is summed
from `getOutwardSupplyLines`'s already-computed output), no N+1 queries (batched
HSN/Unit lookups), vitest coverage for:

- `(hsnCode, codeType, ratePercent)` grouping against a seeded multi-product,
  multi-rate fixture, including two products under the same HSN at different rates
  producing two distinct rows
- signed quantity netting (a Sales Return correctly reduces its HSN group's total
  quantity and taxable value)
- the mixed-unit badge triggers when a group sums lines from products using different
  `Unit`s, and does not trigger when they share one
- the "No HSN Assigned" bucket captures every product-bearing line whose product has no
  `hsnCodeId`, and Credit Note / Debit Note lines are excluded from the grouped output
  entirely (not bucketed as "No HSN Assigned" — they have no `productId` at all, a
  different case)
- cross-company isolation

---

# Do Not

Do not implement

- GST Registers, GSTR-1, or GSTR-3B (specs 57–59 — this spec is consumed by 58, and
  itself consumes 57's primitive)
- An inward (purchase-side) HSN summary (no statutory requirement in this codebase's
  scope, see Module Responsibilities)
- HSN-at-posting-time snapshotting (Known Limitation 1, a pre-existing gap in already-
  implemented specs 38/44, not fixed here)
- HSN/SAC master maintenance or GST rate maintenance (specs 22, 23)
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76)

---

# Success Criteria

Verify

- Two Sales Invoice lines for different products sharing one HSN code and rate are
  summed into a single HSN Summary row; the same HSN code at two different rates
  produces two separate rows.
- A Sales Return line correctly reduces its HSN group's quantity and taxable value
  totals for the period.
- A product with no HSN code assigned appears under an explicit "No HSN Assigned"
  bucket, never silently omitted from the report; a Credit Note/Debit Note line is
  excluded from the grouped output entirely (neither counted nor bucketed as unassigned).
- A group summing quantities from two different `Unit`s shows the mixed-unit badge; a
  single-unit group does not.
- `58-gstr-1.md`'s Table 12 renders this spec's own output with no independent
  aggregation query (grep confirms no duplicate).
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/gst/hsn-summary` appears in the build route table.

Feature-spec 60 (this spec) is `context/Phases/phase-tracker.md`'s Phase 8 item #58 —
**the last item in Phase 8 (GST)**. Per `context/Phases/phase-tracker.md`, Phase 9
(Employee Management, #59–#61) is next.
