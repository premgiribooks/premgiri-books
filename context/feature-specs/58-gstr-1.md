# 58 - GSTR-1

> Feature-spec file number 58 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 8 — GST** item **#56 GSTR-1**.
> Depends on GST Registers (feature-spec 57 — **read it first in full**, especially its
> Known Limitations section and its `getOutwardSupplyLines` primitive, which this spec
> consumes without re-deriving) and, transitively, on Sales Invoice (38), Sales Return
> (39), Credit Note (40), and Debit Note (41). See `57-gst-registers.md`'s header note
> for why this phase's correct tracker range is **#55–#58**, not the stale "#54–#57"
> `33-gst-engine.md`'s own Goal section names.

## Goal

Implement **GSTR-1** for **Premgiri Books ERP** — the statutory outward-supply return a
GST-registered business files monthly or quarterly, shaped into the government's own
table structure (B2B, B2C Large, B2C Small, Credit/Debit Notes, HSN Summary, …) so the
figures can be transcribed or exported for filing. This is a **derived, statutorily-shaped
view** of the same lines `57-gst-registers.md`'s Outward Register already exposes — GSTR-1
adds classification (registered vs. unregistered recipient, invoice value threshold,
place-of-supply-wise consolidation) and a minimal **filing-period record** (see Data
Model) that GST Registers deliberately has none of.

**MVP scope decision, recorded explicitly (per this batch's own instruction to decide and
record scope rather than attempt full statutory fidelity):**

