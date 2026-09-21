import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatSalesReturnDate } from "@/modules/sales-returns/utils/format-sales-return-date";
import type { SalesReturnDetail, SalesReturnItemDetail } from "@/types/sales-return";

const REFUND_MODE_LABELS: Record<string, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

// A SalesReturnItem has no `rate` field of its own — every amount is
// prorated straight from the source SalesInvoiceItem's taxable/tax amounts
// (sales-return-service.ts's buildReturnLine), so unlike Sales Invoice's
// items table there is no per-unit rate column to show, only the prorated
// taxable/tax/total figures actually persisted on this line.
function itemRow(item: SalesReturnItemDetail): string {
  const tax = item.cgst + item.sgst + item.igst + item.cess;
  return `
    <tr>
      <td>${escapeHtml(item.salesInvoiceItem.productName)}${item.salesInvoiceItem.productCode ? ` (${escapeHtml(item.salesInvoiceItem.productCode)})` : ""}</td>
      <td class="text-right">${item.quantity}</td>
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
 * Renders a Sales Return's already-loaded data (loaded by
 * `salesReturnService.getSalesReturn`) into a self-contained HTML string —
 * every figure shown is read verbatim from the document, no new business
 * computation (78-pdf-generation.md's Document PDFs rule). Unlike Sales
 * Invoice, this document has no pre-existing browser print precedent, so
 * this is its first printing capability of any kind — no status/DRAFT gate
 * is applied here or by its Route Handler.
 */
export function buildSalesReturnHtml(salesReturn: SalesReturnDetail): string {
  const partyName = escapeHtml(salesReturn.salesInvoice.customerName ?? "Walk-in");
  const refundModeLabel = REFUND_MODE_LABELS[salesReturn.refundMode] ?? salesReturn.refundMode;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Sales Return</h1>
        <p>${escapeHtml(salesReturn.returnNumber ?? "Draft")}</p>
      </div>
      <div class="text-right">
        <p>${formatSalesReturnDate(salesReturn.returnDate)}</p>
        <p>Against Invoice: ${escapeHtml(salesReturn.salesInvoice.invoiceNumber)}</p>
      </div>
    </div>

    <div class="section">
      <p><strong>Customer</strong></p>
      <p>${partyName}</p>
      <p class="muted">
        Refund Mode: ${escapeHtml(refundModeLabel)}${salesReturn.refundLedger ? ` — ${escapeHtml(salesReturn.refundLedger.name)}` : ""}${
          salesReturn.paymentMode ? ` (${escapeHtml(salesReturn.paymentMode.name)})` : ""
        }
      </p>
    </div>

    <table class="items-table section">
      <thead>
        <tr>
          <th>Product</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Taxable</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${salesReturn.items.map(itemRow).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        ${totalsRow("Taxable Amount", salesReturn.taxableAmount, "always")}
        ${totalsRow("CGST", salesReturn.totalCgst)}
        ${totalsRow("SGST", salesReturn.totalSgst)}
        ${totalsRow("IGST", salesReturn.totalIgst)}
        ${totalsRow("Cess", salesReturn.totalCess)}
        ${totalsRow("Grand Total", salesReturn.grandTotal, "grand-total")}
      </div>
    </div>

    ${salesReturn.reason ? `<p class="section muted">${escapeHtml(salesReturn.reason)}</p>` : ""}
  </body>
</html>`;
}
