import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatSalesOrderDate } from "@/modules/sales-orders/utils/format-sales-order-date";
import type { SalesOrderDetail, SalesOrderItemDetail } from "@/types/sales-order";

function discountLabel(item: SalesOrderItemDetail): string {
  if (item.discountAmount > 0 || item.discountPercent > 0) {
    return `${item.discountPercent}% + ${item.discountAmount.toFixed(2)}`;
  }
  return "—";
}

function itemRow(item: SalesOrderItemDetail): string {
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
 * Renders a Sales Order's already-loaded data (loaded by
 * `salesOrderService.getSalesOrder`) into a self-contained HTML string —
 * every figure shown is read verbatim from the document, no new business
 * computation (78-pdf-generation.md's Document PDFs rule), mirroring
 * `buildQuotationHtml`'s own layout so every document PDF looks consistent.
 */
export function buildSalesOrderHtml(salesOrder: SalesOrderDetail): string {
  const partyName = escapeHtml(salesOrder.customer.name);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Sales Order</h1>
        <p>${escapeHtml(salesOrder.orderNumber)}</p>
      </div>
      <div class="text-right">
        <p>${formatSalesOrderDate(salesOrder.orderDate)}</p>
        ${
          salesOrder.expectedDeliveryDate
            ? `<p>Expected Delivery: ${formatSalesOrderDate(salesOrder.expectedDeliveryDate)}</p>`
            : ""
        }
        <p>Place of Supply: ${escapeHtml(salesOrder.placeOfSupplyStateCode)}</p>
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
        ${salesOrder.items.map(itemRow).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        ${totalsRow("Subtotal", salesOrder.subtotal, "always")}
        ${totalsRow("Discount", salesOrder.totalDiscount, "always")}
        ${totalsRow("Taxable Amount", salesOrder.taxableAmount, "always")}
        ${totalsRow("CGST", salesOrder.totalCgst)}
        ${totalsRow("SGST", salesOrder.totalSgst)}
        ${totalsRow("IGST", salesOrder.totalIgst)}
        ${totalsRow("Cess", salesOrder.totalCess)}
        ${totalsRow("Grand Total", salesOrder.grandTotal, "grand-total")}
      </div>
    </div>

    ${salesOrder.narration ? `<p class="section muted">${escapeHtml(salesOrder.narration)}</p>` : ""}
  </body>
</html>`;
}
