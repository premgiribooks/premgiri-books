# 83 - ITC Register

> Feature-spec file number 83 (spec-file numbers are sequential and never reused — the
> highest prior file at the time this was drafted was `82-gstr-2.md`). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 8 — GST** item **#81 ITC Register** — the
> second item added to Phase 8 after its original four-item batch (specs 57-60), drafted
> alongside `82-gstr-2.md`. Depends on GST Registers (feature-spec 57 — **read in full
> first**, for `getInwardSupplyLines`) and, for its own cross-check, GSTR-3B
> (feature-spec 59 — read for Table 4(A)(5)/(C), the single lump ITC figure this spec
> breaks down into real detail).

## Goal

Implement an **ITC Register** for **Premgiri Books ERP** — a read-only report that
breaks the one lump "All other ITC" figure `59-gstr-3b.md`'s Table 4(A)(5) computes into
real, actionable detail: every eligible input-tax line for a selected period, with
rate-wise and party-wise (supplier-wise) summaries, so a filer can see **where** their
claimable credit actually comes from rather than just a single total. This is
deliberately scoped as **a report only** — no new Prisma schema, no ITC-eligibility
categorization, no running Electronic Credit Ledger balance across periods, and no
reversal tracking. Every one of those remains exactly as `59-gstr-3b.md`'s own Business
Rules already describe it: not computed anywhere in this codebase, because no document
here records a credit's Section 17(5) eligibility category or a period-to-period ledger
balance. Building a full Electronic Credit Ledger is out of scope for this spec — see Do
Not.

---

# Project Context

Before implementation, review

- `57-gst-registers.md` (**read in full** — `getInwardSupplyLines`, the sole data
  source for every figure in this report)
- `59-gstr-3b.md` (**read in full** — Table 4(A)(5)/(C)'s own Business Rules and its
  explicit statement that "the Input Tax ledger mapping in spec 44... is the closest
  thing to an ITC ledger this codebase has" and that Table 4(A)(5) "should reconcile
  with those ledgers' balances as a sanity check, though it computes from the document
  tables directly." This spec is that same reconciling figure, broken down to
  transaction/rate/party/HSN granularity rather than left as one lump sum — it does
  **not** re-derive the figure differently, it must equal Table 4(A)(5) exactly for any
  matching period)
- `60-hsn-summary.md` (read for its own HSN-grouping pattern and, specifically, its Do
  Not: "an inward (purchase-side) HSN summary... is not built here." This spec's
  HSN-wise breakdown is the one narrow exception that decision anticipated — not a
  general-purpose purchase-side HSN summary report, but a rate/HSN breakdown scoped
  specifically to eligible ITC, which is a materially different report with a different
  audience and purpose. It does not replace or duplicate `60-hsn-summary.md`'s own
  scope, which remains outward-only)

---

# Module Responsibilities

The ITC Register module is responsible for

- Breaking down `getInwardSupplyLines`' (spec 57) already-computed inward-tax figures
  into rate-wise, party-wise, and HSN-wise summaries for a selected period
- Being the one place a filer can see `59-gstr-3b.md`'s Table 4(A)(5) figure's own
  composition, cross-checked to reconcile exactly with it

The ITC Register module is **not** responsible for

- Any ITC eligibility determination (Section 17(5) blocked credits, Rule 42/43 common-
  credit reversal) — no document in this codebase records a credit's eligibility
  category (see Goal, and Business Rules below)
- A running Electronic Credit Ledger balance across periods (availed − utilized =
  balance, carried forward period to period) — no such model or concept exists anywhere
  in this codebase and none is added here (see Do Not)
- Reverse-charge ITC, import/ISD ITC, or ITC reversal tracking — identical scope
  boundary to `59-gstr-3b.md`'s own Table 4(A)(1)–(4)/(B), not re-litigated here
- Outward-supply HSN summarization (feature-spec 60's own, unmodified, scope)
- GSTR-2's statutory table shape (feature-spec 82) — a different report with a
  different purpose (statutory form layout vs. this spec's analytical rate/party/HSN
  breakdown), sharing only the same underlying `getInwardSupplyLines` data source

---

# Data Model

**No new Prisma model, enum, or migration.** Pure read-only aggregation and grouping
over `getInwardSupplyLines`' already-computed output — the fourth Phase 8 spec (after
GST Registers, HSN Summary, and GSTR-2) to add no schema of its own.

