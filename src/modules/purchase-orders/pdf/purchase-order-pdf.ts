import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatPurchaseOrderDate } from "@/modules/purchase-orders/utils/format-purchase-order-date";
import type { PurchaseOrderDetail, PurchaseOrderItemDetail } from "@/types/purchase-order";

function lineTax(item: PurchaseOrderItemDetail): number {
  return item.cgst + item.sgst + item.igst + item.cess;
}

function itemRow(item: PurchaseOrderItemDetail): string {
  return `
    <tr>
      <td>${escapeHtml(item.product.name)}${item.product.productCode ? ` (${escapeHtml(item.product.productCode)})` : ""}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${item.rate.toFixed(2)}</td>
      <td class="text-right">${item.taxableAmount.toFixed(2)}</td>
      <td class="text-right">${lineTax(item).toFixed(2)}</td>
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
 * Renders a Purchase Order's already-loaded data (loaded by
 * `purchaseOrderService.getPurchaseOrder`) into a self-contained HTML string —
 * every figure shown is read verbatim from the document, no new business
 * computation (78-pdf-generation.md's Document PDFs rule). Mirrors
 * `buildSalesInvoiceHtml`'s structure with "Bill To" adapted to "Supplier".
 */
export function buildPurchaseOrderHtml(purchaseOrder: PurchaseOrderDetail): string {
  const supplierName = escapeHtml(purchaseOrder.supplier.name);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Purchase Order</h1>
        <p>${escapeHtml(purchaseOrder.orderNumber)}</p>
      </div>
      <div class="text-right">
        <p>${formatPurchaseOrderDate(purchaseOrder.orderDate)}</p>
        <p>Place of Supply: ${escapeHtml(purchaseOrder.placeOfSupplyStateCode)}</p>
        ${
          purchaseOrder.expectedDeliveryDate
            ? `<p>Expected Delivery: ${formatPurchaseOrderDate(purchaseOrder.expectedDeliveryDate)}</p>`
            : ""
        }
      </div>
    </div>

    <div class="section">
      <p><strong>Supplier</strong></p>
      <p>${supplierName}</p>
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
        ${purchaseOrder.items.map(itemRow).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        ${totalsRow("Subtotal", purchaseOrder.subtotal, "always")}
        ${totalsRow("Discount", purchaseOrder.totalDiscount, "always")}
        ${totalsRow("Taxable Amount", purchaseOrder.taxableAmount, "always")}
        ${totalsRow("CGST", purchaseOrder.totalCgst)}
        ${totalsRow("SGST", purchaseOrder.totalSgst)}
        ${totalsRow("IGST", purchaseOrder.totalIgst)}
        ${totalsRow("Cess", purchaseOrder.totalCess)}
        ${totalsRow("Grand Total", purchaseOrder.grandTotal, "grand-total")}
      </div>
    </div>

    ${purchaseOrder.narration ? `<p class="section muted">${escapeHtml(purchaseOrder.narration)}</p>` : ""}
  </body>
</html>`;
}
