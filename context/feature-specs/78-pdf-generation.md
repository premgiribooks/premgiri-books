# 78 - PDF Generation

> Feature-spec file number 78 (spec-file numbers are sequential and never reused — the
> highest prior file was `77-excel-export.md`, drafted in this same batch). This feature
> is `context/Phases/phase-tracker.md`'s **Phase 11 — Productivity Features** item **#76
> PDF Generation**. Depends on Reports (Phase 10, feature-specs 64–74) for its report-to-
> PDF half. Documentation only, drafted 2026-09-11 — nothing in this spec is implemented
> yet. **Read `77-excel-export.md` in full before implementing** — this spec reuses its
> `ReportExportTable`/`ReportExportInput` contract (`src/types/report-export.ts`) for the
> report-to-PDF half, and its "utility has no permission awareness, callers gate" and
> "utility knows nothing about the database" conventions for both halves.

## Goal

Implement **PDF Generation** for **Premgiri Books ERP**. Unlike Excel Export (one need,
one shape), this tracker item is genuinely **two different needs that happen to share an
underlying renderer** — scoped explicitly as two halves, per the research brief's own
framing:

**(a) Document/voucher printing.** Every Sales-side document in Phase 3
(`35-quotations.md` through `41-debit-note.md`) explicitly deferred "Printing, PDF
generation, or WhatsApp sharing" with the identical phrase "project-overview.md lists
these as Phase [11] features" (confirmed by grep across the batch — `35`, `36`, `37`,
`39`, `40`, `41` all carry this exact deferral). **The one exception**: Sales Invoice
(`38-sales-invoice.md`) already shipped a browser-only **Print View** — a plain
`window.print()`-triggered, A4/A5 print-stylesheet layout, explicitly "no PDF library, no
[…]" — because a tax invoice is the one document in that phase a business must legally
hand to a customer *today*, before this spec exists. Phase 4's Purchase-side documents
split the same way: Purchase Order/Goods Receipt Note/Purchase Return defer identically
("same deferral posture as Phase 3"), while **Purchase Invoice explicitly opts out of
printing altogether**, permanently, as its own deliberate business decision — "a supplier
bill is not a document this system prints and hands out," not a deferral to this phase.
This spec's document-printing half therefore delivers real, downloadable PDF generation
for: **Quotation, Sales Order, Delivery Challan, Sales Invoice (upgrading its existing
browser-print-only screen), Sales Return, Credit Note, Debit Note, Purchase Order, Goods
Receipt Note, Purchase Return** — and explicitly **excludes Purchase Invoice**, per that
spec's own permanent decision, not an oversight of this one.

**(b) Report-to-PDF export.** The identical forward-note Excel Export (`77-excel-
export.md`) resolves for `.xlsx` — every one of Phase 10's eleven report screens
(`64`–`74`) rendered an Export button with "no file generation wired," and PDF is the
second of the two formats those buttons need (a Trial Balance handed to an auditor, or a
GSTR-1 filed on paper, is at least as often wanted as a PDF as an Excel file).

