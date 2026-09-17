# 97 - Barcode Billing

> Feature-spec file number 97 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 2 — Compliance &
> Commercial**, tracker item **#88 Barcode Billing**.
>
> v2 spec 79 (`context/feature-specs/79-barcode-billing.md`) was drafted but never
> implemented. This v3 spec replaces it as the implementation-ready version.
>
> Depends On: Sales Invoice (v2 #36, spec 38); Product Management (v2 #23, spec 25).
> Independent of E-Invoice, E-Way Bill, and Thermal Printing.

## Goal

Add a barcode-scan input to the Sales Invoice line-item entry screen. Scanning or typing
a barcode resolves to a product and auto-adds (or increments) a line item without any
mouse interaction. This enables fast counter billing with a standard HID keyboard-wedge
barcode scanner — no special driver or library required.

---

## Project Context

Read before implementation:

1. `context/feature-specs/79-barcode-billing.md` — v2 draft spec; read in full for
   design context.
2. `context/feature-specs/38-sales-invoice.md` — Sales Invoice spec; the line-item
   editor is extended here.
3. `context/feature-specs/25-product-management.md` — `Product.barcode` field (already
   exists in the schema as an optional, unique-per-company string).
4. `context-v3/ui-context.md` — Billing screen performance requirements.

---

## Module Responsibilities

- Barcode input field in the Sales Invoice line-item editor — a focused text input
  that listens for rapid keystroke sequences ending with Enter (the pattern all
  HID barcode scanners use)
- `productActions.findByBarcode(companyId, barcode)` — server action that resolves
  a barcode to an active product with its current price
- Auto-add or auto-increment line logic in the billing form
- Barcode management in Product Management: add/edit barcode field, barcode label print

---

## Data Model

No schema changes — `Product.barcode` already exists as `String? @unique`.

---

## Business Rules

1. A barcode scan resolves to exactly one product — the unique constraint on
   `Product.barcode` guarantees this server-side.
2. If the barcode matches an existing line in the current invoice (same product + same
   warehouse), increment that line's quantity by 1 instead of adding a new line.
3. If the product is not found or is inactive, show an inline error — never silently
   ignore an unresolved scan.
4. Price resolution for auto-added lines uses the same `resolvePrice()` call the
   manual line editor uses — no special barcode pricing logic.
5. Serial-tracked products: after barcode resolves to a product, prompt for serial
   number input before finalizing the line.
6. Batch-tracked products: after barcode resolves, show a batch picker popup.

---

## Validation Rules

- Barcode input is limited to 50 characters.
- The input must receive focus automatically when the Sales Invoice form is opened.
- Barcode lookup must complete in < 300ms (the existing product search performance target).

---

## API / Server Actions

- `productActions.findByBarcode(companyId, barcode)` — returns product with pricing
  context; throws `NOT_FOUND` if no match

---

## UI

### Sales Invoice Line Editor Amendment
- Add a "Scan Barcode" input field at the top of the line items section
- Input auto-focuses when the form loads (keyboard-first, per design principles)
- On Enter (scan or manual type): resolve product → apply line → clear input → refocus
- Scan speed detection: if all characters arrive within 100ms (scanner speed), treat
  as scan; if slower, treat as manual entry (no auto-submit on each keystroke)
- Error state: red border + error message if barcode not found; clears on next input

### Product Management Amendment
- Add "Barcode" field to the Product create/edit form (already in schema, may not be
  in the UI yet — add if missing)
- "Print Barcode Label" action on the Product list/detail page (generates a simple
  barcode label PDF using `@react-pdf/renderer` with the product name, price, and barcode)

---

## Security Considerations

- Barcode lookup is a server action gated on the standard `sales/create` permission —
  no new permission required.
- Barcode values are validated and sanitized on the server before the DB query.

---

## Testing Requirements

- `findByBarcode()`: found, not found, inactive product
- Auto-increment existing line test: same product scanned twice → quantity 2, not two lines
- Scan-speed detection: characters arriving within 100ms auto-submit; manual typing does not
- Serial/batch product post-scan prompt is shown before line is added
