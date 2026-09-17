# 103 - PDF Engine Migration (Replace Puppeteer)

> Feature-spec file number 103 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 3 — Architecture
> Hardening**, tracker item **#94 PDF Engine Migration**.
>
> Depends On: PDF Generation (v2 spec 78).
> This spec removes Puppeteer from the project entirely.

## Goal

Replace Puppeteer + Chromium with `@react-pdf/renderer` for all PDF generation.

This reduces the Electron installer size by approximately 200MB, eliminates headless
browser CI flakiness, removes the OS-update breakage risk (Chromium API changes),
and improves PDF generation performance from ~2s to ~100ms.

---

## Project Context

Read before implementation:

1. `context/feature-specs/78-pdf-generation.md` — v2 PDF generation spec; the existing
   Puppeteer-based approach is replaced entirely by this spec.
2. `context-v3/code-standards.md` — PDF Standards section.
3. `context-v3/ui-context.md` — no visual changes to the invoice layout required;
   the new template must match the existing template's layout as closely as possible.
4. `electron/main.ts` — the `pdf:generate` IPC handler is replaced here.

---

## Module Responsibilities

- Remove `puppeteer` from `package.json` and all Electron externals config
- Remove `.puppeteerrc.cjs` from the project root
- Install `@react-pdf/renderer`
- Rewrite the Sales Invoice PDF template as a `@react-pdf/renderer` component tree
  (`src/modules/sales-invoices/pdf/SalesInvoicePdf.tsx`)
- Replace the Electron IPC `pdf:generate` handler
- Register Geist font with `Font.register()` (matching the existing font in the HTML template)
- End-to-end test: generate a PDF from a real invoice and verify it is non-empty

---

## Template Requirements

The new `@react-pdf/renderer` template must produce output that matches the existing
Puppeteer-generated invoice visually. Required sections:

1. **Header**: company name + address + logo, "TAX INVOICE" title, invoice number, date
2. **Customer block**: bill-to and ship-to addresses
3. **E-Invoice block**: IRN (if present), QR code image (if present) — spec 94 output
4. **Line items table**: S.No., Product, HSN, Qty, Unit, Rate, Disc%, Taxable, GST%, GST, Total
5. **GST summary**: CGST/SGST/IGST/CESS breakdown table
6. **Totals**: subtotal, total GST, round-off, grand total (in words)
7. **Payments**: payment mode breakdown
8. **Footer**: authorized signatory, "This is a computer-generated invoice"

---

## Migration Steps

1. Install `@react-pdf/renderer` and `@react-pdf/types`.
2. Remove `puppeteer` from `package.json`; run `pnpm install`.
3. Remove `.puppeteerrc.cjs`.
4. Remove Puppeteer references from `next.config.ts` externals and `electron/server.ts`.
5. Register Geist and Geist Mono fonts via `Font.register()` from the local font files.
6. Build `SalesInvoicePdf.tsx` matching the section list above.
7. Replace `electron/main.ts`'s `pdf:generate` IPC handler with `renderToBuffer()`.
8. Run the full test suite — no Puppeteer tests should remain.
9. Generate a sample invoice PDF and review visually before merging.

---

## Business Rules

1. The new PDF must be generated without launching any browser process.
2. All font glyphs used in Indian invoice content (₹ symbol, Devanagari if present)
   must be available in the registered font files.
3. PDF page size: A4 portrait (210mm × 297mm).
4. QR code from E-Invoice: rendered as a PNG image embedded in the PDF using
   `<Image>` from `@react-pdf/renderer` — the `signedQrCode` string is a
   base64-encoded PNG or a URL to a rendered QR image.

---

## Validation Rules

- `renderToBuffer()` must return a `Uint8Array` with length > 0.
- The PDF must pass a basic "is it a valid PDF" check (starts with `%PDF-1.`).

---

## Testing Requirements

- Snapshot test: `renderToBuffer()` on a known invoice produces a non-empty buffer
- Font registration smoke test: buffer does not contain "Helvetica" (the react-pdf
  fallback — if it appears, the font registration failed)
- Visual review: reviewer must open the generated PDF and confirm layout matches
  the previous Puppeteer output before the PR is merged
