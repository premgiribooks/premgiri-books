# 74 - GST Reports

> Feature-spec file number 74 (spec-file numbers are sequential and never reused — the
> highest prior file at the time this batch was drafted was `73-employee-reports.md`,
> assigned to a concurrently-drafted sibling batch; if that file does not yet exist when
> you read this, spec-file numbering still holds — the number is reserved by tracker
> position, not by file existence order). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 10 — Reporting** item **#72 GST Reports**,
> the last of the phase's eleven items and the only one of this spec's own five-item
> batch (#62–#65, #72) that does not touch the Reporting Engine's Voucher-Engine-backed
> financial reports. Depends on GST (i.e. GST Registers, GSTR-1, GSTR-3B, HSN Summary —
> feature-specs 57–60, all drafted; **read `57-gst-registers.md` first in full**,
> especially its own forward-note naming this exact spec).

## Goal

Implement **GST Reports** for **Premgiri Books ERP** — a Reports-module **analytical
dashboard** over the company's GST position: outward vs. inward tax trend over time, net
GST liability (Output Tax − Input Tax) by month, and a rate/HSN-wise breakdown for the
selected period. This is **explicitly not** a fifth statutory return alongside GSTR-1/
GSTR-3B — it is the presentation layer `57-gst-registers.md` itself predicted this
tracker item would need, built on that spec's and its siblings' already-computed data,
never re-deriving GST arithmetic of its own.

**What distinguishes this from Phase 8's GST screens (recorded explicitly, per this
batch's own instruction, so a future implementer does not build the same screen
twice):**

| | Phase 8 (`57`–`60`) | This spec (`74`) |
|---|---|---|
| Audience | The filer, preparing an actual return | A business owner/accountant, monitoring position over time |
| Shape | Statutory table structure (B2B/B2C/HSN-wise, government form layout) | Trend charts, summary tiles, month-over-month comparison |
| Granularity | Invoice-wise / HSN-wise, one filing period at a time | Month-bucketed series across an arbitrary multi-month range |
| Module | `gst` (`src/modules/gst/`), under `/gst` | `reports` (`src/modules/reports/`), under `/reports` |
| Filing concept | `GstFilingRecord` is central (mark filed/reopen) | Filing status is a read-only overlay on the trend, not an action this spec performs |

Both consume the **same underlying data** (`getOutwardSupplyLines`/
`getInwardSupplyLines`, `57-gst-registers.md`) and, for the HSN-wise breakdown widget,
the same `60-hsn-summary.md` output — this spec adds **zero new GST aggregation
queries** to `src/engines/gst/`. Its only genuinely new logic is **month-bucketing** —
grouping an already-fetched, already-correct array of `GstSupplyLine`s by calendar
month for a trend series — which is a Reporting concern (grouping/summarizing for
presentation), not a GST-calculation concern, and is therefore implemented as a pure
function in `src/engines/reporting/`, the Reporting Engine this batch's other four specs
(`64`–`67`) establish, rather than inside the GST Engine's own namespace.

---

# Project Context

Before implementation, review

- `57-gst-registers.md` (**read in full**) — `getOutwardSupplyLines(companyId, from, to,
  tx?)`/`getInwardSupplyLines(companyId, from, to, tx?)`, the `GstSupplyLine` shape,
  and its own explicit forward-note: "Phase 10's own 'GST Reports' item (tracker #72) is
  expected to reuse `getOutwardSupplyLines`/`getInwardSupplyLines` ... whatever shape
  #72 turns out to need ... is a presentation concern over the same primitive, never a
  second, independently-derived aggregation."
- `58-gstr-1.md` — `GstFilingRecord` (`returnType`, `periodStart`/`periodEnd`, `status`)
  and `CompanySettings.gstFilingFrequency` — this spec reads (never writes) both, to
  overlay each month's Filed/Open status on the trend.
- `60-hsn-summary.md` — `hsnSummaryService.getHsnSummary(filters)` — this spec's own
  HSN-wise widget embeds this exact service's output for the selected period, never
  re-aggregating HSN totals independently.
