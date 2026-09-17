# 94 - E-Invoice (IRN + QR Code)

> Feature-spec file number 94 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 2 — Compliance &
> Commercial**, tracker item **#85 E-Invoice**.
>
> From April 2023, e-invoicing (generating an Invoice Reference Number via the NIC/IRP
> portal) is mandatory in India for businesses above ₹5 Cr annual turnover. This spec
> integrates IRN generation into the Sales Invoice posting flow.
>
> Depends On: Sales Invoice (v2 #36, spec 38); GST Engine (v2 #31, spec 33).
> E-Way Bill (spec 95) depends on this spec.

## Goal

After a Sales Invoice is posted, automatically submit invoice data to the NIC Invoice
Registration Portal (IRP) and receive:

- An **IRN** (Invoice Reference Number — 64-character hash)
- An **Acknowledgement Number** and **Acknowledgement Date**
- A **Signed QR Code** string

The QR code is embedded in the Sales Invoice PDF alongside the invoice number.

This must be **non-blocking**: if the NIC API is unreachable or returns an error,
the Sales Invoice posts successfully and is flagged `eInvoiceStatus: PENDING` for
manual retry. The business continues operating.

---

## Project Context

Read before implementation:

1. `context/feature-specs/38-sales-invoice.md` — the Sales Invoice spec; IRN generation
   is a post-posting step, never inside the DB transaction.
2. `context/feature-specs/33-gst-engine.md` — `determineSupplyType()` and `calculateLine()`
   produce the GST data sent to the IRP.
3. `context-v3/architecture-context.md` — Decision 4 (E-Invoice / E-Way Bill).
4. `context-v3/code-standards.md` — External Integration Standards section.
5. NIC Sandbox API documentation: https://einvoice1.gst.gov.in (sandbox environment
   credentials required from GST portal before implementation).

---

## Module Responsibilities

- `ExternalIntegrationsEngine` (`src/engines/external-integrations/`) — new engine;
  wraps NIC API calls; no dependency on Voucher/Inventory/GST engines
- `eInvoiceService` — maps a posted `SalesInvoice` to NIC API payload; calls the engine;
  persists IRN/QR to the invoice row
- `CompanySettings` — new fields: `eInvoiceEnabled`, `nirpUsername`, `nirpPassword`,
  `nirpClientId`, `nirpClientSecret` (encrypted at rest per spec 101)
- `SalesInvoice` schema amendment — new columns for IRN status, IRN, QR code
- Retry UI — "Generate IRN" button on the Sales Invoice detail page for PENDING invoices
- QR code on the PDF template (spec 103 PDF migration lands first; if not yet merged,
  use the existing Puppeteer path)

---

## Data Model

```prisma
enum EInvoiceStatus {
  NOT_APPLICABLE   // company not E-Invoice eligible, or B2C invoice
  PENDING          // posting succeeded, IRN generation failed/not yet tried
  GENERATED        // IRN successfully received from IRP
  CANCELLED        // IRN cancelled via IRP (within 24-hour window)
}

// Add to SalesInvoice:
  eInvoiceStatus  EInvoiceStatus @default(NOT_APPLICABLE)
  irn             String?        // 64-char IRP hash
  ackNumber       String?
  ackDate         DateTime?
  signedQrCode    String?        @db.Text
  eInvoicedAt     DateTime?
```

---

## Business Rules

1. E-Invoice is attempted only if `CompanySettings.eInvoiceEnabled = true` AND the
   invoice is B2B (has a valid customer GSTIN) AND the invoice is posted.
2. E-Invoice generation happens **after** the DB transaction commits, never inside it.
3. If the NIC API call fails (any error), set `eInvoiceStatus = PENDING` and log the
   error to Pino — do not fail the posting.
4. An IRN, once generated, cannot be edited. Cancellation requires calling the NIC
   cancel API within 24 hours of generation.
5. An E-Invoice-cancelled Sales Invoice cannot be reposted — the user must create a
   new invoice.
6. The IRN is displayed on the Sales Invoice detail page and in the PDF header.

---

## Validation Rules

- `nirpUsername` / `nirpPassword` are required if `eInvoiceEnabled = true` —
  validated in Company Settings form before enabling.
- The NIC API payload must include: seller GSTIN, buyer GSTIN, invoice date, invoice
  number, line items with HSN + rate + GST amounts, grand total.
- HSN code is mandatory on every line for E-Invoice — enforced at DRAFT save when
  `eInvoiceEnabled = true`, not only at posting.

---

## API / Server Actions

- `eInvoiceActions.generateIrn(invoiceId)` — called after posting; also callable
  manually for PENDING invoices
- `eInvoiceActions.cancelIrn(invoiceId, reason)` — calls NIC cancel API; sets status
  to CANCELLED
- `companySettingsActions.saveEInvoiceSettings(input)` — saves NIRP credentials

---

## UI

### Sales Invoice Detail Page Amendment
- Show E-Invoice status badge below invoice number
- "Generate IRN" button visible for `PENDING` invoices (gated on `sales/approve`)
- "Cancel IRN" button visible for `GENERATED` invoices (gated on `sales/approve`;
  only within 24h of generation)
- IRN number displayed as a copyable text field

### Company Settings — E-Invoice Section
- Enable/Disable toggle
- NIRP credentials form (username, password, client ID, client secret)
- "Test Connection" button that pings the NIC sandbox

---

## Security Considerations

- NIRP credentials are stored encrypted (spec 101 lands before this is exposed in prod).
- Credentials are never logged — masked in Pino output.
- The IRN API is called server-side only — never from the browser.
- NIC API responses are validated against the expected schema before persisting.

---

## Testing Requirements

- Unit tests for NIC payload builder: correct GST amounts, GSTIN fields, line items
- Mock NIC API tests: success path (IRN persisted), failure path (PENDING status set,
  no exception thrown to caller)
- Integration test: a posted Sales Invoice with `eInvoiceEnabled = false` is tagged
  `NOT_APPLICABLE`, not `PENDING`
- Integration test: `generateIrn()` called twice for the same invoice is idempotent