---

# Business Rules

- **Scope: every posted inward line, assumed fully eligible.** Sourced from
  `getInwardSupplyLines(companyId, from, to)` (spec 57) — Purchase Invoice (+) net of
  Purchase Return (−), identical signed aggregation to every other Phase 8 report.
  **This report treats every line as eligible ITC**, because this codebase has no data
  source to say otherwise — an explicit, permanently-visible disclaimer banner (not a
  one-time dismissible notice) states this on every render: "Every line below is
  assumed fully eligible for Input Tax Credit. This codebase does not record a
  purchase's Section 17(5) eligibility category — review ineligible/blocked credits
  (motor vehicles, employee benefits, works contracts for immovable property, etc.)
  manually against the Act before filing." This mirrors `59-gstr-3b.md`'s own Table
  4(D) disclosure, surfaced here at the point where a filer is actually looking at the
  detail rather than only a summary line.
- **Rate-wise summary**: grouped by `ratePercent` — sum of `taxableAmount`/`cgst`/
  `sgst`/`igst`/`cess` per rate, mirroring `58-gstr-1.md`'s own Table 7 consolidation
  shape but keyed on rate alone (no place-of-supply dimension — inward ITC has no
  outward-style inter/intra-state reporting requirement).
- **Party-wise (supplier-wise) summary**: grouped by `partyId` (falling back to
  `partyName` for display when `partyId` is null, though every Purchase Invoice/Return
  line always resolves a real `Supplier` — unlike the outward side's Walk-in/Quick
  Customer cases, spec 57's `resolveSupplierParty` never produces a null `partyId` for
  inward lines) — sum of the same tax fields per supplier, sorted by total ITC
  descending so the largest sources of credit surface first.
- **HSN-wise summary**: grouped by `hsnCode` (falling into an explicit "No HSN
  Assigned" bucket for lines whose product has none, mirroring `60-hsn-summary.md`'s
  own precedent for the identical gap on the outward side) — sum of the same tax
  fields per HSN code.
- **Transaction-level detail**: the underlying line list itself (document, party, HSN,
  rate, taxable amount, tax breakup) — the same shape `57-gst-registers.md`'s own
  Inward Register already renders, reused here as this report's drill-down detail
  rather than re-implemented, so a filer can trace any summary row back to its source
  documents without leaving this screen.
- **Reconciliation total**: this report's own grand total (sum across every line) must
  equal `59-gstr-3b.md`'s Table 4(A)(5) exactly for the same company and period — both
  are sums of the identical `getInwardSupplyLines` output, so any divergence would be a
  bug in one of the two services, not a legitimate difference in scope.
