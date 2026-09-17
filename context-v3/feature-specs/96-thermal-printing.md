# 96 - Thermal / POS Printing

> Feature-spec file number 96 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 2 — Compliance &
> Commercial**, tracker item **#87 Thermal Printing**.
>
> Depends On: Sales Invoice (v2 #36, spec 38); Electron IPC infrastructure.
> Independent of E-Invoice (#85) and E-Way Bill (#86).

## Goal

Add support for printing 80mm thermal receipts from the Sales Invoice billing screen
via an Electron IPC channel. No third-party print driver — the printer is addressed
directly as a raw USB or network socket device using ESC/POS byte commands.

A "Print Receipt" button on the Sales Invoice detail page sends a structured receipt
payload to the Electron main process, which serializes it to ESC/POS and writes it to
the configured printer.

---

## Project Context

Read before implementation:

1. `context/feature-specs/38-sales-invoice.md` — Sales Invoice; the billing screen is
   this spec's primary trigger surface.
2. `electron/ipc-channels.ts` — existing IPC channels; `print:thermal` is added here.
3. `electron/main.ts` — IPC handler registration.
4. `context-v3/ui-context.md` — Thermal Receipt Template section.
5. `context-v3/code-standards.md` — no new standards specific to printing.

---

## Module Responsibilities

- Electron IPC channel `print:thermal` — accepts a `ThermalReceiptPayload` object;
  returns `{ success: boolean; error?: string }`
- `thermalPrinterService` (Electron main process) — serializes payload to ESC/POS bytes;
  writes to printer socket
- `CompanySettings` — new `thermalPrinterConfig` JSON column (printer address, paper
  width, cut mode)
- Receipt payload builder — converts a `SalesInvoice` + line items to `ThermalReceiptPayload`
- "Print Receipt" button on Sales Invoice detail page
- Settings page section for thermal printer configuration with a "Test Print" button

---

## Data Model

```prisma
// Add to CompanySettings:
  thermalPrinterConfig Json?
  // Shape: {
  //   enabled: boolean,
  //   printerType: "USB" | "NETWORK",
  //   address: string,      // USB path or "host:port"
  //   paperWidth: 58 | 80,  // mm
  //   autoCut: boolean
  // }
```

---

## ESC/POS Payload Structure

```typescript
interface ThermalReceiptPayload {
  header: {
    companyName: string;
    address: string;
    gstin: string;
    phone?: string;
  };
  invoice: {
    number: string;
    date: string;
    cashierName?: string;
  };
  customer?: {
    name: string;
    mobile?: string;
  };
  items: Array<{
    name: string;       // truncated to 24 chars
    qty: number;
    unit: string;
    rate: number;
    amount: number;
  }>;
  totals: {
    subtotal: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    cess?: number;
    discount?: number;
    grandTotal: number;
  };
  payments: Array<{
    mode: string;
    amount: number;
  }>;
  footer?: string;    // thank-you message from CompanySettings
}
```

---

## Business Rules

1. Thermal printing is only available in the Electron desktop app — never in a browser.
2. If no thermal printer is configured, the "Print Receipt" button is hidden.
3. A print failure (device not found, socket error) shows an error toast — it never
   prevents the invoice from being saved or posted.
4. The receipt format must fit within 58mm or 80mm paper width based on configuration.
5. The footer must include the GST breakdown only if the invoice has non-zero GST.

---

## Validation Rules

- `thermalPrinterConfig.address` is required if `enabled = true`
- `paperWidth` must be 58 or 80
- `printerType: "NETWORK"` requires address in `host:port` format

---

## API / IPC

- `ipcMain.handle('print:thermal', handler)` — in `electron/main.ts`
- `ipcRenderer.invoke('print:thermal', payload)` — called from the Next.js renderer
  via `window.electron.printThermal(payload)`
- `preload.ts` — expose `printThermal` as a safe contextBridge method

---

## UI

### Sales Invoice Detail Page Amendment
- "Print Receipt" button (only shown when `thermalPrinterConfig.enabled = true`)
- Keyboard shortcut: Ctrl+T on the billing screen
- Print status: spinner while printing, success toast on completion, error toast on failure

### Settings — Thermal Printer Section (`/settings/thermal-printer`)
- Enable/Disable toggle
- Printer type selector (USB / Network)
- Address input
- Paper width selector (58mm / 80mm)
- Auto-cut toggle
- Footer message text area
- "Test Print" button — sends a test receipt with dummy data

---

## Security Considerations

- The Electron `contextBridge` must not expose raw serial/socket APIs to the renderer —
  only the structured `printThermal(payload)` function.
- The IPC handler validates the payload shape before serializing to ESC/POS.
- No file system writes from the thermal print path.

---

## Testing Requirements

- Unit tests for the receipt payload builder: correct truncation, correct GST breakdown,
  correct payment line formatting
- Unit tests for ESC/POS serializer: line length wrapping, center-align header,
  cut command appended when `autoCut = true`
- Integration test (mock printer socket): payload written matches expected byte sequence
- Settings form validation: enabled with no address is rejected
