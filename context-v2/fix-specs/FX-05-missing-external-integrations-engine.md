# FX-05 — Missing `src/engines/external-integrations/` Engine

**Severity:** HIGH  
**Found in:** `src/engines/` (directory listing)  
**Resolving specs:** v3 spec 94 (E-Invoice), v3 spec 95 (E-Way Bill)

---

## What Was Found

`src/engines/` contains six engines:

```
src/engines/
├── document-number/
├── gst/
├── inventory/
├── pricing/
├── reporting/
└── voucher/
```

The `external-integrations/` engine **does not exist**. This engine is the planned
wrapper for all outbound calls to government APIs (NIC/IRP for E-Invoice, NIC EWB API
for E-Way Bills).

---

## Why It Is a Problem

**Missing abstraction:** Without this engine, specs 94 and 95 would implement NIC API
calls directly inside the `SalesInvoiceService` and `DeliveryChallanService`
respectively. This would:
- Tightly couple core business logic to external network calls
- Make it impossible to swap the IRP provider without changing core services
- Violate the "non-blocking external integrations" rule in `context-v3/ai-workflow-rules.md`
  (no external API call may be made inside a database transaction)

**v3 architecture violation:** Decision 4 in `context-v3/architecture-context.md`
explicitly places this logic in `src/engines/external-integrations/`.

---

## What Must Change

### Create `src/engines/external-integrations/`

The engine must be created as part of spec 94 (E-Invoice). Its structure:

```
src/engines/external-integrations/
├── external-integrations-engine.ts   ← main entry point
├── e-invoice/
│   ├── e-invoice-client.ts           ← NIC/IRP HTTP client
│   ├── e-invoice-transformer.ts      ← SalesInvoice → IRN request payload
│   └── types.ts                      ← IRN request/response types
└── e-way-bill/
    ├── e-way-bill-client.ts          ← NIC EWB API HTTP client
    ├── e-way-bill-transformer.ts     ← Invoice/DC → EWB request payload
    └── types.ts                      ← EWB request/response types
```

### Key Design Constraints

1. **Non-blocking:** All calls to this engine from services must be made **outside** of
   any database transaction (`runInTransaction`). The pattern:
   ```typescript
   // ✅ Correct:
   const invoice = await runInTransaction(async (tx) => {
     return salesInvoiceRepository.create(tx, data);
   });
   // After transaction commits:
   await externalIntegrationsEngine.generateIRN(invoice.id);
   ```

2. **Idempotent:** Calling `generateIRN` twice for the same invoice must be safe — the
   engine checks `eInvoiceStatus` before making the API call and returns the existing
   IRN if already `GENERATED`.

3. **Isolated:** No other engine (`gstEngine`, `inventoryEngine`, `voucherEngine`) may
   import from `external-integrations/`. The dependency arrow points only one way:
   `SalesInvoiceService` → `externalIntegrationsEngine`.

4. **Optional:** If the IRP API credentials are not configured in `CompanySettings`,
   the engine returns immediately with status `PENDING` and logs a warning.

---

## Acceptance Criteria

- [ ] `src/engines/external-integrations/external-integrations-engine.ts` exists when spec 94 is implemented
- [ ] No other engine imports from `external-integrations/`
- [ ] E-Invoice generation is called outside any Prisma transaction
- [ ] `generateIRN()` is idempotent — calling it on an already-`GENERATED` invoice returns the existing IRN without making a network call
