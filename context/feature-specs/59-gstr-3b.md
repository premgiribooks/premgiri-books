# 59 - GSTR-3B

> Feature-spec file number 59 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 8 — GST** item **#57 GSTR-3B**.
> Depends on GST Registers (feature-spec 57 — read first, for `getOutwardSupplyLines`/
> `getInwardSupplyLines`) and GSTR-1 (feature-spec 58 — read first, for the
> `GstFilingRecord` model and `gstFilingFrequency` setting this spec reuses without
> re-adding). See `57-gst-registers.md`'s header note on the correct tracker range
> (#55–#58) versus `33-gst-engine.md`'s stale "#54–#57" reference.

## Goal

Implement **GSTR-3B** for **Premgiri Books ERP** — the monthly/quarterly **summary**
return combining outward tax liability and Input Tax Credit (ITC) claimed, at whatever
fidelity this codebase's current data model can actually support. Unlike GSTR-1's
invoice-wise detail, GSTR-3B is a small set of consolidated totals — but several of its
statutory rows require data this codebase does not capture at all (reverse charge,
import-of-goods ITC, blocked/ineligible credit categorization). **This spec is explicit,
row by row, about what is computed from real posted data versus what is deliberately
left blank pending a future capability** — silently guessing at ineligible-ITC amounts or
reverse-charge liability would be worse than an honest, visibly-blank row a business
fills in manually.

---

# Project Context

Before implementation, review

- `57-gst-registers.md` (**read in full** — `getOutwardSupplyLines`/
  `getInwardSupplyLines`, and this spec's own Known Limitations section: no
  reverse-charge flag persisted anywhere, no HSN snapshot — the reverse-charge gap is the
  one most directly relevant here, see Business Rules' Table 3.1(d))
- `58-gstr-1.md` (**read in full** — the `GstFilingRecord` model and
  `CompanySettings.gstFilingFrequency` field this spec reuses verbatim; also its own
  Table 4/5/7/8 classification, since GSTR-3B's outward-liability section is a coarser
  rollup of the same lines, not an independent re-derivation)
- `44-purchase-invoice.md` (`PurchaseInvoiceItem`'s `cgst`/`sgst`/`igst`/`cess` — this
  spec's ITC figures are these columns' sums, net of `PurchaseReturnItem`'s same
  columns; **this spec's own Goal note in `33-gst-engine.md` calls this out**: "the Input
  Tax ledger mapping in spec 44" is the closest thing to an ITC ledger this codebase has
  — `CompanySettings.inputCgstLedgerId`/etc. — and this spec's Table 4 total should
  reconcile with those ledgers' balances as a sanity check, though it computes from the
  document tables directly, not by reading ledger balances, for the same reason
  `57-gst-registers.md` reads document tables rather than `Voucher`/`VoucherEntry`: GST
  reports need rate/HSN-level granularity no ledger entry carries)

---

# Module Responsibilities

The GSTR-3B module is responsible for

- Computing the statutory rows below from `getOutwardSupplyLines`/
  `getInwardSupplyLines` (spec 57) for a selected filing period
- Reusing `58-gstr-1.md`'s `GstFilingRecord` model (`returnType: GSTR3B`) for this
  return's own filing-period marking — no new model
- Being explicit, in both the UI and this spec, about every row that is **not**
  computed and why

The GSTR-3B module is **not** responsible for

- GSTR-1's invoice-wise detail (feature-spec 58 — this spec only consumes its
  classification logic's underlying primitive, at a coarser grain)
- Any ITC eligibility determination (Section 17(5) blocked credits, common credit
  reversal under Rule 42/43) — no document in this codebase records a credit's
  eligibility category; see Business Rules
- Interest, late fee, or penalty computation (a downstream-of-actual-filing-date
  concept this codebase has no way to know, since it doesn't track the GST portal's own
  due-date/filing-date difference)
- Actually submitting anything to the GST portal

---

# Data Model

**No new Prisma model, enum, or migration.** This spec reuses `58-gstr-1.md`'s
`GstFilingRecord`/`GstReturnType`/`GstFilingStatus` (inserting `returnType: GSTR3B` rows
into the same table) and `CompanySettings.gstFilingFrequency` (for period-selector
granularity) without adding anything new — the third spec in this batch, after GST
Registers, to ship no schema of its own.

---

# Business Rules

Table numbers below match the government's own GSTR-3B form layout, for traceability —
each row states whether it is computed and, if not, why.

## 3.1 — Outward supplies and inward supplies liable to reverse charge

- **(a) Outward taxable supplies (other than zero-rated, nil-rated, exempt)**
  **Computed.** Sum of `getOutwardSupplyLines`' `taxableAmount`/`cgst`/`sgst`/`igst`/
  `cess` where `ratePercent > 0`, signed per `57-gst-registers.md`'s netting rule
  (Sales Invoice +, Sales Return/Credit Note −, Debit Note +).
- **(b) Outward taxable supplies (zero rated)** **Not computed — always shown as
  ₹0 with a "not tracked" label.** No export/SEZ flow exists in this codebase (Goal's
  scope table in `58-gstr-1.md` defers Tables 6A/6B for the same reason); there is
  structurally nothing to sum.
- **(c) Other outward supplies (nil rated, exempt)** **Computed.** Sum of the same
  lines where `ratePercent = 0` (mirrors `58-gstr-1.md`'s Table 8).
- **(d) Inward supplies liable to reverse charge** **Not computed — always shown as
  ₹0 with a "not tracked, enter manually if applicable" label.** Neither
  `SalesInvoiceItem` nor `PurchaseInvoiceItem` persists an `isReverseCharge` flag
  anywhere (`57-gst-registers.md`'s Known Limitation 2) — there is no stored signal to
  sum. Flagged here as a named follow-up: whichever future spec finally threads
  `isReverseCharge` through the invoice item schemas should also wire this row.
- **(e) Non-GST outward supplies** **Not computed.** No product/document in this
  codebase is ever flagged "non-GST" (alcohol, petroleum) as distinct from "0% GST
  rated" — `ProductType`/`GstRate` have no such concept. Shown as ₹0 with the same
  "not tracked" label as (b)/(d).

## 3.2 — Inter-state supplies to unregistered persons, composition taxpayers, and UIN holders

- **Computed for the unregistered-recipient sub-row only** (composition/UIN recipients
  have no equivalent flag anywhere in `Customer`/`Supplier` — this codebase has no
  concept of a customer's own GST composition/UIN status): filtered from
  `getOutwardSupplyLines` to inter-state (`igst > 0`) lines with no party GSTIN,
  consolidated by `placeOfSupplyStateCode` — the same filter `58-gstr-1.md`'s Table 5/7
  already apply, reused here rather than re-derived, just grouped one level coarser
  (state only, no rate breakdown).

## 4 — Eligible ITC

- **(A)(5) All other ITC** **Computed.** Sum of `getInwardSupplyLines`' `cgst`/`sgst`/
  `igst`/`cess` (Purchase Invoice, net of Purchase Return, per spec 57's signed
  aggregation) — the only ITC sub-row this codebase's data actually supports, since
  every Purchase Invoice line already carries its input-tax breakup.
- **(A)(1)–(A)(4)** (import of goods/services, ISD credit, inward reverse-charge ITC)
  **Not computed — shown as ₹0, "not tracked."** No import/ISD/reverse-charge document
  flow exists.
- **(B) ITC reversed** **Not computed.** No document records a *reversal* of previously
  claimed credit independent of a Purchase Return (a Purchase Return already reduces
  the (A)(5) figure directly, which is the correct treatment for "goods returned to
  supplier," not a separate "reversal" line — conflating the two would double-count).
  Rule 42/43 common-credit reversal has no data source in this codebase at all.
- **(C) Net ITC available** **Computed** as (A)(5) − (B), i.e. simply (A)(5) here since
  (B) is always 0 — shown plainly as equal to (A)(5), with a note that this equality
  is a consequence of (B) being untracked, not a claim that no reversal was ever
  actually required.
- **(D) Ineligible ITC** **Not computed.** No document anywhere records a credit's
  Section 17(5) eligibility category. Shown as ₹0, "not tracked — review manually
  against Section 17(5) before filing."

## 5 — Exempt, nil-rated, and non-GST inward supplies

- **Computed for nil-rated/exempt only** (`ratePercent = 0` on `getInwardSupplyLines`),
  consolidated by intra-state vs. inter-state (the statutory form's own split). Non-GST
  inward supplies: not computed, same reasoning as 3.1(e).

## 5.1 — Interest and late fee

**Not computed at all — no input fields rendered for auto-calculation**; this section
is presentational-only text explaining that interest/late fee depend on the actual GST
portal filing date versus the statutory due date, neither of which this offline system
tracks, and must be computed by the filer at actual filing time.

## Filing

- **`markPeriodFiled`/`reopenPeriod`** — identical mechanics to `58-gstr-1.md`'s own
  (same `GstFilingRecord` model, `returnType: GSTR3B`), same advisory-only posture (does
  not lock or validate against any Sales/Purchase/Return/Note row).
- **Company-scoped for every query and every filing-record write**, identical posture
  to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/gst/services/gstr3b-service.ts
src/modules/gst/actions/gstr3b-actions.ts
src/modules/gst/components/…                    // alongside specs 57/58's, same shared module
src/types/gstr3b.ts
```

- `gstr3bService`: `getGstr3BReturn(filters)` — calls `getOutwardSupplyLines`/
  `getInwardSupplyLines` (spec 57) once each for the period, computes the rows above
  in-memory, returns a fully-shaped result object where every "not computed" row is
  present with an explicit `computed: false` flag and reason string (never simply
  omitted from the response — the UI renders every statutory row, computed or not, so a
  filer sees the form's full shape and knows exactly what still needs manual entry),
  `getFilingRecord`/`markPeriodFiled`/`reopenPeriod` — thin delegations to
  `58-gstr-1.md`'s `gstFilingRepository`, parameterized with `returnType: GSTR3B`
  (**no new repository file** — reuses `gst-filing-repository.ts` verbatim).

---

# Validation

Zod: reuses `57-gst-registers.md`'s shared `gst-report-filters-schema.ts` for the read
side, and `58-gstr-1.md`'s `markPeriodFiledSchema` verbatim (parameterized by
`returnType`, no new schema file needed for filing).

---

# UI

Pages (under the `/gst` hub)

- `/gst/gstr-3b` — GSTR-3B screen: the same period selector and filing-status banner
  pattern as `58-gstr-1.md`'s own screen (reused components, `returnType: GSTR3B`), then
  the statutory sections 3.1/3.2/4/5/5.1 in order — every computed row shows its
  figure; every not-computed row shows "₹0 — not tracked" in a visually distinct
  (muted/dashed-border) style with a tooltip naming the specific reason from Business
  Rules, never silently blank or indistinguishable from a genuine zero. An Export
  action, present but delegating to the not-yet-built Excel Export feature (Phase 11,
  #75), identical posture to specs 57/58.

Components (`src/modules/gst/components/`): GSTR-3B Summary Table (renders both
computed and not-computed rows, with the visual distinction above), reusing
`58-gstr-1.md`'s Period Selector and Filing Status Banner components unmodified
(parameterized by `returnType`).

Wire-up

- Wire the `/gst` hub page's "GSTR-3B" card (added, unlinked, by spec 57) to
  `/gst/gstr-3b`.
- Add `"gstr-3b": "GSTR-3B"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `gst` permission module: `view`, `export`, `approve` (used by
`markPeriodFiled`/`reopenPeriod`, identical reasoning to `58-gstr-1.md`'s own). Same
`GstFilingRecord` row space as GSTR-1 — a `GstFilingRecord` for `GSTR1` and one for
`GSTR3B` covering the same period are independent rows (the `@@unique` constraint
includes `returnType`), so filing one return does not affect the other's status.
Company-scoped identically to every spec in this project.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, no GST arithmetic invented here (every computed row sums
already-posted `getOutwardSupplyLines`/`getInwardSupplyLines` output; nothing is
recalculated), vitest coverage for:

- Every "computed" row's figure against a seeded fixture spanning Sales/Purchase
  Invoice, Sales/Purchase Return, Credit Note, Debit Note
- Every "not computed" row is present in the service's returned shape with
  `computed: false` and a non-empty reason string (never simply absent from the
  object — a missing key and an explicit `computed: false` are different failure
  surfaces this test distinguishes)
- 3.1(a)/(c) split by `ratePercent = 0` boundary
- 3.2's unregistered inter-state consolidation matches `58-gstr-1.md`'s own Table 5/7
  inter-state-unregistered subset, summed to state level (an explicit cross-check
  test against spec 58's own classification, not just an independently-asserted
  number)
- 4(A)(5)/(C) net ITC math (Purchase Invoice minus Purchase Return, by tax type)
- filing round-trip reusing spec 58's own `GstFilingRecord` — asserting a `GSTR1`
  filing record and a `GSTR3B` filing record for the same period are independent rows

---

# Do Not

Do not implement

- GST Registers, GSTR-1, or HSN Summary (specs 57, 58, 60 — this spec consumes the
  first two's primitives/model, building neither from scratch)
- Reverse-charge liability computation (3.1(d)), zero-rated/export figures (3.1(b)),
  non-GST supply tracking (3.1(e)/5), import/ISD/reverse-charge ITC (4(A)(1)–(4)), ITC
  reversal (4(B)), or ineligible-ITC categorization (4(D)) — all explicitly left as
  visible, labeled, not-computed rows, not silently guessed at or hidden
- Interest/late-fee auto-calculation (5.1)
- A second, independent `GstFilingRecord`-equivalent model (reuses spec 58's)
- Any actual submission to the GST portal
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76)

---

# Success Criteria

Verify

- 3.1(a)/(c) and 3.2's computed figures match a hand-computed fixture spanning every
  GST-bearing document type.
- 4(A)(5) equals the sum of posted Purchase Invoice input-tax columns net of Purchase
  Return's own columns; 4(C) equals 4(A)(5) exactly, with the equality's caveat visible
  in the UI.
- Every not-computed row (3.1(b)/(d)/(e), 4(A)(1)–(4)/(B)/(D), 5.1) renders visibly
  distinct from a genuine ₹0 and names its specific reason.
- Marking this return's period filed does not affect `58-gstr-1.md`'s own filing status
  for the same period, and vice versa.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/gst/gstr-3b` appears in the build route table.

Feature-spec 59 (this spec) is `context/Phases/phase-tracker.md`'s Phase 8 item #57.