- `64-trial-balance.md` (**read for the Reporting Engine location decision** — this
  spec's month-bucketing function lives in the same `src/engines/reporting/` directory
  that spec establishes, alongside `trial-balance.ts`/`profit-and-loss.ts`/
  `balance-sheet.ts`/`cash-flow.ts`, even though its inputs come from the GST Engine
  rather than the Voucher Engine — a Reporting Engine function is defined by what it
  does (pure aggregation/shaping for a report), not by which upstream engine supplied
  its input).

---

# Module Responsibilities

The GST Reports module is responsible for

- A read-only GST dashboard: pick a date range (typically several months), see Output
  Tax vs. Input Tax vs. Net Liability as a month-bucketed trend, an HSN/rate-wise
  breakdown for the range (embedding spec 60's own output), and a read-only Filed/Open
  status overlay per month (reading `GstFilingRecord`, never writing it)
- Its own Reporting Engine function, `src/engines/reporting/gst-dashboard.ts`, added
  alongside `64-trial-balance.md`'s financial-report files in the same engine directory

The GST Reports module is **not** responsible for

- Any statutory return (GSTR-1, GSTR-3B — specs 58, 59) or their filing workflow
  (`markPeriodFiled`/`reopenPeriod` remain exclusively those specs' own actions; this
  spec never calls either)
- GST Registers or HSN Summary's own screens (specs 57, 60 — this spec embeds spec 60's
  output as a read, it does not rebuild it)
- Any new GST aggregation query in `src/engines/gst/` (month-bucketing is this spec's
  only new logic, and it lives in the Reporting Engine, not the GST Engine)
