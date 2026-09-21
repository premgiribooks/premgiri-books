import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatQuotationDate } from "@/modules/quotations/utils/format-quotation-date";
import type { QuotationDetail, QuotationItemDetail } from "@/types/quotation";

function discountLabel(item: QuotationItemDetail): string {
  if (item.discountAmount > 0 || item.discountPercent > 0) {
    return `${item.discountPercent}% + ${item.discountAmount.toFixed(2)}`;
  }
  return "—";
}

function itemRow(item: QuotationItemDetail): string {
  return `
    <tr>
      <td>${escapeHtml(item.product.name)}${item.product.productCode ? ` (${escapeHtml(item.product.productCode)})` : ""}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${item.rate.toFixed(2)}</td>
      <td class="text-right">${discountLabel(item)}</td>
      <td class="text-right">${item.taxableAmount.toFixed(2)}</td>
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
 * Renders a Quotation's already-loaded data (loaded by
 * `quotationService.getQuotation`) into a self-contained HTML string — every
 * figure shown is read verbatim from the document, no new business
 * computation (78-pdf-generation.md's Document PDFs rule), mirroring
 * `buildSalesInvoiceHtml`'s own layout so every document PDF looks
 * consistent.
 */
export function buildQuotationHtml(quotation: QuotationDetail): string {
  const partyName = escapeHtml(quotation.customer.name);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Quotation</h1>
        <p>${escapeHtml(quotation.quotationNumber)}</p>
      </div>
      <div class="text-right">
        <p>${formatQuotationDate(quotation.quotationDate)}</p>
        ${quotation.validUntil ? `<p>Valid Until: ${formatQuotationDate(quotation.validUntil)}</p>` : ""}
        <p>Place of Supply: ${escapeHtml(quotation.placeOfSupplyStateCode)}</p>
      </div>
    </div>

    <div class="section">
      <p><strong>To</strong></p>
      <p>${partyName}</p>
    </div>

    <table class="items-table section">
      <thead>
        <tr>
          <th>Product</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Discount</th>
          <th class="text-right">Taxable</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${quotation.items.map(itemRow).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        ${totalsRow("Subtotal", quotation.subtotal, "always")}
        ${totalsRow("Discount", quotation.totalDiscount, "always")}
        ${totalsRow("Taxable Amount", quotation.taxableAmount, "always")}
        ${totalsRow("CGST", quotation.totalCgst)}
        ${totalsRow("SGST", quotation.totalSgst)}
        ${totalsRow("IGST", quotation.totalIgst)}
        ${totalsRow("Cess", quotation.totalCess)}
        ${totalsRow("Grand Total", quotation.grandTotal, "grand-total")}
      </div>
    </div>

    ${quotation.narration ? `<p class="section muted">${escapeHtml(quotation.narration)}</p>` : ""}
  </body>
</html>`;
}
