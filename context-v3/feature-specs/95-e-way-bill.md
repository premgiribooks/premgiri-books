# 95 - E-Way Bill

> Feature-spec file number 95 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 2 — Compliance &
> Commercial**, tracker item **#86 E-Way Bill**.
>
> An E-Way Bill (EWB) is required in India for movement of goods above ₹50,000 in value.
> It is generated through the NIC EWB portal.
>
> Depends On: E-Invoice (spec 94, tracker #85); Delivery Challan (v2 #35, spec 37);
> Sales Invoice (v2 #36, spec 38).

## Goal

Generate an E-Way Bill automatically when a Sales Invoice (inter-state, goods value
> ₹50,000) is posted, or when a Delivery Challan is dispatched. Store the EWB number
and its expiry date on the document. Allow manual generation for edge cases.

Like E-Invoice, this must be **non-blocking** — a NIC API failure must not prevent
invoice posting or challan dispatch.

---

## Project Context

Read before implementation:

1. `context-v3/feature-specs/94-e-invoice.md` — E-Invoice spec; `ExternalIntegrationsEngine`
   introduced there is extended here. The IRN is used as input to the EWB API for
   invoices that already have one.
2. `context/feature-specs/37-delivery-challans.md` — Delivery Challan dispatch.
3. `context/feature-specs/38-sales-invoice.md` — Sales Invoice posting.
4. `context-v3/architecture-context.md` — Decision 4 (E-Invoice / E-Way Bill).
5. NIC EWB API documentation: https://ewaybillgst.gov.in (sandbox credentials required).

---

## Module Responsibilities

- Extend `ExternalIntegrationsEngine` with EWB generation and cancellation calls
- `eWayBillService` — maps invoice/challan data to NIC EWB payload; persists result
- `EWayBill` Prisma model — EWB number, validity, status, linked document
- Trigger EWB generation after Sales Invoice posting and after Delivery Challan dispatch
- EWB status badges on Sales Invoice detail and Delivery Challan detail pages
- Manual "Generate EWB" retry for documents in `NOT_GENERATED` status

---

## Data Model

```prisma
enum EWayBillStatus {
  NOT_GENERATED   // below threshold or EWB not required
  ACTIVE          // EWB generated, within validity
  CANCELLED       // cancelled within 24h of generation
  EXPIRED         // validity period elapsed
}

model EWayBill {
  id              String         @id @default(uuid())
  companyId       String
  eWayBillNumber  String?        // 12-digit EWB number from NIC
  generatedAt     DateTime?
  validUntil      DateTime?
  status          EWayBillStatus @default(NOT_GENERATED)
  irn             String?        // from E-Invoice, if available
  salesInvoiceId  String?        @unique
  deliveryChallanId String?      @unique
  distanceKm      Int?
  transporterGstin String?
  vehicleNumber   String?
  cancelReason    String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  company         Company        @relation(...)
  salesInvoice    SalesInvoice?  @relation(...)
  deliveryChallan DeliveryChallan? @relation(...)
}
```

---

## Business Rules

1. EWB is required when: goods value > ₹50,000 AND movement involves inter-state supply
   OR intra-state supply (state-level threshold rules vary; use ₹50,000 as the safe
   default, configurable per company).
2. EWB generation is attempted after E-Invoice IRN generation (if E-Invoice applies) —
   the IRN is passed to the EWB API.
3. EWB validity: 100km → 1 day; every additional 100km → 1 more day (up to max rules);
   `distanceKm` is required input for generation.
4. An active EWB can be cancelled within 24 hours; after 24 hours it expires naturally.
5. A cancelled or expired EWB does not invalidate the underlying Sales Invoice or
   Delivery Challan.
6. EWB is optional — if `eWayBillEnabled = false` in CompanySettings, skip generation
   entirely without flagging documents.

---

## Validation Rules

- `vehicleNumber` is required if EWB is being generated (format: `[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}`)
- `distanceKm` must be a positive integer ≤ 4000
- `transporterGstin` is required if the transporter is different from the company

---

## API / Server Actions

- `eWayBillActions.generateEWayBill(documentType, documentId, input)` — callable
  manually for NOT_GENERATED documents
- `eWayBillActions.cancelEWayBill(id, reason)` — within 24h of generation
- `eWayBillActions.updateVehicle(id, vehicleNumber)` — NIC update-vehicle-number API

---

## UI

### Sales Invoice Detail Page Amendment
- EWB status badge (alongside E-Invoice badge)
- EWB number (copyable), validity date
- "Generate EWB" button for NOT_GENERATED documents (gated on `sales/approve`)
- "Cancel EWB" button for ACTIVE documents within 24h

### Delivery Challan Detail Page Amendment
- Same EWB badge and buttons as above

### Company Settings — E-Way Bill Section
- Enable/Disable toggle
- Default transporter GSTIN (optional)
- Goods value threshold (default ₹50,000)

---

## Security Considerations

- EWB API credentials stored encrypted alongside E-Invoice credentials in CompanySettings.
- Vehicle numbers and transporter GSTINs validated server-side before API call.
- EWB number is never client-supplied — always received from NIC API.

---

## Testing Requirements

- Mock NIC EWB API: success path (EWB number persisted), failure path (NOT_GENERATED,
  no exception)
- Threshold logic: invoice below ₹50,000 → NOT_GENERATED without API call
- Intra-state toggle: EWB skipped when intra-state and company setting says no intra-state EWB
- Idempotency: calling `generateEWayBill` twice for same document is safe
- Vehicle number format validation
