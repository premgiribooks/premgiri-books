# 82 - GSTR-2

> Feature-spec file number 82 (spec-file numbers are sequential and never reused — the
> highest prior file at the time this was drafted was `81-backup-restore.md`). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 8 — GST** item **#80 GSTR-2** —
> added to the phase after its original four-item batch (#55–#58, specs 57–60) was
> already implemented; tracker/spec numbering continues from wherever the sequence
> currently ends rather than renumbering the already-implemented/already-drafted items
> in between (Phase 9's #59–#61, Phase 10's #62–#72, Phase 11's #73–#79 are all
> untouched by this addition). Depends on GST Registers (feature-spec 57 — **read in
> full first**, for `getInwardSupplyLines` and its own Known Limitations, most of which
> apply here too).

## Goal

Implement **GSTR-2** for **Premgiri Books ERP** — a read-only, statutory-table-shaped
view of this company's own inward supplies, built for the same reason GSTR-1
(feature-spec 58) exists on the outward side: business's actually use GSTR-2's original
table layout as a working reconciliation aid even though the return itself is no longer
filed. **GSTR-2 (the original return form) was suspended by the GST department in 2017
and replaced on the GST portal by auto-populated, non-editable GSTR-2A/2B — no taxpayer
has filed an actual GSTR-2 since.** This codebase's own scope notes exclude "GST Portal
Integration" as a future/out-of-scope module (`AGENTS.md`'s Future Modules list), so this
spec **cannot** and does not attempt to reproduce GSTR-2A/2B's actual behavior (auto-
population from suppliers' own GSTR-1 filings) — there is no portal connection to pull
that from. What this spec builds instead: the original GSTR-2 form's table structure,
populated **entirely from this company's own already-posted Purchase Invoices/Returns**
(the same `getInwardSupplyLines` primitive GSTR-3B's Table 4 already sums), so a filer
gets the familiar, statutorily-recognizable table shape as a reconciliation reference —
never a claim that it matches what the GST portal's own GSTR-2A/2B would show, since this
codebase has no way to know that.

Per the same "be explicit about what's computed" discipline `59-gstr-3b.md` established:
**every table row this codebase's data model cannot support is rendered as an explicit
"not tracked" placeholder, never guessed at or silently omitted.**

---

# Project Context

Before implementation, review

- `57-gst-registers.md` (**read in full** — `getInwardSupplyLines`, and specifically
  Known Limitation 2: no `isReverseCharge` flag persisted anywhere on
  `PurchaseInvoiceItem`/`PurchaseReturnItem` — the single limitation most directly
  relevant here, since it rules out ever populating this spec's Table 4)
- `58-gstr-1.md` (read for its own B2B/B2C-by-GSTIN-presence classification pattern —
  this spec's Table 3/Table 7 split mirrors that same "classify by whether the party has
  a GSTIN" logic, applied to the inward side via `Supplier.gstin`)
- `59-gstr-3b.md` (read for the "every not-computed row still appears, with
  `computed: false` and a reason" pattern this spec reuses verbatim, and for Table
  4(A)(5)'s own ITC figure, which this spec's Table 3 total should reconcile with as a
  sanity check — both are sums of the same `getInwardSupplyLines` output, so they must
  always agree; feature-spec 83 (ITC Register) is the report built specifically around
  that figure's own rate/party/HSN breakdown)

---

# Module Responsibilities

The GSTR-2 module is responsible for

- Computing the statutory rows below from `getInwardSupplyLines` (spec 57) for a
  selected filing period
- Being explicit, in both the UI and this spec, about every row that is **not**
  computed and why

The GSTR-2 module is **not** responsible for

- Any actual GSTR-2A/2B auto-population, portal reconciliation, or supplier-side data —
  structurally impossible without GST Portal Integration (`AGENTS.md`'s Future Modules
  list); this spec only ever shows what **this company itself posted**
- ITC eligibility, rate/party/HSN breakdown, or a running credit figure — that is
  feature-spec 83 (ITC Register)'s job, not duplicated here
- A "mark period filed" workflow — unlike GSTR-1/GSTR-3B, GSTR-2 is not an active
  statutory filing obligation (see Goal); adding a `GstFilingRecord` row for a return
  nobody actually files would misrepresent it as one. This report has **no filing or
  workflow-state concept at all** (matching `60-hsn-summary.md`'s own precedent for a
  report with "no filing or workflow-state concept at all")
- Purchase-side HSN summarization (Table 13 of the real GSTR-2 form) — `60-hsn-summary.md`
  already scoped itself to outward-only and explicitly excluded this ("a purchase-side
  HSN breakdown has no statutory filing requirement in this codebase's scope and is not
  built here"); this spec does not reopen that decision

---

# Data Model

**No new Prisma model, enum, or migration.** Pure read-only aggregation over
`getInwardSupplyLines`' already-computed output, identical posture to GST Registers
(spec 57) and HSN Summary (spec 60) — the third Phase 8 spec to add no schema of its own.

---

# Business Rules

Table numbers below match the government's own (suspended) GSTR-2 form layout, for
traceability — each row states whether it is computed and, if not, why.

## Table 3 — Inward supplies received from a registered person, other than supplies attracting reverse charge

**Computed, with an explicit caveat.** Invoice-wise groups (one row per Purchase
Invoice/Purchase Return document, mirroring `58-gstr-1.md`'s Table 4 B2B shape) from
`getInwardSupplyLines` lines where `partyGstin` is present, sourced from
`Supplier.gstin`. **Caveat, stated plainly in the UI**: because no `isReverseCharge`
flag exists anywhere in this codebase (spec 57's Known Limitation 2), this table cannot
actually exclude reverse-charge lines the way the real form's Table 3 does — every
registered-supplier line lands here regardless of whether it would, in reality, be
reverse-charge. Table 4 below exists specifically to name this gap rather than hide it.

## Table 4 — Inward supplies on which tax is to be paid on reverse charge

**Not computed — always shown as ₹0 with a "not tracked, enter manually if applicable"
label.** Identical root cause to `59-gstr-3b.md`'s Table 3.1(d): no `isReverseCharge`
flag is persisted on `PurchaseInvoiceItem` anywhere. Named here as the same
already-flagged follow-up: whichever future spec finally threads `isReverseCharge`
through the invoice item schemas should wire both this row and GSTR-3B's 3.1(d)
together, since they share one root cause.

## Table 5 — Inputs/Capital goods received from Overseas or from SEZ units (Bill of Entry)

**Not computed — always shown as ₹0 with a "not tracked" label.** No import/Bill-of-Entry
document flow exists in this codebase (matches `59-gstr-3b.md`'s 4(A)(1)/(2) treatment
of the same underlying gap, on the ITC side of the same transaction type).

## Table 6 — Amendments to inward supplies furnished in an earlier tax period

**Not computed — this section is not rendered at all**, not even as a labeled ₹0 row.
This codebase has no "previously filed period, now amended" concept anywhere — the
`GstFilingRecord` model (spec 58) is advisory-only and never locks a period, and no
return in this project (GSTR-1, GSTR-3B) models amendments either. Adding an
amendment-shaped placeholder here, when no sibling return has one, would invent a
workflow this codebase does not have. If a future spec ever introduces true return
amendments, it should add this row to GSTR-1/GSTR-3B/GSTR-2 together, not here alone.

## Table 7 — Supplies received from composition taxpayers, and other exempt/Nil-rated/Non-GST inward supplies

**Computed for the "no-GSTIN supplier" and nil-rated subsets, with an explicit
caveat.** Filtered from `getInwardSupplyLines` to lines where `partyGstin` is absent
(`Supplier.gstin` is nullable — an unregistered/no-GSTIN-on-file supplier) or
`ratePercent = 0`, consolidated by party. **Caveat, stated in the UI**: this codebase has
no explicit "composition scheme" flag on `Supplier` (the identical gap
`59-gstr-3b.md`'s Table 3.2 hit for `Customer`), so this table cannot actually
distinguish a composition-scheme supplier from a merely-unregistered one — both simply
show as "no GSTIN on file." Non-GST inward supplies (as distinct from 0%-rated) are not
computed, same reasoning as GSTR-3B's Table 3.1(e)/Table 5's non-GST row — no
product/document is ever flagged "non-GST" in this codebase.

## Table 8 — ISD credit received

**Not computed — always shown as ₹0 with a "not tracked" label.** No Input Service
Distributor document flow exists (matches `59-gstr-3b.md`'s 4(A)(4)).

## Table 9 — TDS and TCS credit received

**Not computed — always shown as ₹0 with a "not tracked" label.** No TDS/TCS document
flow exists anywhere in this codebase (a gap not previously named in Phase 8, since
GSTR-1/GSTR-3B have no analogous row — this is GSTR-2's own first mention of it).

## Table 10 — Consolidated statement of advances paid/adjusted

**Not computed — this section is not rendered at all**, same reasoning as Table 6: no
document in this codebase tracks a GST-relevant advance-against-purchase distinct from
an ordinary Payment Voucher, so there is no data shape to even render a labeled ₹0 row
against.

## Table 11 — Input Tax Credit reversal/reclaim

**Not computed.** Identical treatment and reasoning to `59-gstr-3b.md`'s Table 4(B): a
Purchase Return already reduces Table 3's own figure directly (the correct treatment for
"goods returned to supplier"), and no document records a *reversal* of previously
claimed credit independent of that. Rule 42/43 common-credit reversal has no data source
in this codebase at all.

## Table 12 — Addition/reduction of output tax for mismatch and other reasons

**Not computed — this section is not rendered at all.** This row is inherently a
GST-portal-reconciliation concept (comparing this taxpayer's own return against what
suppliers separately reported on their GSTR-1s) — it is not a "future capability" this
codebase could add later without GST Portal Integration; it is permanently out of reach
as long as that integration remains out of scope (`AGENTS.md`'s Future Modules list).
Rendering even a labeled ₹0 row would imply a reconciliation this system structurally
cannot perform.

## Table 13 — HSN-wise summary of inward supplies

**Not built, by design — see Module Responsibilities.** `60-hsn-summary.md` already
scoped HSN summarization to outward supplies only and explicitly excluded a
purchase-side counterpart; this spec does not reopen that decision.

## Filing

**No `GstFilingRecord` row, no "mark period filed"/"reopen period" action, no filing
status banner.** See Module Responsibilities — GSTR-2 is legally defunct as an active
filing obligation, and modeling one here would be inventing a workflow that does not
exist in reality.

- **Company-scoped for every query**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/gst/services/gstr2-service.ts
src/modules/gst/actions/gstr2-actions.ts
src/modules/gst/components/…                    // alongside specs 57-60's, same shared module
src/types/gstr2.ts
```

- `gstr2Service`: `getGstr2Return(filters)` — calls `getInwardSupplyLines` (spec 57)
  once for the period, computes Tables 3/4/5/7/8/9/11 above in-memory (Tables 6/10/12/13
  are not part of the returned shape at all — see their own Business Rules entries),
  returns a fully-shaped result object where every "not computed" row present in the
  shape carries an explicit `computed: false` flag and reason string (never simply
  omitted — the UI renders every rendered statutory row, computed or not, so a filer
  sees the form's shape and knows exactly what still needs manual entry). No
  `getFilingRecord`/`markPeriodFiled`/`reopenPeriod` methods at all (see Filing above) —
  this is the first Phase 8 GST return service with **no** `GstFilingRecord`
  interaction whatsoever.

---

# Validation

Zod: reuses `57-gst-registers.md`'s shared `gst-report-filters-schema.ts` for the read
side — no new schema file needed (this report has no filing/write concept at all,
matching `60-hsn-summary.md`'s own precedent).

---

# UI

Pages (under the `/gst` hub)

- `/gst/gstr-2` — GSTR-2 screen: the same period selector pattern as
  `58-gstr-1.md`/`59-gstr-3b.md`'s own screens (reused `Gstr1PeriodSelector` component,
  no filing-status banner — there is nothing to file), then Tables 3/4/5/7/8/9/11 in
  order — every computed row shows its figure with an inline caveat note where one
  applies (Tables 3 and 7's GSTIN/composition caveats); every not-computed row shows
  "₹0 — not tracked" in the same visually distinct (muted/dashed-border) style
  `59-gstr-3b.md` established, with a tooltip naming the specific reason. A banner at
  the top of the page states plainly that this view is derived entirely from this
  company's own posted purchases and does not reflect GSTR-2A/2B or any GST-portal data.
  An Export action, present but delegating to the not-yet-built Excel Export feature
  (Phase 11, #77/spec 76), identical posture to specs 57-60.

Components (`src/modules/gst/components/`): a document-group table reusing
`58-gstr-1.md`'s `Gstr1DocumentGroupTable`/`Gstr1ConsolidatedTable` shapes for Table 3/7
(parameterized for inward rather than outward data), plus the `Gstr3bRowNote`-style
"not tracked" badge/tooltip (shared, imported from spec 59's own components — no
duplicate badge component).

Wire-up

- Wire the `/gst` hub page's new "GSTR-2" card to `/gst/gstr-2`.
- Add `"gstr-2": "GSTR-2"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `gst` permission module: `view`, `export`. No `create`/`edit`/`delete`/
`approve` — this report has no filing or workflow-state concept at all (see Filing
above), matching `60-hsn-summary.md`'s own posture most closely of any Phase 8 spec.
Company-scoped identically to every spec in this project.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, no GST arithmetic invented here (every computed row sums
already-posted `getInwardSupplyLines` output; nothing is recalculated), vitest coverage
for:

- Table 3's invoice-wise grouping for registered (GSTIN-present) suppliers, netting a
  Purchase Return against its parent invoice's own group
- Table 7's consolidation of no-GSTIN-supplier and nil-rated lines
- Every "not computed" row present in the service's returned shape with
  `computed: false` and a non-empty reason string; Tables 6/10/12/13 absent from the
  shape entirely (a distinct, deliberately different case from a `computed: false` row)
- Table 3's total reconciles exactly with `59-gstr-3b.md`'s Table 4(A)(5) figure for the
  same period (both sum the same `getInwardSupplyLines` output) — an explicit
  cross-check test against spec 59's own service output, not just an
  independently-asserted number
- No `GstFilingRecord` interaction anywhere in this service (grep-able, mirroring
  `58-gstr-1.md`'s own "advisory-only is a structural property" test convention)
- Cross-company isolation

---

# Do Not

Do not implement

- GST Registers, GSTR-1, GSTR-3B, or HSN Summary (specs 57-60 — this spec consumes
  spec 57's primitive only, building nothing from scratch)
- Any actual GSTR-2A/2B auto-population or GST-portal reconciliation (structurally out
  of scope — see Goal/Module Responsibilities)
- Reverse-charge liability computation (Table 4), import/SEZ figures (Table 5),
  amendments (Table 6), ISD credit (Table 8), TDS/TCS credit (Table 9), advances (Table
  10), ITC reversal (Table 11), output-tax mismatch reconciliation (Table 12), or
  purchase-side HSN summary (Table 13) — all either explicitly left as visible,
  labeled, not-computed rows, or (Tables 6/10/12/13) omitted from the shape entirely per
  their own Business Rules entries
- A `GstFilingRecord` row, "mark period filed," or "reopen period" action of any kind
- ITC eligibility categorization or a rate/party/HSN ITC breakdown — that is
  feature-spec 83 (ITC Register)
- Actual Excel/PDF file generation for the Export button (Phase 11, #77/#76)

---

# Success Criteria

Verify

- Table 3's invoice-wise figures match a hand-computed fixture spanning Purchase
  Invoice + Purchase Return for registered suppliers; Table 7 correctly consolidates
  no-GSTIN-supplier and nil-rated lines.
- Table 3's total equals `59-gstr-3b.md`'s Table 4(A)(5) exactly for the same period and
  company.
- Every not-computed row (Tables 4/5/8/9/11) renders visibly distinct from a genuine ₹0
  and names its specific reason; Tables 6/10/12/13 do not appear at all.
- No `GstFilingRecord` row is ever created, read, or referenced by this feature.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/gst/gstr-2` appears in the build route table.

Feature-spec 82 (this spec) is `context/Phases/phase-tracker.md`'s Phase 8 item #80.