| GSTR-1 Table | In scope | Reasoning |
|---|---|---|
| 4 — B2B (registered recipients) | **Yes** | Fully computable from stored data |
| 5 — B2C Large (inter-state, unregistered, invoice value > ₹2,50,000) | **Yes** | Fully computable |
| 7 — B2C Small (consolidated, rate + place-of-supply wise) | **Yes** | Fully computable |
| 9B/9C — Credit/Debit Notes (registered / unregistered) | **Yes** | Fully computable |
| 8 — Nil-rated / Exempt / Non-GST outward supplies | **Yes**, nil-rated/exempt only | Non-GST supplies (alcohol, petroleum) have no product/document concept in this codebase — out of scope until one exists |
| 12 — HSN-wise summary | **Delegated to `60-hsn-summary.md`**, not re-implemented here | Avoids a second, independent HSN aggregation (code-standards.md: never duplicate business logic) — this screen embeds/links that spec's own output |
| 6A/6B — Exports, SEZ supplies | **Deferred** | No export/SEZ flow, LUT/bond capture, or shipping-bill reference exists anywhere in this codebase |
| 11 — Advances received/adjusted | **Deferred** | No advance-billing feature exists (a Sales Order/Quotation is not a GST-liable advance receipt in this codebase's model) |
| 10 — Amendments to prior-period B2C | **Deferred** | Amending a *filed* prior period requires diffing against what was actually filed, which requires a filed-period snapshot this MVP does not keep (see Data Model's "advisory, not a snapshot" decision) |
| Table 13 — Documents issued summary | **Deferred** | Requires reconciling every `DocumentSequence` gap (cancelled/skipped numbers) across all outward document types — a distinct, non-trivial feature better scoped on its own if ever requested |

A future spec can extend this one when export/advance/amendment flows exist; nothing
here blocks that.

---

# Project Context

Before implementation, review

- `57-gst-registers.md` (**read in full** — `getOutwardSupplyLines`, the Known
  Limitations this spec inherits verbatim: no HSN snapshot on posted lines, no
  reverse-charge flag, no `productId` on Credit/Debit Note lines)
- `38-sales-invoice.md` (`CustomerMode` — **this spec's B2B/B2C classification is driven
  by GSTIN presence, not by `customerMode`** — see Business Rules; a `QUICK` customer who
  supplied a GSTIN is B2B exactly like a `PERMANENT` one, and a `PERMANENT` customer with
  no GSTIN on file is B2C)
- `39-sales-return.md`, `40-credit-note.md`, `41-debit-note.md` (the three adjustment
  document shapes GSTR-1's own Credit/Debit Note table draws from — recall from
  `39-sales-return.md`'s Goal note that a Sales Return does not itself appear as a
  separate GST-filed document type; only Credit Note/Debit Note carry that statutory
  label. **Decision, recorded**: GSTR-1's own Table 9B/9C (Credit/Debit Notes) reports
  `CreditNote`/`DebitNote` rows only — a Sales Return's financial effect is already
  netted into whichever B2B/B2C table its source invoice's lines fall into, via
  `getOutwardSupplyLines`'s signed aggregation, not listed a second time as if it were a
  separate statutory credit note. This avoids double-reporting the same real-world event
  under two different GSTR-1 tables.)
- `08-company-management.md` / the live schema (`Company.gstin`, `Company.stateCode` —
  **both already exist**, this spec adds neither; only `CompanySettings` gains one new
  field, see Data Model)

---

# Module Responsibilities

The GSTR-1 module is responsible for

- Classifying every outward supply line from `getOutwardSupplyLines` (spec 57) into the
  in-scope GSTR-1 tables above, for a selected filing period
- A minimal **filing-period record** — `GstFilingRecord` (new model, this spec) — letting
  a Company Admin mark a period "Filed" (advisory, see Business Rules) with an optional
  ARN (Application Reference Number) and filed-by/filed-at metadata
- The `gstFilingFrequency` (Monthly/Quarterly) setting on `CompanySettings` that drives
  this screen's period selector granularity

The GSTR-1 module is **not** responsible for

- HSN-wise summary (Table 12 — delegates entirely to `60-hsn-summary.md`, embedding or
  linking its output, never re-aggregating it)
- GSTR-3B (feature-spec 59 — a separate summary return, sharing only the
  `GstFilingRecord` model this spec introduces)
- Actually **submitting** anything to the GST portal (no such integration exists or is
  planned for this release — `ai-workflow-rules.md`'s Future Modules list "GST Portal
  Integration" explicitly out of scope)
- Enforcing that a filed period cannot receive new postings — see Business Rules'
  advisory-only decision

---

# Data Model

Add to `prisma/schema.prisma` (plus `gstFilingRecords GstFilingRecord[]` back-relations
on `Company`, `FinancialYear`, `User`):

```text
enum GstReturnType {
  GSTR1
  GSTR3B
}

enum GstFilingStatus {
  OPEN
  FILED
}

model GstFilingRecord {
  id              String          @id @default(uuid())
  companyId       String
  company         Company         @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear   @relation(fields: [financialYearId], references: [id])
  returnType      GstReturnType
  periodStart     DateTime        @db.Date
  periodEnd       DateTime        @db.Date
  status          GstFilingStatus @default(OPEN)
  arn             String?
  filedAt         DateTime?
  filedByUserId   String?
  filedBy         User?           @relation(fields: [filedByUserId], references: [id])
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([companyId, returnType, periodStart, periodEnd])
  @@index([companyId, returnType])
}

// Add to existing model CompanySettings:
enum GstFilingFrequency {
  MONTHLY
  QUARTERLY
}

gstFilingFrequency GstFilingFrequency @default(MONTHLY)
```

Decisions

- **Why `GstFilingRecord` exists at all, given Invariant 3 ("Reports are read-only") and
  the "strong default: no new Prisma models" instruction for this phase.** This is the
  one genuine exception in the batch: marking a period "Filed" does not modify any
  Sales/Purchase/Return/Note row, does not recompute or lock any total, and does not
  gate future postings (see the advisory-only rule below) — it is a small, independent
  workflow-state record *about* a period, not a mutation of the reported-on business
  data itself. This is analogous to a bookmark, not a report output. Recording it as a
  real row (rather than, say, a client-side-only "marked filed" toggle with nothing
  persisted) matters because "was this period already filed, by whom, when, with what
  ARN" is exactly the kind of fact a business needs to survive a browser refresh, a
  different user checking later, or an audit — the same reasoning that justifies every
  other persisted status flag in this codebase.
- **Shared by GSTR-1 and GSTR-3B, one model, `returnType` discriminator** — rather than
  two near-identical tables (`Gstr1FilingRecord`/`Gstr3BFilingRecord`), since the two
  returns' filing record needs exactly the same shape (period, status, ARN, filed-by/at)
  and only the "which return" dimension differs. `59-gstr-3b.md` adds no new model of
  its own — it inserts rows with `returnType: GSTR3B` into this same table.
- **`periodStart`/`periodEnd` as an explicit date pair, not a "month" or "quarter"
  number** — a period is always a contiguous date range regardless of the company's
  `gstFilingFrequency` (a monthly filer's period is one calendar month; a quarterly
  filer's is three), so storing the resolved boundary dates directly (rather than, say,
  `year`+`month`) means every query and the `@@unique` constraint work identically for
  both frequencies without a frequency-aware branch in the query layer.
- **Advisory only, no snapshot of filed totals** — this spec deliberately does **not**
  store what the return's figures *were* at filing time (a `filedTotalsJson` column, or
  similar). Reasoning: computing "did anything change since filing" would require either
  a full totals snapshot (meaningfully larger scope, effectively a second copy of the
  report's own output) or comparing `createdAt`/`updatedAt` timestamps against `filedAt`
  across six source tables (fragile, and still wouldn't catch a cancellation's effect on
  an already-summed total). Out of scope for this MVP (YAGNI, code-standards.md) —
  recorded as a named, deliberate gap, not silently dropped; a future spec can add a
  totals snapshot and a "changed since filing" banner if this becomes a real pain point.
- **`gstFilingFrequency` on `CompanySettings`, default `MONTHLY`** — the small additive
  Company-level field this batch's own instructions anticipated ("Company GSTIN/
  filing-frequency ... note it as a small additive field this spec introduces"). Company
  already has `gstin`/`stateCode` (spec 08's original schema / spec 33's migration) — no
  change needed there. This field drives only the period-selector's UI granularity
  (month-picker vs. quarter-picker) and the human-readable period label on a
  `GstFilingRecord` row; the underlying query layer (`getOutwardSupplyLines`) takes a
  plain date range regardless, so no engine logic branches on this setting.
- No `branchId`, same posture as every spec in this project.

---

# Business Rules

- **Classification is driven by GSTIN presence, not `customerMode`.** A line's
  `partyGstin` (from `getOutwardSupplyLines`) determines B2B vs. B2C — a `QUICK`
  customer who supplied a GSTIN classifies as B2B exactly like a `PERMANENT` customer
  with one on file; a `PERMANENT` customer with no GSTIN recorded, or a `WALK_IN` sale,
  is always B2C. This mirrors real GST classification rules, which key off the
  recipient's registration status, not this codebase's internal customer-mode concept.
- **Table 4 (B2B)**: every Sales Invoice / Debit Note line whose party has a GSTIN,
  listed **invoice-wise** (one row group per `documentId`), with the party's GSTIN,
  invoice number/date, place of supply, taxable value, and rate-wise tax breakup.
- **Table 5 (B2C Large)**: every line with **no** party GSTIN, an **inter-state**
  supply (`igst > 0`), and that invoice's `grandTotal` (not just this one line) exceeding
  the statutory threshold — **₹2,50,000**, a named constant
  (`B2C_LARGE_THRESHOLD_RUPEES`) rather than a magic number — listed invoice-wise like
  B2B.
- **Table 7 (B2C Small)**: every remaining unregistered-recipient line (intra-state of
  any value, or inter-state at or below the threshold) — **consolidated**, not
  invoice-wise, grouped by `(placeOfSupplyStateCode, ratePercent)` into one row per
  group with summed taxable value and tax.
- **Table 8 (Nil-rated/Exempt)**: lines with `ratePercent = 0`, consolidated by
  `placeOfSupplyStateCode`, separately from Table 7 (a zero-rate line is excluded from
  Table 7/5's own totals, not double-counted).
- **Table 9B/9C (Credit/Debit Notes)**: every `CreditNote`/`DebitNote` line, split into
  "registered" (linked party has a GSTIN) vs. "unregistered," listed invoice-wise for
  registered and consolidated for unregistered — mirroring the B2B/B2C Large/Small split
  above, applied to notes instead of invoices. **Sales Return lines are excluded from
  this table** (see Project Context's Decision above) — their effect is already netted
  into whichever B2B/B2C table their source invoice's own lines classify into.
- **Table 12 (HSN Summary)**: this screen renders `60-hsn-summary.md`'s own report
  output for the same period (a shared component or an embedded read of that spec's
  service — implementer's choice, but never a second aggregation query).
- **Filing (`markPeriodFiled`/`reopenPeriod`)**: creates or updates one
  `GstFilingRecord` row (`returnType: GSTR1`) for the given period —
  `markPeriodFiled(periodStart, periodEnd, arn?)` sets `status: FILED`, `filedAt: now()`,
  `filedByUserId`; `reopenPeriod(id)` sets `status: OPEN`, clearing `filedAt`/`arn`. Both
  are **advisory only**: neither call touches, locks, or validates against any
  Sales/Purchase/Return/Note row — a business may still post a new Sales Invoice dated
  inside an already-filed period (this codebase's Financial Year close is the only
  hard period lock that exists; a GST filing-period lock is a distinct, heavier feature
  this spec does not build, consistent with "Reports are read-only" — this record
  tracks a fact, it does not enforce one).
- **Company-scoped for every query and every filing-record write**, identical posture to
  every spec in this project.

---

# Service / Repository

Create

```text
src/modules/gst/repositories/gst-filing-repository.ts   // the only Prisma write path (GstFilingRecord)
src/modules/gst/services/gstr1-service.ts
src/modules/gst/validation/gst-filing-schema.ts
src/modules/gst/actions/gstr1-actions.ts
src/modules/gst/components/…                             // alongside spec 57's, same shared module
src/types/gstr1.ts
```

- `gstr1Service`: `getGstr1Return(filters)` — calls `gstEngine`'s (spec 57)
  `getOutwardSupplyLines(companyId, from, to)` once, then classifies the result into the
  Table 4/5/7/8/9B/9C shapes above in-memory (pure grouping/filtering, no further
  database round-trip) — `getFilingRecord(returnType, periodStart, periodEnd)`,
  `markPeriodFiled(periodStart, periodEnd, arn?)`, `reopenPeriod(id)`.
- `gstFilingRepository`: `findOne(companyId, returnType, periodStart, periodEnd)`,
  `upsert(...)` — the only Prisma access for `GstFilingRecord`, shared verbatim by
  `59-gstr-3b.md`'s own service (parameterized by `returnType`).
- No Server Action or component classifies lines itself — always through
  `gstr1Service`.

---

# Validation

Zod (`gst-filing-schema.ts`): reuses `57-gst-registers.md`'s shared
`gst-report-filters-schema.ts` for the read side (`from`/`to` calendar dates, `to >=
from`); a separate `markPeriodFiledSchema` (`periodStart`/`periodEnd` calendar dates,
`periodEnd >= periodStart`, optional `arn` ≤ 50 chars).

---

# UI

Pages (under the `/gst` hub established by `57-gst-registers.md`)

- `/gst/gstr-1` — GSTR-1 screen: a period selector (month or quarter picker, driven by
  `CompanySettings.gstFilingFrequency`), a filing-status banner (Open/Filed, with a
  "Mark as Filed" action requiring an optional ARN, or "Reopen Period" if already
  filed), and the classified tables below in sequence: B2B, B2C Large, B2C Small,
  Nil-rated/Exempt, Credit/Debit Notes (registered/unregistered), and an embedded HSN
  Summary section (spec 60's own component, reused, not re-rendered from scratch). An
  Export action, present but delegating to the not-yet-built Excel Export feature
  (Phase 11, #75) exactly like `57-gst-registers.md`'s own Export button — no file
  generation wired here.

Components (`src/modules/gst/components/`): GSTR-1 Period Selector, GSTR-1 Filing
Status Banner (+ Mark Filed / Reopen dialog), GSTR-1 B2B Table, GSTR-1 B2C Table
(handles both Large and Small via a prop), GSTR-1 Credit/Debit Note Table, reusing
`57-gst-registers.md`'s GST Report Export Button and Filter Bar where applicable.

Wire-up

- Wire the `/gst` hub page's "GSTR-1" card (added, unlinked, by spec 57) to
  `/gst/gstr-1`.
- Add `"gstr-1": "GSTR-1"` to `src/constants/breadcrumbs.ts`.
- Extend the existing Company Settings page with a "GST Filing Frequency" field
  (Monthly/Quarterly radio or select), gated by the existing `settings`/`edit`
  permission (matching every prior Company Settings extension's convention).

---

# Security

Gated by the `gst` permission module: `view` (read the classified return), `export`
(the forward-noted Export action), `approve` (used by both `markPeriodFiled` and
`reopenPeriod` — filing/reopening a statutory return period is a significant, hard-to-
undo workflow action, given the same posture Journal Voucher's Post/Cancel takes toward
`approve` rather than `create`/`edit`). The Company Settings filing-frequency field is
gated by `settings`/`edit`, not `gst`. Company-scoped identically to every spec in this
project.

---

# Database

New enums `GstReturnType`, `GstFilingStatus`, `GstFilingFrequency`; new model
`GstFilingRecord`; one new field on `CompanySettings` (`gstFilingFrequency`). One
migration. Back-relations on `Company`, `FinancialYear`, `User`. No seeding (every
company defaults to `MONTHLY` via the column default; no filing record exists until a
period is first marked filed).

---

# Code Standards

Strict TypeScript, no `any`, no GST arithmetic invented here (every figure is read from
`getOutwardSupplyLines`'s already-computed output; this module only classifies/groups),
vitest coverage for:

- B2B/B2C classification matrix: GSTIN-present vs. absent, across all three customer
  modes including a mid-transaction-converted `QUICK` invoice
- B2C Large threshold boundary (`grandTotal` exactly at, just above, and just below
  ₹2,50,000; intra-state excluded regardless of value)
- B2C Small consolidation grouping (`placeOfSupplyStateCode` × `ratePercent`)
- Nil-rated exclusion from Table 7/5's own totals
- Credit/Debit Note registered/unregistered split, and Sales Return's exclusion from
  this table (assert it does NOT appear, not just that the totals happen to match)
- `markPeriodFiled`/`reopenPeriod` round-trip (status flip, ARN persisted, `filedAt`/
  `filedByUserId` set and cleared correctly) and the `@@unique` conflict on marking the
  same period filed twice without reopening first
- advisory-only behavior: a Sales Invoice posted into an already-filed period succeeds
  without error (explicitly asserting the *absence* of a block, since this is the
  easiest rule to accidentally over-enforce)

---

# Do Not

Do not implement

- GST Registers or HSN Summary (specs 57, 60 — this spec consumes both, building neither
  from scratch)
- GSTR-3B (feature-spec 59 — shares only `GstFilingRecord`)
- Exports/SEZ, Advances, Amendments, or the Documents-Issued summary (Table 6A/6B, 11,
  10, 13 — all explicitly deferred, see Goal's scope table)
- Any actual submission to the GST portal, or e-filing credential storage
- A hard filing-period lock that blocks new postings (advisory only, see Business Rules)
- A filed-totals snapshot or "changed since filing" detection (see Data Model's
  deliberate omission)
- Actual Excel/PDF file generation for the Export button (Phase 11, #75/#76)

---

# Success Criteria

Verify

- A registered (GSTIN-present) customer's invoice lines appear under Table 4 (B2B),
  regardless of `customerMode`; an unregistered customer's inter-state invoice above
  ₹2,50,000 appears under Table 5; everything else unregistered appears consolidated
  under Table 7; a zero-rate line appears only under Table 8, never double-counted in
  7/5.
- A Credit Note against a registered customer appears under Table 9B; a Sales Return
  does not appear in either Credit/Debit Note table at all — its effect is visible only
  as a reduction inside whichever B2B/B2C table its source invoice's lines fall into.
- Marking a period "Filed" persists a `GstFilingRecord` row with the given ARN and the
  acting user/timestamp; reopening clears it; a new Sales Invoice can still be posted
  into an already-filed period without any rejection.
- Table 12 renders `60-hsn-summary.md`'s own output for the same period with no
  independent HSN aggregation query in this module (grep confirms no duplicate
  aggregation exists).
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/gst/gstr-1` appears in the build route table.

Feature-spec 58 (this spec) is `context/Phases/phase-tracker.md`'s Phase 8 item #56.
Feature-spec 59 (GSTR-3B, tracker #57) reuses this spec's `GstFilingRecord` model without
adding a new one.
