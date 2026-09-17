# UI Context — Milestone v3

## Base UI System (Unchanged)

All design tokens, color system, typography, icon library, layout conventions, form
rules, table requirements, and accessibility standards from `context/ui-context.md`
remain in force without change.

This file documents only the **UI additions and amendments** introduced in Milestone v3.

---

## New UI Components (v3)

### Thermal Receipt Template

A printable receipt layout optimized for 80mm paper (576px dot-width at 203 DPI).

Rules
- No images wider than 576px.
- Monospaced font only (Courier or equivalent built into the ESC/POS printer).
- Line items: product name (truncated at 24 chars) + quantity + amount, two-column.
- Total section: subtotal, GST breakdown, grand total — each on its own line.
- Footer: company name, GSTIN, thank-you message.
- No shadows, gradients, or color — thermal printers are single-color.

---

### E-Invoice Status Badge

A status badge component for Sales Invoice detail pages showing E-Invoice state.

| State | Color | Label |
|---|---|---|
| NOT_APPLICABLE | Gray (muted) | Not Applicable |
| PENDING | Orange (warning) | Pending IRN |
| GENERATED | Green (success) | IRN Generated |
| CANCELLED | Red (error) | IRN Cancelled |

---

### E-Way Bill Status Badge

Same pattern as E-Invoice Status Badge.

| State | Color | Label |
|---|---|---|
| NOT_GENERATED | Gray | No E-Way Bill |
| ACTIVE | Green | EWB Active |
| CANCELLED | Red | EWB Cancelled |
| EXPIRED | Orange | EWB Expired |

---

### AI Insights Panel

A collapsible panel on the Dashboard and Report pages showing AI-generated business
summaries. Uses the existing AI accent tokens (`--accent-ai`, `--accent-ai-text`).

Rules
- Always show a "Powered by AI" label — never present AI output as system fact.
- Include a copy-to-clipboard button on every insight card.
- Insights load asynchronously — show a skeleton while loading, never block the page.
- Insights that cannot be generated (AI not configured) show a friendly setup prompt.
- Never mix AI-generated numbers with financial report numbers in the same table.

---

### Mobile PWA Additions

The PWA provides a responsive, read-only view of the Dashboard and Reports for mobile
browsers. Desktop billing/data-entry screens remain desktop-only.

PWA-specific rules
- Use the existing color tokens — do not introduce new mobile-only colors.
- Navigation: bottom tab bar on mobile (Dashboard, P&L, Receivables, Payables).
- Tables collapse to card-list view on screens < 640px.
- Charts use a simplified single-axis layout on small screens.
- All report numbers must be readable at 14px on a 375px viewport.
- No data entry on mobile — all interactive form elements are read-only or hidden.

---

## Updated Design Principles (v3 Additions)

11. E-Invoice and E-Way Bill status must be visible on every Sales Invoice without
    opening the document.
12. Thermal receipt output must be testable in a browser print preview before sending
    to the printer.
13. AI-generated content must always be visually distinguished from system-computed data.
14. Mobile views must never show stale data — always request fresh server data, never
    cache financial balances client-side beyond the current session.

---

## Printing Updates (v3)

### Thermal (80mm ESC/POS)

Added in v3 for counter billing.

Receipt layout
- Header: company name, address, GSTIN, date/time, counter number
- Body: line items (name + qty + amount)
- Footer: subtotal, GST breakdown, grand total, payment method, thank you

Trigger: "Print Receipt" button on Sales Invoice save/post (keyboard shortcut: Ctrl+P
on the billing screen triggers thermal if a thermal printer is configured; A4/A5 PDF
otherwise).

---

## Column Resize (v3 Target)

Column resize in data tables (listed as "Future" in `context/ui-context.md`) is
scheduled for v3 as a quality-of-life improvement. All data tables using the shared
`DataTable` component gain resizable columns via the existing `@tanstack/react-table`
column-sizing API. Minimum column width: 60px. Column widths persist in `localStorage`
per table ID.
