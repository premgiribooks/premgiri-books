// Pure header arithmetic for Purchase Credit Note — mirrors
// src/modules/credit-notes/utils/credit-note-calculations.ts's paise-safe-
// arithmetic convention exactly. No I/O, no Prisma client. Each line's tax
// is computed fresh by the GST Engine (gstEngine.calculateLine), not
// prorated from a source document — this file only sums the already-rounded
// per-line results.

export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

export interface PurchaseCreditNoteHeaderTotals {
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export interface PurchaseCreditNoteLineForHeaderSum {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

/** Sums every line's taxable/tax/total amounts in paise — no round-off entry
 * exists for Purchase Credit Note (no such column on the model; every line
 * amount is already paise-exact from gstEngine.calculateLine), so the sum is
 * exact by construction. */
export function sumPurchaseCreditNoteHeaderTotals(
  lines: readonly PurchaseCreditNoteLineForHeaderSum[]
): PurchaseCreditNoteHeaderTotals {
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let cessPaise = 0;
  let grandTotalPaise = 0;

  for (const line of lines) {
    taxablePaise += toPaise(line.taxableAmount);
    cgstPaise += toPaise(line.cgst);
    sgstPaise += toPaise(line.sgst);
    igstPaise += toPaise(line.igst);
    cessPaise += toPaise(line.cess);
    grandTotalPaise += toPaise(line.totalAmount);
  }

  return {
    taxableAmount: taxablePaise / 100,
    totalCgst: cgstPaise / 100,
    totalSgst: sgstPaise / 100,
    totalIgst: igstPaise / 100,
    totalCess: cessPaise / 100,
    grandTotal: grandTotalPaise / 100,
  };
}
