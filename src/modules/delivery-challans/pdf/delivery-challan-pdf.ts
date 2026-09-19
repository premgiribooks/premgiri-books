import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatDeliveryChallanDate } from "@/modules/delivery-challans/utils/format-delivery-challan-date";
import type { DeliveryChallanDetail, DeliveryChallanItemDetail } from "@/types/delivery-challan";

function itemRow(item: DeliveryChallanItemDetail): string {
  return `
    <tr>
      <td>${escapeHtml(item.product.name)} (${escapeHtml(item.product.productCode)})</td>
      <td>${escapeHtml(item.warehouse.name)} (${escapeHtml(item.warehouse.code)})</td>
      <td class="text-right">${item.quantity}</td>
    </tr>`;
}

/**
 * Renders a Delivery Challan's already-loaded data (loaded by
 * `deliveryChallanService.getDeliveryChallan`) into a self-contained HTML
 * string — every field shown is read verbatim from the document, no new
 * business computation (78-pdf-generation.md's Document PDFs rule). Unlike
 * `buildQuotationHtml`/`buildSalesOrderHtml`, this document carries no
 * pricing or GST fields at all (37-delivery-challans.md: "No pricing or GST
 * fields on this document" — the `DeliveryChallanDetail`/`DeliveryChallanItemDetail`
 * types have no rate/taxable/total columns), so this template has no
 * totals box — a deliberate deviation from the invoice/quotation/sales-order
 * shape, not an omission.
 */
export function buildDeliveryChallanHtml(deliveryChallan: DeliveryChallanDetail): string {
  const partyName = escapeHtml(deliveryChallan.customer.name);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Delivery Challan</h1>
        <p>${escapeHtml(deliveryChallan.challanNumber)}</p>
      </div>
      <div class="text-right">
        <p>${formatDeliveryChallanDate(deliveryChallan.challanDate)}</p>
        ${
          deliveryChallan.salesOrder
            ? `<p>Sales Order: ${escapeHtml(deliveryChallan.salesOrder.orderNumber)}</p>`
            : ""
        }
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
          <th>Warehouse</th>
          <th class="text-right">Quantity</th>
        </tr>
      </thead>
      <tbody>
        ${deliveryChallan.items.map(itemRow).join("")}
      </tbody>
    </table>

    ${deliveryChallan.narration ? `<p class="section muted">${escapeHtml(deliveryChallan.narration)}</p>` : ""}
  </body>
</html>`;
}
