# 77 - Excel Export

> Feature-spec file number 77 (spec-file numbers are sequential and never reused — the
> highest prior file was `76-excel-import.md`, drafted in this same batch). This feature
> is `context/Phases/phase-tracker.md`'s **Phase 11 — Productivity Features** item **#75
> Excel Export**. Depends on Reports (Phase 10, feature-specs 64–74, all documentation-
> only/not yet implemented as of this writing). Documentation only, drafted 2026-09-11 —
> nothing in this spec is implemented yet. **Read `64-trial-balance.md` in full and skim
> the `# Service / Repository`/return-shape of `65`–`74` before implementing** — every one
> of those eleven reports left an explicit "Export forward-note" this spec resolves.
> **Read this spec before implementing `76-excel-import.md` or `78-pdf-generation.md`** —
> both consume the shared utility and shared types this spec introduces.

## Goal

Implement **Excel Export** for **Premgiri Books ERP** — the generic, reusable "export
this table to Excel" capability every Reports-phase screen (Trial Balance, P&L, Balance
Sheet, Cash Flow, Sales/Purchase/Inventory/Customer/Supplier/Employee/GST Reports —
specs 64–74, eleven screens total) rendered an Export button for but left unwired, per
each spec's own explicit forward-note ("delegates to the not-yet-built Excel Export
feature… button rendered, no file generation wired"). This spec builds **one shared
utility** every one of those eleven screens (and, by extension, any master list that
later wants an Export action, e.g. Products/Customers/Suppliers) calls — not eleven
near-duplicate `.xlsx`-writing implementations. This is exactly the shared-utility
decision `ai-workflow-rules.md`'s Database Workflow / Engine Usage Rules and
`code-standards.md`'s "Never duplicate business logic across modules" call for, and
follows this project's own precedent of extracting a repeated concern into one shared
helper once a second/third consumer is imminent (`assertLedgersAreCashOrBank`,
extracted in `52-payment-voucher.md` the moment Receipt/Contra/Journal Voucher were about
to need the same check a fourth time).

**Library decision.** `package.json` (verified directly, not assumed) has **no** Excel
library installed today — no `exceljs`, `xlsx`, `node-xlsx`, or similar in either
`dependencies` or `devDependencies`. This spec adds **`exceljs`** as a new production
dependency: a well-established, actively-maintained, pure-Node library that reads *and*
writes real `.xlsx` (not just CSV-with-an-.xlsx-extension), runs entirely inside the
Node/Electron process with **no external network call at any point** — satisfying
Offline-First Rules exactly (`ai-workflow-rules.md`: "must never introduce dependencies
that require internet connectivity for… Reports"; the npm install itself needs internet
once, same as every other dependency already in `package.json` — that is a build-time
concern, not a runtime one, and is not what the Offline-First rule restricts). `exceljs`
is also the library `76-excel-import.md` reuses for parsing an uploaded file back in
(it supports both reading and writing, and reads `.csv` too via its own streaming reader —
avoiding a second parsing dependency for that spec).

