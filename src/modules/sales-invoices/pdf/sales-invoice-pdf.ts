import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatSalesInvoiceDate } from "@/modules/sales-invoices/utils/format-sales-invoice-date";
import { customerDisplayName, effectiveLineTax } from "@/modules/sales-invoices/utils/sales-invoice-display";
import type { SalesInvoiceDetail, SalesInvoiceItemDetail } from "@/types/sales-invoice";

function itemRow(item: SalesInvoiceItemDetail): string {
  return `
    <tr>
      <td>${escapeHtml(item.product.name)} (${escapeHtml(item.product.productCode)})</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${item.rate.toFixed(2)}</td>
      <td class="text-right">${item.taxableAmount.toFixed(2)}</td>
      <td class="text-right">${effectiveLineTax(item).toFixed(2)}</td>
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
 * Renders a Sales Invoice's already-posted data (loaded by
 * `salesInvoiceService.getSalesInvoice`) into a self-contained HTML string —
 * every figure shown is read verbatim from the document, no new business
 * computation (78-pdf-generation.md's Document PDFs rule), mirroring
 * `SalesInvoicePrintView`'s own on-screen layout so the on-screen preview
 * and the downloaded PDF look the same.
 */
export function buildSalesInvoiceHtml(salesInvoice: SalesInvoiceDetail): string {
  const partyName = escapeHtml(customerDisplayName(salesInvoice));

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Tax Invoice</h1>
        <p>${escapeHtml(salesInvoice.invoiceNumber)}</p>
      </div>
      <div class="text-right">
        <p>${formatSalesInvoiceDate(salesInvoice.invoiceDate)}</p>
        <p>Place of Supply: ${escapeHtml(salesInvoice.placeOfSupplyStateCode)}</p>
      </div>
    </div>

    <div class="section">
      <p><strong>Bill To</strong></p>
      <p>${partyName}</p>
      ${salesInvoice.quickCustomerMobile ? `<p>${escapeHtml(salesInvoice.quickCustomerMobile)}</p>` : ""}
      ${salesInvoice.quickCustomerGstin ? `<p>GSTIN: ${escapeHtml(salesInvoice.quickCustomerGstin)}</p>` : ""}
      ${salesInvoice.quickCustomerAddress ? `<p>${escapeHtml(salesInvoice.quickCustomerAddress)}</p>` : ""}
    </div>

    <table class="items-table section">
      <thead>
        <tr>
          <th>Product</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Taxable</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${salesInvoice.items.map(itemRow).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        ${totalsRow("Subtotal", salesInvoice.subtotal, "always")}
        ${totalsRow("Discount", salesInvoice.totalDiscount, "always")}
        ${totalsRow("Taxable Amount", salesInvoice.taxableAmount, "always")}
        ${totalsRow("CGST", salesInvoice.totalCgst)}
        ${totalsRow("SGST", salesInvoice.totalSgst)}
        ${totalsRow("IGST", salesInvoice.totalIgst)}
        ${totalsRow("Cess", salesInvoice.totalCess)}
        ${totalsRow("Round Off", salesInvoice.roundOff, "always")}
        ${totalsRow("Grand Total", salesInvoice.grandTotal, "grand-total")}
        ${totalsRow("Paid", salesInvoice.amountPaid, "always")}
      </div>
    </div>

    ${
      salesInvoice.payments.length > 0
        ? `<div class="section">
      <p><strong>Payments</strong></p>
      ${salesInvoice.payments
        .map(
          (payment) =>
            `<div class="totals-row"><span>${escapeHtml(payment.ledger.name)}${
              payment.reference ? ` (${escapeHtml(payment.reference)})` : ""
            }</span><span>${payment.amount.toFixed(2)}</span></div>`
        )
        .join("")}
    </div>`
        : ""
    }

    ${salesInvoice.narration ? `<p class="section muted">${escapeHtml(salesInvoice.narration)}</p>` : ""}
  </body>
</html>`;
}