- **Company-scoped for every query**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/gst/services/itc-register-service.ts
src/modules/gst/actions/itc-register-actions.ts
src/modules/gst/components/…                    // alongside specs 57-60/82's, same shared module
src/types/itc-register.ts
```

- `itcRegisterService`: `getItcRegister(filters)` — calls `getInwardSupplyLines` (spec
  57) once for the period, computes the rate-wise/party-wise/HSN-wise summaries above
  in-memory (identical "batch the HSN/Unit lookups, don't N+1" convention
  `60-hsn-summary.md` established), and returns the transaction-level lines alongside
  the three summary groupings and the grand total. No Server Action or component
  groups lines itself — always through `itcRegisterService`.

---

# Validation

Zod: reuses `57-gst-registers.md`'s shared `gst-report-filters-schema.ts` — no new
schema file needed (this report has no filing/write concept at all, matching
`60-hsn-summary.md`'s and `82-gstr-2.md`'s own precedent).

---

# UI

Pages (under the `/gst` hub)

- `/gst/itc-register` — ITC Register screen: a required date-range picker (reusing
  `57-gst-registers.md`'s Filter Bar), the permanently-visible eligibility disclaimer
  banner (Business Rules), three summary tables (Rate-wise, Party-wise, HSN-wise — each
  showing Taxable Amount/CGST/SGST/IGST/CESS/Total), a grand-total row visibly labeled
  as reconciling with GSTR-3B's Table 4(A)(5), the transaction-level detail table below
  (reusing `57-gst-registers.md`'s own register table component), and an Export action
  delegating to the not-yet-built Excel Export feature (Phase 11, #77/spec 76),
  identical posture to every other Phase 8 spec.

Components (`src/modules/gst/components/`): ITC Register Rate/Party/HSN Summary Tables
(reusing `58-gstr-1.md`'s `Gstr1ConsolidatedTable` shape for the rate-wise table and
`60-hsn-summary.md`'s own HSN Summary Table for the HSN-wise one, parameterized rather
than re-implemented), a new Party Summary Table (no existing sibling component groups by
party alone), and the transaction detail table reused unmodified from
`57-gst-registers.md`'s Inward Register.

Wire-up

- Wire the `/gst` hub page's new "ITC Register" card to `/gst/itc-register`.
- Add `"itc-register": "ITC Register"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `gst` permission module: `view`, `export`. No `create`/`edit`/`delete`/
`approve` — this report has no filing or workflow-state concept at all, identical
posture to `60-hsn-summary.md`/`82-gstr-2.md`. Company-scoped identically to every spec
in this project.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, no GST arithmetic invented here (every figure sums
already-posted `getInwardSupplyLines` output; nothing is recalculated), no N+1 queries
(batched HSN/party lookups, matching `60-hsn-summary.md`'s own convention), vitest
coverage for:

- Rate-wise, party-wise, and HSN-wise grouping against a seeded multi-supplier,
  multi-rate, multi-HSN fixture spanning Purchase Invoice + Purchase Return
- A Purchase Return correctly nets its parent invoice's rate/party/HSN group down
  (never excluded, matching every sibling spec's signed-netting convention)
- The "No HSN Assigned" bucket captures every line whose product has no `hsnCodeId`
- **This report's grand total equals `59-gstr-3b.md`'s Table 4(A)(5) exactly** for an
  identical fixture run through both services — an explicit cross-check test against
  spec 59's own service output, not just an independently-asserted number (the same
  cross-check discipline `59-gstr-3b.md`'s own Code Standards section required for its
  Table 3.2 against `58-gstr-1.md`)
- Cross-company isolation

---

# Do Not

Do not implement

- GST Registers, GSTR-1, GSTR-3B, HSN Summary, or GSTR-2 (specs 57-60, 82 — this spec
  consumes spec 57's primitive only, building nothing from scratch)
- Any ITC eligibility categorization, Section 17(5) blocked-credit flagging, or Rule
  42/43 common-credit reversal computation — no data source exists for any of these;
  the permanently-visible disclaimer banner is the only acknowledgment this spec makes
  of the gap, not a partial or best-guess implementation of it
- **A full Electronic Credit Ledger** (ITC availed/utilized/running-balance-carried-
  forward-across-periods as a new Prisma model) — this was explicitly considered and
  rejected as this spec's scope; a period's ITC figure here is always freshly computed
  from that period's own posted documents, never accumulated or carried forward from a
  prior period's stored balance. If a future spec wants a true ledger, it is a
  materially larger undertaking (new schema, new business rules for how utilization
  against output liability is recorded) and should be scoped and specced on its own.
- Reverse-charge ITC, import/ISD ITC (identical scope boundary to
  `59-gstr-3b.md`'s Table 4(A)(1)-(4))
- Outward-supply HSN summarization (feature-spec 60's own, unmodified, scope)
- Actual Excel/PDF file generation for the Export button (Phase 11, #77/#76)

---

# Success Criteria

Verify

- Rate-wise/party-wise/HSN-wise summaries match a hand-computed fixture spanning
  Purchase Invoice + Purchase Return across multiple suppliers, rates, and HSN codes.
- A Purchase Return correctly reduces its parent invoice's group totals in all three
  summaries (rate-wise, party-wise, HSN-wise).
- This report's grand total equals `59-gstr-3b.md`'s Table 4(A)(5) exactly for the same
  fixture, company, and period.
- The eligibility disclaimer banner renders on every load of the page, not just on
  first visit.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/gst/itc-register` appears in the build route table.

Feature-spec 83 (this spec) is `context/Phases/phase-tracker.md`'s Phase 8 item #81 —
the last item currently drafted for Phase 8. Per `context/Phases/phase-tracker.md`, HSN
Summary (#58/spec 60) remains the next **implementation** priority in Phase 8's original
queue order — these two new items (#80/#81, specs 82-83) were added to the phase's
documentation but do not automatically reorder what gets built next; see
`progress-tracker.md`'s Next Up for the current implementation-order decision.
