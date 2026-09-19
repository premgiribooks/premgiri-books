import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatCreditNoteDate } from "@/modules/credit-notes/utils/format-credit-note-date";
import type { CreditNoteDetail, CreditNoteItemDetail } from "@/types/credit-note";

const REFUND_MODE_LABELS: Record<string, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

// A Credit Note line is a freeform description + directly-entered taxable
// amount (credit-note-service.ts's buildCreditNoteLine) — there is no
// product/quantity/rate on this document's own type, so unlike Sales
// Invoice's items table this renders description/rate%/taxable/tax/total
// instead of product/qty/rate.
function itemRow(item: CreditNoteItemDetail): string {
  const tax = item.cgst + item.sgst + item.igst + item.cess;
  return `
    <tr>
      <td>${escapeHtml(item.description)}</td>
      <td class="text-right">${item.ratePercent}%</td>
      <td class="text-right">${item.taxableAmount.toFixed(2)}</td>
      <td class="text-right">${tax.toFixed(2)}</td>
      <td class="text-right">${item.totalAmount.toFixed(2)}</td>
    </tr>`;
}

function totalsRow(label: string, amount: number, extraClass = ""): string {
  if (amount === 0 && extraClass === "") {
    return "";
  }
  return `<div class="totals-row ${extraClass}"><span>${label}</span><span>${amount.toFixed(2)}</span></div>`;
}

/**
 * Renders a Credit Note's already-loaded data (loaded by
 * `creditNoteService.getCreditNote`) into a self-contained HTML string —
 * every figure shown is read verbatim from the document, no new business
 * computation (78-pdf-generation.md's Document PDFs rule). This document has
 * no pre-existing print precedent, so this is its first printing capability
 * of any kind — no status/DRAFT gate is applied here or by its Route
 * Handler.
 */
export function buildCreditNoteHtml(creditNote: CreditNoteDetail): string {
  const partyName = escapeHtml(creditNote.customer.name);
  const refundModeLabel = REFUND_MODE_LABELS[creditNote.refundMode] ?? creditNote.refundMode;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Credit Note</h1>
        <p>${escapeHtml(creditNote.noteNumber ?? "Draft")}</p>
      </div>
      <div class="text-right">
        <p>${formatCreditNoteDate(creditNote.noteDate)}</p>
        <p>Place of Supply: ${escapeHtml(creditNote.placeOfSupplyStateCode)}</p>
      </div>
    </div>

    <div class="section">
      <p><strong>Customer</strong></p>
      <p>${partyName}</p>
      ${
        creditNote.salesInvoice
          ? `<p class="muted">Against Invoice: ${escapeHtml(creditNote.salesInvoice.invoiceNumber)}</p>`
          : ""
      }
      <p class="muted">
        Refund Mode: ${escapeHtml(refundModeLabel)}${creditNote.refundLedger ? ` — ${escapeHtml(creditNote.refundLedger.name)}` : ""}${
          creditNote.paymentMode ? ` (${escapeHtml(creditNote.paymentMode.name)})` : ""
        }
      </p>
    </div>

    <table class="items-table section">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Taxable</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${creditNote.items.map(itemRow).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        ${totalsRow("Taxable Amount", creditNote.taxableAmount, "always")}
        ${totalsRow("CGST", creditNote.totalCgst)}
        ${totalsRow("SGST", creditNote.totalSgst)}
        ${totalsRow("IGST", creditNote.totalIgst)}
        ${totalsRow("Cess", creditNote.totalCess)}
        ${totalsRow("Grand Total", creditNote.grandTotal, "grand-total")}
      </div>
    </div>

    ${creditNote.reason ? `<p class="section muted">${escapeHtml(creditNote.reason)}</p>` : ""}
  </body>
</html>`;
}
