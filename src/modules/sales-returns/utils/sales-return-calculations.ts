// Pure line/header arithmetic for Sales Return — mirrors
// sales-invoice-calculations.ts's paise-safe-arithmetic convention. No I/O,
// no Prisma client.

export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/** Prorates an absolute rupee amount by (returnedQty / originalQty), in
 * paise — the "per-unit rate/tax × returned quantity" recompute
 * (39-sales-return.md's Posting step 3), applied to whichever source-line
 * amount is being prorated (taxable amount, or an overridden tax amount that
 * has no percent representation to recompute from). */
export function prorateAmountPaise(sourceAmount: number, sourceQuantity: number, returnedQuantity: number): number {
  if (sourceQuantity <= 0) {
    return 0;
  }
  return Math.round((toPaise(sourceAmount) * returnedQuantity) / sourceQuantity);
}

export interface SalesReturnLineTax {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface SalesReturnHeaderTotals {
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export interface SalesReturnLineForHeaderSum {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/** Sums every line's taxable/tax amounts in paise, then derives grandTotal —
 * no round-off entry exists for Sales Return (no such column on the model;
 * every line amount is already paise-exact, so the sum is exact by
 * construction). */
export function sumSalesReturnHeaderTotals(lines: readonly SalesReturnLineForHeaderSum[]): SalesReturnHeaderTotals {
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let cessPaise = 0;

  for (const line of lines) {
    taxablePaise += toPaise(line.taxableAmount);
    cgstPaise += toPaise(line.cgst);
    sgstPaise += toPaise(line.sgst);
    igstPaise += toPaise(line.igst);
    cessPaise += toPaise(line.cess);
  }

  const grandTotalPaise = taxablePaise + cgstPaise + sgstPaise + igstPaise + cessPaise;

  return {
    taxableAmount: taxablePaise / 100,
    totalCgst: cgstPaise / 100,
    totalSgst: sgstPaise / 100,
    totalIgst: igstPaise / 100,
    totalCess: cessPaise / 100,
    grandTotal: grandTotalPaise / 100,
  };
}