**The shared-vs-separate-renderer decision, made explicitly.** Both halves render through
**one shared HTML-to-PDF core** (`renderHtmlToPdf(html, options): Promise<Buffer>`,
`src/lib/pdf-generation.ts`) rather than two independent PDF code paths, because both
needs reduce to the same underlying operation: turn styled HTML into a paginated PDF.
What is **not** shared is the literal React component tree: Sales Invoice's existing
Print View (`38-sales-invoice.md`) is a `"use client"` component built around the
browser's own `window.print()` — it is not, and should not be made, server-renderable
just to satisfy this spec (that would be a real, invasive refactor of an already-shipped,
already-tested screen for marginal benefit — `ai-workflow-rules.md`'s Refactoring Rules:
"avoid unnecessary rewrites"). Instead, **visual consistency is achieved through a shared
print stylesheet, not a shared component tree**: this spec extracts (or, if
`38-sales-invoice.md`'s implementation has not yet produced one, introduces)
`src/styles/print.css` — the A4/A5 rules `ui-context.md`'s Printing section already
names — and both the existing client Print View *and* this spec's new server-rendered
HTML templates apply the same stylesheet, giving a Sales Invoice's on-screen Print
Preview and its downloaded PDF an identical look without requiring one to literally
render the other's component code.

**Library decision.** `package.json` has no PDF library today (verified directly). This
spec adds **Puppeteer** (a headless-Chromium-driven Node library) rather than a pure-JS
PDF-primitive library (`pdfmake`, `@react-pdf/renderer`), specifically *because* the
shared-renderer decision above requires rendering real HTML+CSS (the shared
`print.css`) — a primitive-based library would force every document/report layout to be
re-expressed a second time in that library's own drawing API, duplicating presentation
logic exactly where this spec's whole point is to avoid it. Puppeteer's headless
Chromium runs entirely locally once installed (the npm install step needs internet once,
identically to every other dependency already in `package.json` — not a runtime
dependency, and not what Offline-First Rules restrict) and produces the PDF with no
external network call at generation time, satisfying `ai-workflow-rules.md`'s Offline
First Rules for "Printing." **Electron's own bundled Chromium (`webContents.printToPDF`)
was considered and rejected for this spec**: that API exists only on the Electron
**main process**, and this codebase's Next.js server (where every Route Handler/Server
Action, including this feature's, runs) is a **separate process** from Electron's main
process even in this project's own dev scripts (`package.json`'s `dev:electron` waits on
the Next.js dev server as an independent process before opening a window onto it) — using
it would require inventing a new, currently-nonexistent IPC bridge between the two
processes for this feature alone, a materially larger and more coupling-prone design than
a self-contained, portable, purely-server-side renderer that works identically whether
the app is opened through the Electron shell or (e.g. during development) a plain browser
tab.

---

# Project Context

Before implementation, review

- `77-excel-export.md` (**read in full**) — the `ReportExportTable`/`ReportExportInput`
  contract this spec's report-to-PDF half consumes verbatim, and the "utility has no
  permission awareness / no I/O / no companyId" conventions this spec's own
  `src/lib/pdf-generation.ts` follows identically.
- `38-sales-invoice.md` (**read in full**) — the existing browser Print View this spec
  upgrades with a true downloadable PDF (kept alongside, not removed — see UI), and the
  A4/A5 print-stylesheet convention (`ui-context.md`) this spec's shared `print.css`
  formalizes into a real, reusable file if one does not already exist.
  `35-quotations.md`, `36-sales-orders.md`, `37-delivery-challans.md`,
  `39-sales-return.md`, `40-credit-note.md`, `41-debit-note.md`, `42-purchase-orders.md`,
  `43-goods-receipt-note.md`, `45-purchase-return.md` (skim each's own deferred-printing
  note and header-field shape — each becomes a document-PDF template in this spec).
- `44-purchase-invoice.md` (skim) — confirms the explicit, permanent "no printing" scope
  exclusion this spec respects rather than silently overriding.
- `ui-context.md` (Printing section: Reports A4 Portrait, Invoices A5/A4, Thermal future
  support, "All printed documents should have print-specific styles") — the paper-size
  convention this spec's `PdfOptions` (`format: "A4" | "A5"`) implements directly.
- `64-trial-balance.md` and `68-sales-reports.md` (skim, if not already fresh from
  `77-excel-export.md`) — confirm the flat/grouped report shapes this spec's report-to-
  PDF templates render from the shared `ReportExportTable` contract, not a second,
  independently-derived shape.

---

# Module Responsibilities

The PDF Generation module is responsible for

