import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatDebitNoteDate } from "@/modules/debit-notes/utils/format-debit-note-date";
import type { DebitNoteDetail, DebitNoteItemDetail } from "@/types/debit-note";

// A Debit Note line is a freeform description + directly-entered taxable
// amount (debit-note-service.ts's buildDebitNoteLine) — mirrors Credit
// Note's identical line shape, no product/quantity/rate field to show.
function itemRow(item: DebitNoteItemDetail): string {
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
 * Renders a Debit Note's already-loaded data (loaded by
 * `debitNoteService.getDebitNote`) into a self-contained HTML string — every
 * figure shown is read verbatim from the document, no new business
 * computation (78-pdf-generation.md's Document PDFs rule). Debit Note is
 * Credit Note's structural counterpart but, unlike Credit Note, carries no
 * refund mode/refund ledger/payment mode fields (a Debit Note is never
 * itself refunded — it only debits the customer's ledger,
 * debit-note-service.ts's buildVoucherEntries), so this template has no
 * refund-mode line to render. No pre-existing print precedent — no
 * status/DRAFT gate is applied here or by its Route Handler.
 */
export function buildDebitNoteHtml(debitNote: DebitNoteDetail): string {
  const partyName = escapeHtml(debitNote.customer.name);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Debit Note</h1>
        <p>${escapeHtml(debitNote.noteNumber ?? "Draft")}</p>
      </div>
      <div class="text-right">
        <p>${formatDebitNoteDate(debitNote.noteDate)}</p>
        <p>Place of Supply: ${escapeHtml(debitNote.placeOfSupplyStateCode)}</p>
      </div>
    </div>

    <div class="section">
      <p><strong>Customer</strong></p>
      <p>${partyName}</p>
      ${
        debitNote.salesInvoice
          ? `<p class="muted">Against Invoice: ${escapeHtml(debitNote.salesInvoice.invoiceNumber)}</p>`
          : ""
      }
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
        ${debitNote.items.map(itemRow).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        ${totalsRow("Taxable Amount", debitNote.taxableAmount, "always")}
        ${totalsRow("CGST", debitNote.totalCgst)}
        ${totalsRow("SGST", debitNote.totalSgst)}
        ${totalsRow("IGST", debitNote.totalIgst)}
        ${totalsRow("Cess", debitNote.totalCess)}
        ${totalsRow("Grand Total", debitNote.grandTotal, "grand-total")}
      </div>
    </div>

    ${debitNote.reason ? `<p class="section muted">${escapeHtml(debitNote.reason)}</p>` : ""}
  </body>
</html>`;
}