**Placement decision — `src/lib/`, not `src/engines/reporting/`, and why.** The research
brief's own design guidance floats `src/engines/reporting/excel-export.ts` as a likely
location "since Reports is the primary consumer." This spec deliberately places the
utility at **`src/lib/excel-export.ts`** instead, for a reason worth recording rather than
silently picking either: every existing file under `src/engines/reporting/` (per
`64-trial-balance.md`'s own established convention, reused by `65`–`74`) is a **pure,
stateless, no-I/O shaping function** — it takes already-fetched domain data and produces
a report view-model, nothing else. Excel-writing is the opposite of that: it is pure I/O
(building a workbook buffer), with **zero business/reporting logic** — it does not know
what a Trial Balance or a Product is, only "rows, columns, a sheet name." Placing it
inside `engines/reporting/` would (a) blur that engine's own "pure shaping, no I/O"
identity, and (b) force `76-excel-import.md` (a Masters-module feature with nothing to do
with the Reporting Engine) into an awkward, conceptually-backwards dependency on "the
Reporting Engine" just to write a template file. `src/lib/` is this codebase's own
documented home for cross-cutting utilities (`ai-workflow-rules.md`'s File Creation Rules:
"Utilities → lib/, utils/, hooks/, types/, repositories/, services/"), and is exactly
where a format-agnostic, domain-agnostic writer belongs. Reports remains the *primary*
caller, but not the *owner*.

---

# Project Context

Before implementation, review

- `64-trial-balance.md` (**read in full**) — establishes `src/engines/reporting/` and
  the "pure aggregation, no I/O" engine convention this spec's own utility deliberately
  sits *beside*, not inside; also the concrete shape every financial report already
  produces (`TrialBalanceReport { sections: TrialBalanceSection[]; totalDebit;
  totalCredit }`, and structurally identical shapes in `65`–`67`) that this spec's own
  `ReportExportTable` type must be trivially derivable from.
- `68-sales-reports.md` (skim `# Service / Repository`) — confirms the non-financial
  report shape: flat aggregated rows with named columns (Sales Register, Item-wise Sales,
  Party-wise Sales Summary, Sales Return Summary) — no nested sections, unlike Trial
  Balance's group tree. Both shapes must map onto this spec's one shared contract (see
  Business Rules).
- `70-inventory-reports.md`, `71-customer-reports.md` (skim `# Service / Repository`) —
  confirm the same flat-rows-with-columns shape holds for Inventory/Customer Reports too.
- `74-gst-reports.md` and `58-gstr-1.md` (skim) — **GSTR-1 is the one documented
  exception to a single flat table**: it is a multi-section statutory return (several
  distinct tables — B2B, B2C Large, B2C Small, HSN Summary, etc. — each with its own
  column set, filed as one return). This spec's contract is therefore an **array** of
  named tables per export, not a single table — see Business Rules' multi-sheet support,
  which this exact case drives.
- `26-customer-management.md`/`27-supplier-management.md` — confirms `masters:export`
  is a meaningful, already-seeded permission pair (the full `PERMISSION_MODULES` ×
  `PERMISSION_ACTIONS` cross-product is seeded as the permission catalog by
  `permission-service.ts`'s `buildCatalogPairs()` — confirmed directly from that file —
  so `masters:export` already exists today even though no master list currently renders
  an Export button; this spec's utility is equally usable there, not Reports-exclusive).

---

# Module Responsibilities

The Excel Export module is responsible for

- One shared, pure(ish — see below), reusable function that takes already-computed
  tabular data (rows + column definitions, one or more named tables/sheets) and returns
  an `.xlsx` file `Buffer`
- Formatting conventions applied consistently across every caller: money (integer-paise
  → 2-decimal rupee display), dates, header-row styling, column auto-width, frozen header
  row, and Excel's own 31-character sheet-name limit
- A thin download delivery path (a Next.js Route Handler returning the buffer with the
  correct `Content-Disposition`/MIME headers) every caller's own Export button hits

The Excel Export module is **not** responsible for

- Fetching or computing any report/master data itself — it never imports Prisma, a
  repository, or a service; every caller supplies already-fetched, already-shaped rows
  (the same "pure core, caller owns I/O" posture `voucher-validation.ts` and every
  `src/engines/reporting/*.ts` file already establish, applied here to a *format* utility
  instead of a *business* one)
- Deciding *which* columns a given report exports, or reformatting a report's own
  business figures (rounding, GST classification, sign conventions) — each caller's own
  service/engine already produced the final display-ready values; this utility only
  writes them to a worksheet
- Wiring every one of the eleven Reports-phase screens' own Export buttons end-to-end —
  that retrofit is this spec's primary *justification*, and its own success criteria
  below require wiring at least Trial Balance's screen as the reference implementation,
  but exhaustively retrofitting all eleven screens (and every master list's own Export
  button) in one PR is disproportionate scope for one feature spec; each report screen
  wiring its own Export button through this utility (a small, mechanical, per-screen
  change once this spec ships) is recorded as a named follow-up, not silently assumed
  done
- PDF generation of any kind (`78-pdf-generation.md`'s job — though that spec's own
  report-to-PDF path reuses this spec's `ReportExportTable` contract, see below)
- CSV export (out of scope for this tracker item, which is specifically "Excel Export";
  `exceljs` can trivially also emit CSV later if asked, a cheap follow-up, not built here)

---

# Data Model

**No new Prisma model, enum, or migration.** This is a pure utility with nothing of its
own to persist — no export-history log is introduced (mirroring `76-excel-import.md`'s
identical, explicitly-recorded decision not to persist import history; if a future need
arises for "who exported what, when," that is Pino logging per `code-standards.md`'s
Logging section — "Data Export" is already named there — not a new table).

---

# Business Rules

## The shared contract — `ReportExportTable`

```text
// src/types/report-export.ts — shared by this spec AND 78-pdf-generation.md
interface ReportExportColumn {
  key: string;
  header: string;
  type: "string" | "number" | "currency" | "date" | "percent";
  width?: number;       // character-width hint; auto-computed if omitted
  align?: "left" | "right" | "center"; // defaults by type (currency/number → right)
}

interface ReportExportTable {
  sheetName: string;         // ≤ 31 chars after sanitization — see below
  title?: string;            // optional human-readable title row above the header
  columns: ReportExportColumn[];
  rows: Record<string, string | number | Date | null>[];
  totals?: Record<string, string | number | null>; // optional footer row, keyed like rows
}

type ReportExportInput = ReportExportTable[]; // one workbook, N sheets — GSTR-1's shape
```

- **One table = one worksheet.** A single-table report (Sales Register, Item-wise Sales,
  every flat report in `68`–`73`) exports as a one-element array. Trial Balance/P&L/
  Balance Sheet's grouped-section tree (`64`–`66`) is **flattened by the caller** into
  rows with an explicit "Group"/"Indent Level" column before reaching this utility —
  this spec's contract only understands flat tabular rows plus an optional totals
  footer, never a recursive tree; flattening a presentation tree into export rows is the
  *calling* report's own shaping concern (each report's `src/engines/reporting/*.ts` file
  gains one small `toExportTable(result): ReportExportTable[]` mapping function — still
  inside that report's own pure engine file, never inside this shared utility, which
  stays domain-agnostic).
- **GSTR-1 exports as a multi-sheet workbook** — one `ReportExportTable` per statutory
  section (B2B, B2C Large, B2C Small, HSN Summary, etc.), each its own worksheet, all
  produced by one `bulkExportToExcel(tables)` call — this is precisely why the contract
  is an array from the start, not a single table with an array bolted on as an
  afterthought once GSTR-1 was considered.
- **Sheet name sanitization**: Excel forbids `: \ / ? * [ ]` in a sheet name and caps it
  at 31 characters — the utility truncates/sanitizes `sheetName` defensively (never
  trusting a caller to have already done so) rather than throwing, since a truncated but
  valid sheet name is strictly better than a hard failure on an otherwise-correct export.
- **Currency formatting**: a `type: "currency"` column value is a plain JavaScript
  `number` already converted to rupees by the caller (this utility never receives or
  interprets integer-paise directly — every caller has already done the ÷100 conversion
  the same way it does for on-screen display, per this codebase's money convention) and
  is written with a `#,##0.00` Excel number format, right-aligned.
- **Date formatting**: a `type: "date"` column value is a JS `Date`, written with a
  `DD-MMM-YYYY` Excel number format (this codebase's existing display convention,
  confirmed against the date-format constants already established in
  `04-Local-Storage-&-Desktop-Foundation.md`'s `app-settings.ts`).
- **Header row**: bold, frozen (Excel's "freeze panes" on row 1), one row per table,
  directly above the data rows (below the optional `title` row, if present).
- **Auto column width**: computed from the longer of the header text or a sample of the
  widest cell value, capped at a sane maximum (e.g. 60 characters) so one long free-text
  narration doesn't blow out an entire sheet's layout — an explicit `width` on a column
  definition always wins over the auto-computed value.
- **Large exports**: `exceljs`'s streaming `WorkbookWriter` is used once row counts
  exceed a threshold (e.g. 5,000 rows in a single table) rather than its in-memory
  `Workbook`, keeping `code-standards.md`'s "Report Generation < 5 seconds" target
  achievable for a company with a large ledger/product/customer base; below that
  threshold the simpler in-memory API is used (no premature optimization for the common
  case — YAGNI).
- **No caller-supplied file path or company id anywhere in this utility** — it receives
  only the `ReportExportInput` and returns a `Buffer`; it has no idea which company or
  which user requested it (mirrors the "no `companyId` parameter, no I/O" convention
  `64-trial-balance.md` establishes for `src/engines/reporting/*.ts` — this utility is
  equally free of any tenant awareness, since it never touches the database).

---

# Service / Repository

**No repository — this module owns no table.**

Create

```text
src/lib/excel-export.ts          // exportToExcelBuffer(tables: ReportExportInput): Promise<Buffer>
src/types/report-export.ts       // ReportExportColumn, ReportExportTable, ReportExportInput (shared with 78)
src/app/api/exports/excel/route.ts   // thin download Route Handler, or an equivalent Server Action per caller
```

- `exportToExcelBuffer(tables: ReportExportInput): Promise<Buffer>` — the sole exported
  function most callers need: builds an `exceljs` `Workbook`, one worksheet per
  `ReportExportTable`, applies the formatting rules above, and returns
  `workbook.xlsx.writeBuffer()`'s result as a `Buffer`. No permission check, no
  `companyId`, no Prisma import anywhere in this file — a pure(ish, I/O-bound but
  domain-agnostic) utility function, callable from any module.
- **Each Reports-phase screen's own Server Action** (e.g.
  `src/modules/reports/services/trial-balance-report-service.ts`'s own action layer,
  `64-trial-balance.md`) is the caller: it re-checks `reports:export` (or
  `masters:export` for a future master-list caller) permission, calls its own
  `buildTrialBalanceReport`/`toExportTable` mapping, then `exportToExcelBuffer`, then
  returns the buffer to the client for download — **this spec's utility never checks a
  permission itself**, consistent with the "engines/utilities don't gate, callers gate"
  convention `31-voucher-engine.md` and `64-trial-balance.md` both already establish.
- Delivery: either a small dedicated Route Handler per report (`/api/exports/excel?
  report=trial-balance&…`) re-validating the same filters/permissions the report screen
  itself already validates, or a Server Action returning the buffer as a base64/blob for
  client-side download — implementer's choice per screen, as long as the permission
  re-check happens server-side before `exportToExcelBuffer` is ever called (never
  client-trusted). A generic, reusable `<ExportButton report="trial-balance" filters=
  {…}/>` component (`src/components/reports/export-button.tsx` or similar) is the
  natural shared UI piece every one of the eleven screens' own forward-noted Export
  button becomes, once wired.

---

# Validation

No new Zod schema of its own for the export payload shape (`ReportExportTable` is a
TypeScript contract between trusted, already-validated internal callers, never a
client-supplied shape — the client never POSTs rows to be exported; it only requests
"export what I'm currently viewing," and the server re-derives the rows itself from the
already-validated report filters). Each caller's **own existing** filter validation
(e.g. `financial-report-filters-schema.ts`, `64-trial-balance.md`) is what actually
gates what data reaches this utility — this spec adds no new input surface.

---

# UI

No new page route — this is a utility consumed by existing/forthcoming screens' own
Export buttons.

- Provide a small shared `<ExportButton>` component (`src/components/reports/` or
  `src/components/shared/`) that every Reports-phase screen's own forward-noted Export
  button becomes, once wired — triggers the download, shows a loading state for a large
  export, and surfaces a friendly error toast on failure (never a raw exception).
- **Reference wiring, done as part of this spec**: Trial Balance's (`64-trial-balance.md`)
  own Export button is wired end-to-end as the reference implementation, proving the
  utility against a real, grouped-section report (the more complex of the two shapes —
  flat report wiring is strictly simpler and left as each report's own small follow-up,
  named explicitly in Do Not, not silently assumed complete).

---

# Security

No new permission module or action. Every export is gated by the **calling** screen's own
existing permission — `reports:export` for every Reports-phase screen (already seeded,
already assigned to the Accountant/Sales/Purchase/Store Manager reserved roles per
`src/constants/permissions.ts`'s `DEFAULT_ROLE_PERMISSIONS`), or `masters:export` for a
future master-list Export button (already a valid, already-seeded permission pair per the
full `PERMISSION_MODULES` × `PERMISSION_ACTIONS` catalog cross-product — confirmed from
`permission-service.ts`). This spec's own `src/lib/excel-export.ts` performs **no
permission check whatsoever** — it is a pure format utility with no concept of a
requesting user, exactly like `voucher-validation.ts` has no concept of who is posting a
voucher. Every caller must re-check its own permission before invoking this utility;
never assume the existence of a rendered Export button implies authorization.

---

# Database

No new model, enum, or migration. See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, zero business/domain logic inside `src/lib/excel-export.ts`
(a structural test/lint convention: this file must never import from `src/modules/**` or
`@prisma/client`), vitest coverage for:

- `exportToExcelBuffer` produces a valid `.xlsx` buffer (parseable by `exceljs` itself,
  read back and asserted against) for a single-table input and for a multi-table
  (GSTR-1-shaped) input, with one worksheet per table in the given order
- Currency columns render with 2-decimal formatting from a plain rupee `number` input
  (never receiving/interpreting integer-paise directly — a type-level and runtime
  assertion)
- Sheet-name sanitization: a name exceeding 31 characters or containing a forbidden
  character is truncated/sanitized rather than throwing
- The optional `totals` footer row, when present, renders as the last row of its sheet
  with matching column keys
- Auto column width computes a sane value from header/sample-cell length when no
  explicit `width` is given, and respects an explicit `width` when one is given
- A large (>5,000-row) single table uses the streaming writer path without exceeding a
  bounded memory/time budget in a fixture test (a coarse regression guard, not a
  precise performance benchmark)

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration (including an export-history log — a
  deliberate, recorded omission, mirroring `76-excel-import.md`)
- Any permission check inside `src/lib/excel-export.ts` itself — every caller gates its
  own export action
- Any business/report-shaping logic inside the shared utility (grouping, rounding, GST
  classification, sign conventions) — every caller supplies final, display-ready values
- CSV export (out of scope for this tracker item — `exceljs` can add it cheaply later if
  asked)
- Wiring every one of the eleven Reports-phase screens' own Export button end-to-end in
  this same spec (Trial Balance is the required reference wiring; the remaining ten are
  each a small, named, mechanical follow-up — see UI)
- Placing this utility inside `src/engines/reporting/` (see Goal's Placement decision and
  reasoning)

---

# Success Criteria

Verify

- `exportToExcelBuffer` produces a correct, valid `.xlsx` file for both a flat single-
  table report shape and a GSTR-1-style multi-table shape, with correct currency/date
  formatting, a bold frozen header row, and sane auto column widths.
- Trial Balance's Export button (`64-trial-balance.md`) is wired end-to-end through this
  utility as the reference implementation and produces a correct, downloadable
  `.xlsx` matching the on-screen report.
- `src/lib/excel-export.ts` contains zero imports from any `src/modules/**` path or
  `@prisma/client` — a structural check, not just a stated intention.
- `package.json` gains `exceljs` as a new dependency; no other new dependency is added.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 77 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #75.
Feature-spec 76 (Excel Import, tracker #74) consumes this spec's utility for its Template
Download and Error Report Download. Feature-spec 78 (PDF Generation, tracker #76) reuses
this spec's `ReportExportTable`/`ReportExportInput` contract (`src/types/report-export.ts`)
as the input shape for its own report-to-PDF rendering path.