- One shared, domain-agnostic HTML-to-PDF core (`renderHtmlToPdf`)
- **Document PDFs**: a template function per in-scope document type
  (`buildQuotationHtml`, `buildSalesOrderHtml`, `buildDeliveryChallanHtml`,
  `buildSalesInvoiceHtml`, `buildSalesReturnHtml`, `buildCreditNoteHtml`,
  `buildDebitNoteHtml`, `buildPurchaseOrderHtml`, `buildGoodsReceiptNoteHtml`,
  `buildPurchaseReturnHtml`) that each render that document's own already-fetched data
  (via that document's own existing `get`/`getById` service method) into HTML sharing
  `src/styles/print.css`, then through `renderHtmlToPdf`
- **Report PDFs**: one generic template function (`buildReportHtml(tables:
  ReportExportInput): string`) rendering the shared `ReportExportTable` contract
  (`77-excel-export.md`) into a printable HTML table, then through the same
  `renderHtmlToPdf` — reused by every one of the eleven Reports-phase screens' own PDF
  Export button
- A thin download delivery path per document/report screen's own Server Action or Route
  Handler (mirroring `77-excel-export.md`'s delivery pattern exactly)

The PDF Generation module is **not** responsible for

- Fetching or computing any document/report data itself — every template function
  receives already-fetched, already-validated data from its owning module's own existing
  service (a document PDF template never queries Prisma; a report PDF template never
  re-derives report figures — both consume finished view-models exactly as
  `77-excel-export.md`'s utility does)
- Purchase Invoice printing (explicitly excluded — see Goal)
- WhatsApp sharing, email delivery, or any distribution mechanism beyond a downloadable
  file (every Phase 3/4 document spec deferred "Printing, PDF generation, or WhatsApp
  sharing" together; WhatsApp/email sharing remains deferred beyond this spec, which
  resolves only the PDF-generation third of that list — a separately scoped feature if
  ever built, not silently folded in here)
- Rewriting or removing Sales Invoice's existing browser Print View (`38-sales-invoice.md`)
  — it stays, unmodified, as a fast, no-download, on-screen preview/print option; this
  spec adds a **second**, complementary "Download PDF" action beside it, sharing only the
  stylesheet
- Barcode/label printing (Barcode Billing, tracker #77, a sibling spec in this same
  phase, drafted separately — thermal/label printing is explicitly out of scope here,
  `ui-context.md`'s "Thermal — Future support" line names it as a distinct future
  concern, not this spec's A4/A5 document printing)

---

# Data Model

**No new Prisma model, enum, or migration.** Every document PDF reads an already-posted
document through that document's own existing, unmodified service method; every report
PDF reads through that report's own existing, unmodified service/engine. This is a pure
rendering feature — no new state, no export-history log (identical, deliberately recorded
omission to `76-excel-import.md`/`77-excel-export.md`; Pino logging under
`code-standards.md`'s "Data Export" line covers the operational trail).

---

# Business Rules

## Shared core contract

```text
// src/lib/pdf-generation.ts
interface PdfOptions {
  format: "A4" | "A5";                 // ui-context.md's paper-size convention
  orientation?: "portrait" | "landscape"; // reports default portrait; documents default portrait
  margin?: { top: string; right: string; bottom: string; left: string };
  headerHtml?: string;                 // optional running header (e.g. page N of M)
  footerHtml?: string;
}

function renderHtmlToPdf(html: string, options: PdfOptions): Promise<Buffer>;
```

- `renderHtmlToPdf` launches a Puppeteer headless browser instance, sets the given HTML
  as page content (`page.setContent(html, { waitUntil: "networkidle0" })` — no external
  resource is ever fetched, since every template embeds its own inline/base64 assets —
  see Assets below), calls `page.pdf({ format, ...options })`, closes the browser, and
  returns the resulting buffer. **No permission check, no `companyId`, no Prisma import,
  no business logic of any kind** in this file — identical posture to
  `src/lib/excel-export.ts` (`77-excel-export.md`).
- **Browser instance lifecycle**: a single Puppeteer instance is reused across requests
  within one server process (launched lazily on first use, kept warm) rather than
  launched-and-closed per PDF — Chromium cold-start cost is real (typically 200–500ms)
  and would otherwise threaten `code-standards.md`'s "Report Generation < 5 seconds"
  target on every single export; a launched instance is closed only on process shutdown.
  A **page** (tab), not the browser instance itself, is created and closed per render
  call, so concurrent PDF requests do not share mutable page state.
- **Assets**: the Company Logo (`architecture-context.md`'s Local File Storage — already
  a stored file reference) is embedded as a base64 data URI inside the generated HTML,
  never referenced by an external/local file `<img src>` URL Puppeteer would need to
  resolve separately — keeping the whole render self-contained and avoiding any
  filesystem-path assumption this spec would otherwise have to make about where Company
  Logos live on disk.

## Document PDFs

- Each `build*Html(document)` template function takes the document's own already-loaded,
  already-validated data (loaded by that document's own existing `get`/`getById` service
  method — e.g. `salesInvoiceService.getSalesInvoice(companyId, id)`) and renders a plain
  HTML string mirroring that document's own header/line-items/totals layout, styled by
  the shared `src/styles/print.css`. **No new business computation** — every figure shown
  (taxable amount, GST breakup, grand total) is read verbatim from the already-posted
  document, exactly as `38-sales-invoice.md`'s own existing Print View already does for
  Sales Invoice.
- **Purchase Invoice is excluded by name** — no `buildPurchaseInvoiceHtml` function
  exists, and no PDF/print action is added to its detail screen, per that spec's own
  permanent decision (see Goal).
- **Paper size**: Invoices/documents default to `A5` per `ui-context.md`'s "Invoices A5 /
  A4" convention (implementer/company-setting choice between the two, mirroring
  whatever choice `38-sales-invoice.md`'s own Print View already made — confirm and
  match at implementation time rather than silently picking a different default).

## Report PDFs

- `buildReportHtml(tables: ReportExportInput): string` renders the **identical**
  `ReportExportTable[]` contract `77-excel-export.md` defines — one HTML `<table>` per
  input table (GSTR-1's multi-section shape becomes multiple sequential tables, each
  under its own section heading, in **one** PDF rather than `77`'s one-workbook-many-
  sheets equivalent — a PDF has no "sheet" concept, so GSTR-1's sections render as
  successive same-document sections instead, page-broken where natural). The *same*
  report-shaping call each report's own Reporting Engine file already produces for Excel
  Export (`toExportTable(result): ReportExportTable[]`, `77-excel-export.md`) is reused
  verbatim for its PDF Export button too — **one shaping function, two rendering targets
  (`.xlsx` via `exportToExcelBuffer`, `.pdf` via `buildReportHtml` +
  `renderHtmlToPdf`)**, never two independently-derived row sets for the same report.
- **Paper size**: reports default to `A4` portrait per `ui-context.md`'s "Reports — A4
  Portrait" convention.
- **Reference wiring, done as part of this spec**: Trial Balance's own PDF Export button
  is wired end-to-end as the reference implementation (the same reference-screen choice
  `77-excel-export.md` makes for its own Excel Export button) — the remaining ten report
  screens' own PDF wiring is a small, mechanical, named follow-up per screen, not silently
  assumed complete by this spec alone.

---

# Service / Repository

**No repository — this module owns no table.**

Create

```text
src/lib/pdf-generation.ts                    // renderHtmlToPdf, shared Puppeteer lifecycle
src/lib/pdf-templates/report-pdf-template.ts // buildReportHtml(tables: ReportExportInput)
src/modules/sales-invoices/pdf/sales-invoice-pdf.ts     // buildSalesInvoiceHtml
src/modules/quotations/pdf/quotation-pdf.ts             // buildQuotationHtml
src/modules/sales-orders/pdf/sales-order-pdf.ts         // buildSalesOrderHtml
src/modules/delivery-challans/pdf/delivery-challan-pdf.ts // buildDeliveryChallanHtml
src/modules/sales-returns/pdf/sales-return-pdf.ts       // buildSalesReturnHtml
src/modules/credit-notes/pdf/credit-note-pdf.ts         // buildCreditNoteHtml
src/modules/debit-notes/pdf/debit-note-pdf.ts           // buildDebitNoteHtml
src/modules/purchase-orders/pdf/purchase-order-pdf.ts   // buildPurchaseOrderHtml
src/modules/goods-receipt-notes/pdf/goods-receipt-note-pdf.ts // buildGoodsReceiptNoteHtml
src/modules/purchase-returns/pdf/purchase-return-pdf.ts // buildPurchaseReturnHtml
src/styles/print.css                          // shared by client Print Views and these templates
```

- Each document's own `pdf/` sub-folder (not a separate top-level `pdf-generation`
  module owning ten near-duplicate templates) keeps each template physically beside the
  document module whose data shape it renders — mirroring how `77-excel-export.md`'s own
  reference wiring lives inside `64-trial-balance.md`'s own reporting module, not inside
  the shared utility itself. `src/lib/pdf-generation.ts` and
  `src/lib/pdf-templates/report-pdf-template.ts` are the only two genuinely shared,
  domain-agnostic files.
- Each document's own Server Action calls its own service's existing `get` method, its
  own `build*Html` template, then `renderHtmlToPdf` — identical three-step shape to
  `77-excel-export.md`'s own report-export Server Action pattern, applied to documents
  instead of reports.
- `buildReportHtml` lives once, shared by every report screen's own PDF Export button —
  never duplicated per report.

---

# Validation

No new Zod schema for the render payload itself (a PDF template function receives an
already-validated, already-loaded document/report object, never client input directly —
identical posture to `77-excel-export.md`). Each caller's **own existing** id/filter
validation (e.g. `salesInvoiceService.getSalesInvoice`'s own not-found/cross-company
handling, or a report's own filter schema) is what gates what data reaches a template
function — this spec introduces no new input surface.

---

# UI

No new page route for reports (their existing screens gain a second Export action
alongside the Excel one). For documents, each in-scope document's own existing detail
screen gains a **"Download PDF"** action:

- Sales Invoice (`38-sales-invoice.md`): the existing Print action stays as-is (fast,
  no-download, on-screen preview via `window.print()`); a new, separate "Download PDF"
  action beside it calls this spec's `buildSalesInvoiceHtml` + `renderHtmlToPdf` path.
- Quotation, Sales Order, Delivery Challan, Sales Return, Credit Note, Debit Note,
  Purchase Order, Goods Receipt Note, Purchase Return: each gains its **first** printing
  capability of any kind via a single "Download PDF" action on its own detail screen
  (these nine had no browser-print exception the way Sales Invoice did — this spec is
  their first printing capability, not an upgrade of an existing one).
- Purchase Invoice: **no action added** — confirmed exclusion, see Goal.
- Every Reports-phase screen (`64`–`74`) gains a "Download PDF" action beside its
  (already-specified, `77-excel-export.md`) "Download Excel" action — both driven by the
  same `<ExportButton>`-style shared component, offering a format choice
  (Excel/PDF) rather than two visually separate buttons, for a consistent Export
  affordance across every report screen.

Components: `src/styles/print.css` (shared stylesheet — introduced by this spec if
`38-sales-invoice.md`'s own implementation has not already produced an equivalent shared
file; reused, not duplicated, if it has), a small `<DownloadPdfButton>` shared component
mirroring `77-excel-export.md`'s `<ExportButton>` shape.

Wire-up

- Add a "Download PDF" button to each in-scope document's own existing detail page.
- Extend the shared report `<ExportButton>` (`77-excel-export.md`) with a format choice
  (Excel/PDF) rather than introducing a second, separate button component.
- No new breadcrumb entries — every action lives on an existing document/report detail
  page, not a new route.

---

# Security

No new permission module or action. Document PDFs are gated by that document's own
existing `view` permission (the same permission that already gates seeing the detail
page a "Download PDF" button lives on — e.g. `sales:view` for Sales Invoice/Quotation/
Sales Order/Delivery Challan/Sales Return/Credit Note/Debit Note, `purchase:view` for
Purchase Order/Goods Receipt Note/Purchase Return); report PDFs are gated by
`reports:export`, identically to `77-excel-export.md`'s own Excel path. `src/lib/pdf-
generation.ts` and `src/lib/pdf-templates/report-pdf-template.ts` perform **no
permission check whatsoever** — every caller re-checks its own permission before
invoking either, the same convention `77-excel-export.md` establishes for
`exportToExcelBuffer`.

---

# Database

No new model, enum, or migration. See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, zero business/domain computation inside `src/lib/pdf-
generation.ts` or `report-pdf-template.ts` (a structural check: neither file imports from
`src/modules/**` or `@prisma/client`), vitest coverage for:

- `renderHtmlToPdf` produces a valid, non-empty PDF buffer (asserted by a magic-byte/
  header check, e.g. `%PDF-`) for a minimal HTML fixture, for both `A4` and `A5` `format`
  options
- `buildReportHtml` renders one HTML table per input `ReportExportTable`, in order,
  including a multi-table (GSTR-1-shaped) fixture, and renders an optional `totals`
  footer row when present
- Each document's own `build*Html` template renders every field its document's own spec
  requires on a printed document (invoice/order number, party name, line items, totals) —
  a snapshot-style structural test per template, not a pixel-level visual test (no such
  infra exists in this codebase, per the precedent `56-product-detail-page.md`'s own
  known-deviation note already recorded for page-level UI testing)
- No `buildPurchaseInvoiceHtml` function or PDF/print UI action exists anywhere for
  Purchase Invoice (an explicit negative test/lint-style assertion, protecting against a
  future accidental re-introduction of printing for that document)
- The Puppeteer browser instance is reused across sequential render calls within one
  process rather than relaunched each time (a coarse regression guard on the lifecycle
  decision, not a precise timing benchmark)

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration (including a PDF-export-history log — a
  deliberate, recorded omission, mirroring `76`/`77`)
- Printing or PDF generation for Purchase Invoice (explicitly, permanently excluded per
  that spec's own decision)
- WhatsApp sharing, email delivery, or any distribution channel beyond a downloadable
  file (still deferred beyond this spec)
- Barcode/thermal label printing (a sibling spec's concern, tracker #77)
- Removing or rewriting Sales Invoice's existing browser Print View — it stays,
  unmodified, alongside this spec's new "Download PDF" action
- Electron main-process `webContents.printToPDF` or any new Electron IPC bridge for this
  feature (see Goal's library decision and reasoning)
- Any permission check inside `src/lib/pdf-generation.ts` or `report-pdf-template.ts` —
  every caller gates its own action
- A second, independently-derived row-shaping path for report PDFs — `buildReportHtml`
  consumes the exact same `ReportExportTable[]` each report's own Reporting Engine file
  already produces for Excel Export, never a parallel PDF-specific aggregation

---

# Success Criteria

Verify

- `renderHtmlToPdf` produces a valid PDF buffer for both `A4` and `A5` formats from a
  styled HTML fixture.
- Sales Invoice's detail screen gains a working "Download PDF" action alongside its
  existing, unmodified browser Print action, both visually consistent via the shared
  `print.css`.
- Quotation, Sales Order, Delivery Challan, Sales Return, Credit Note, Debit Note,
  Purchase Order, Goods Receipt Note, and Purchase Return each gain a working "Download
  PDF" action on their own detail screens; Purchase Invoice gains none.
- Trial Balance's PDF Export button is wired end-to-end as the reference report
  implementation, rendering the same `ReportExportTable` data its Excel Export button
  (`77-excel-export.md`) already renders, via `buildReportHtml`.
- `src/lib/pdf-generation.ts` and `src/lib/pdf-templates/report-pdf-template.ts` contain
  zero imports from `src/modules/**` or `@prisma/client`.
- `package.json` gains `puppeteer` as a new dependency; no other new PDF-related
  dependency is added.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 78 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #76 —
the last of this batch's four data/export specs (75–78). Feature-spec 77 (Excel Export,
tracker #75) provides the `ReportExportTable`/`ReportExportInput` contract this spec's
report-to-PDF half reuses verbatim.