- Trial Balance, Profit & Loss, Balance Sheet, or Cash Flow (`64`–`67` — this spec is the
  batch's only non-financial report)

---

# Data Model

**No new Prisma model, enum, or migration.** Pure read/aggregation over already-
computed GST Engine output and the already-implemented `GstFilingRecord` (read-only
here), matching Invariant 3 ("Reports are read-only") and the same "no schema" posture
every spec in the GST batch (`57`–`60`) and the financial-report batch (`64`–`67`) has
already established.

---

# Business Rules

- **No independent GST arithmetic.** Every taxable amount, CGST/SGST/IGST/CESS figure
  this dashboard shows is read verbatim from `GstSupplyLine`s `getOutwardSupplyLines`/
  `getInwardSupplyLines` already computed (themselves reading already-posted,
  already-signed document columns per spec 57's own Business Rules) — this module only
  buckets and sums what it is given.
- **Month-bucketing**: for the selected `[from, to]` range, lines are grouped by the
  calendar month of their `documentDate` (using the company's own calendar, no fiscal-
  quarter grouping here — `58-gstr-1.md`'s own period selector already handles the
  Monthly/Quarterly distinction for filing purposes; this dashboard's trend is always
  month-granular regardless of the company's filing frequency, since a trend chart with
  fewer, coarser buckets is strictly less useful, never more).
- **Output Tax (per month)** = Σ(`cgst + sgst + igst + cess`) across that month's
  outward lines (signed per spec 57's own netting rule — a Sales Return/Credit Note
  correctly reduces the month's Output Tax). **Input Tax (per month)** = the same sum
  over inward lines. **Net Liability (per month)** = Output Tax − Input Tax (a negative
  figure — Input exceeding Output — is a valid result, e.g. a heavy-purchasing month,
  and is displayed as such, never clamped).
- **HSN/rate-wise breakdown** for the whole selected range (not month-bucketed) is
  `60-hsn-summary.md`'s own `hsnSummaryService.getHsnSummary({ from, to, ... })` output,
  embedded as-is — this spec never groups by HSN or rate itself.
- **Filing status overlay**: for each bucketed month, resolve whether a `GstFilingRecord`
  (`returnType: GSTR1`, matching `periodStart`/`periodEnd`) exists with `status: FILED` —
  read-only; a month with no matching record, or a record whose period doesn't align
  exactly with a calendar month (a quarterly filer's `GstFilingRecord` spans three
  calendar months) is shown with a period-level indicator, not a forced per-month one — a
  quarterly filer's three bucketed months all show the same quarter's filed/open status,
  not three independent flags implying month-level filing that doesn't exist for that
  company.
- **Company-scoped**, identical posture to every spec in this project.

---

# Engine

Create

```text
src/engines/reporting/gst-dashboard.ts   // buildGstDashboardReport (pure)
```

- `buildGstDashboardReport(outwardLines: GstSupplyLine[], inwardLines: GstSupplyLine[]):
  GstDashboardTrend` — pure function, no I/O, no permission checks (the Reporting Engine
  convention `64-trial-balance.md` establishes). Buckets both arrays by
  `documentDate`'s calendar month, sums signed tax figures per month, and returns
  `{ months: { month: string; outputTax: number; inputTax: number; netLiability: number
  }[] }` sorted chronologically. Takes already-fetched `GstSupplyLine[]` — it never
  calls `getOutwardSupplyLines`/`getInwardSupplyLines` itself (those remain I/O, owned
  by the service layer below), keeping this function pure and trivially unit-testable
  against a plain in-memory fixture.

`src/modules/reports/services/gst-reports-service.ts`
(`gstReportsService.getGstDashboard(companyId, from, to)`): the only I/O — calls
`getOutwardSupplyLines(companyId, from, to)` and `getInwardSupplyLines(companyId, from,
to)` (spec 57, imported directly — both are permission-check-free engine functions by
convention, this service is their gating caller) in parallel, calls
`buildGstDashboardReport`, then separately calls `hsnSummaryService.getHsnSummary({
from, to })` (spec 60) for the embedded breakdown widget and
`gstFilingRepository.findMany(companyId, "GSTR1", from, to)` (spec 58's existing
repository, read-only here) for the filing-status overlay, and composes all three into
one response shape. No new repository file — every read reuses an existing one.

---

# Validation

Zod: reuses `57-gst-registers.md`'s shared `gst-report-filters-schema.ts` verbatim
(`from`/`to` calendar dates, `to >= from`) — no new schema file. Unlike the financial
reports (`64`–`67`), this spec has no `financialYearId` parameter — a GST dashboard
trend is date-range-scoped only, matching `57-gst-registers.md`'s own filter shape
exactly (GST reporting periods do not align to the company's Financial Year the way
accounting reports do).

---

# UI

Pages (under the `/reports` hub established by `64-trial-balance.md`)

- `/reports/gst` — GST Reports screen: a date-range picker (typically defaulting to the
  last 6 or 12 months), a month-bucketed Output Tax / Input Tax / Net Liability trend
  chart, summary tiles (total Output Tax, total Input Tax, total Net Liability for the
  whole range), an embedded HSN/rate-wise breakdown table (spec 60's own component,
  reused, not re-rendered from scratch), and a per-month Filed/Open status strip (read-
  only — no Mark Filed/Reopen action here; those remain `58-gstr-1.md`'s and
  `59-gstr-3b.md`'s own screens' actions). A link from the summary tiles to `/gst/gstr-1`
  and `/gst/gstr-3b` for the filer who needs to act on a specific period, rather than
  duplicating those screens' own filing controls here. An Export action, present but
  delegating to the not-yet-built Excel Export feature (Phase 11, #75), identical
  posture to every report in this batch.

Components (`src/modules/reports/components/`): GST Trend Chart (month-bucketed
Output/Input/Net line or bar chart), GST Summary Tiles, reusing `60-hsn-summary.md`'s own
HSN table component and the shared Date Range Filter Bar (`65-profit-and-loss.md`'s
`from`/`to` variant) and Report Export Button.

Wire-up

- Wire the `/reports` hub page's "GST Reports" card (added, unlinked, by spec 64) to
  `/reports/gst`.
- Add `"gst": "GST Reports"` to `src/constants/breadcrumbs.ts` under a `"reports/gst"`
  parent-scoped key (`"reports/gst"`) rather than the bare `gst` key — the bare `gst`
  segment is already reserved by `57-gst-registers.md`'s own `/gst` hub page label ("GST"
  for that module's breadcrumb trail); this spec's route lives under `/reports/gst`, a
  different section, so it uses the breadcrumb bar's documented "parent/segment"
  disambiguation (`src/constants/breadcrumbs.ts`'s own doc comment) rather than
  colliding with the existing bare key.

---

# Security

Gated by **both** the `reports` permission module (`view`, `export` — this screen lives
under `/reports`, matching every other spec in this batch) **and** the `gst` permission
module's own `view` action (**decided and justified, per this batch's own instruction to
decide rather than silently pick one**): the figures this dashboard surfaces are the
same tax-liability data GST Registers/GSTR-1/GSTR-3B gate behind `gst`/`view` — a user
who can see general Reports but has no GST module access at all should not gain GST
liability visibility merely by having `reports`/`view`, since GST figures carry the same
confidentiality boundary inside this company that the GST module itself already draws.
Concretely: `getGstDashboard` requires `reports:view` **and** `gst:view` both true for
the requesting user; the Export action requires `reports:export` additionally. No
`create`/`edit`/`delete`/`approve` anywhere in this module — read-only (Invariant 3), and
this spec never calls `markPeriodFiled`/`reopenPeriod` (those remain gated by `gst:
approve` in their own specs). Company-scoped identically to every spec in this project.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, `gst-dashboard.ts` fully pure and unit-tested (no GST
arithmetic invented — every figure is a straight sum of already-computed `GstSupplyLine`
fields), vitest coverage for:

- `buildGstDashboardReport` against a fixture spanning at least 3 calendar months with
  mixed Sales Invoice/Sales Return/Credit Note/Debit Note/Purchase Invoice/Purchase
  Return lines, asserting correct month bucketing and correct signed Output/Input/Net
  figures per month
- A month with Input Tax exceeding Output Tax displays a negative Net Liability, not
  clamped to zero
- A quarterly filer's `GstFilingRecord` (spanning 3 calendar months) correctly overlays
  the same filed/open status onto all 3 bucketed months, not three independent flags
- `getGstDashboard` is rejected for a user with `reports:view` but not `gst:view` (and
  vice versa) — both permissions are required
- No independent HSN aggregation exists in this module (a grep-able assertion, matching
  `57-gst-registers.md`'s own Success Criteria precedent) — the HSN widget's data comes
  from `hsnSummaryService.getHsnSummary` exclusively
- Cross-company isolation

---

# Do Not

Do not implement

- GSTR-1, GSTR-3B, GST Registers, or HSN Summary screens (specs 57–60 — this spec
  embeds/links to them, building none from scratch)
- Any new aggregation query in `src/engines/gst/` (month-bucketing lives in the
  Reporting Engine, `src/engines/reporting/gst-dashboard.ts`)
- `markPeriodFiled`/`reopenPeriod` or any other filing-record mutation (this module is
  read-only even with respect to `GstFilingRecord`)
- Trial Balance, Profit & Loss, Balance Sheet, or Cash Flow (`64`–`67`)
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76)
- Any change to `src/engines/gst/gst-report-queries.ts`, `58-gstr-1.md`'s
  `gst-filing-repository.ts`, or `60-hsn-summary.md`'s service — all consumed exactly as
  built

---

# Success Criteria

Verify

- The GST dashboard renders a correct month-bucketed Output/Input/Net Liability trend
  for a multi-month date range, with signed figures matching a hand-computed fixture.
- The embedded HSN breakdown widget renders `60-hsn-summary.md`'s own output for the
  same range, with no independent HSN aggregation query anywhere in this module.
- A user with only `reports:view` (no `gst:view`), or only `gst:view` (no
  `reports:view`), cannot load the dashboard — both are required.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/gst` appears in the build route table.

Feature-spec 74 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #72 and
the last item of Phase 10 overall. Together with `64-trial-balance.md`,
`65-profit-and-loss.md`, `66-balance-sheet.md`, and `67-cash-flow.md`, it completes this
drafting batch's five assigned items (tracker #62–#65, #72); tracker #66–#71
(Sales/Purchase/Inventory/Customer/Supplier/Employee Reports) are a separate,
concurrently-drafted batch this spec does not depend on and does not block.
