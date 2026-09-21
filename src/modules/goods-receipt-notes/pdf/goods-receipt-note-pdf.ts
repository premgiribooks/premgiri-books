import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatGoodsReceiptNoteDate } from "@/modules/goods-receipt-notes/utils/format-goods-receipt-note-date";
import type { GoodsReceiptNoteDetail, GoodsReceiptNoteItemDetail } from "@/types/goods-receipt-note";

function itemRow(item: GoodsReceiptNoteItemDetail): string {
  return `
    <tr>
      <td>${escapeHtml(item.product.name)}${item.product.productCode ? ` (${escapeHtml(item.product.productCode)})` : ""}</td>
      <td>${escapeHtml(item.warehouse.name)} (${escapeHtml(item.warehouse.code)})</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${item.rejectedQuantity}</td>
    </tr>`;
}

/**
 * Renders a Goods Receipt Note's already-loaded data (loaded by
 * `goodsReceiptNoteService.getGoodsReceiptNote`) into a self-contained HTML
 * string — every figure shown is read verbatim from the document, no new
 * business computation (78-pdf-generation.md's Document PDFs rule). Deviates
 * from `buildSalesInvoiceHtml`'s shape by omitting a totals box entirely:
 * `GoodsReceiptNoteDetail` carries no pricing/GST fields at all (this
 * document is pure record-keeping between a Purchase Order and the eventual
 * Purchase Invoice — see `types/goods-receipt-note.ts`), so there is no
 * monetary total to render, only received/rejected quantities per line.
 */
export function buildGoodsReceiptNoteHtml(goodsReceiptNote: GoodsReceiptNoteDetail): string {
  const supplierName = escapeHtml(goodsReceiptNote.supplier.name);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Goods Receipt Note</h1>
        <p>${escapeHtml(goodsReceiptNote.grnNumber)}</p>
      </div>
      <div class="text-right">
        <p>${formatGoodsReceiptNoteDate(goodsReceiptNote.grnDate)}</p>
        ${
          goodsReceiptNote.purchaseOrder
            ? `<p>Against PO: ${escapeHtml(goodsReceiptNote.purchaseOrder.orderNumber)}</p>`
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
          <th>Warehouse</th>
          <th class="text-right">Received Qty</th>
          <th class="text-right">Rejected Qty</th>
        </tr>
      </thead>
      <tbody>
        ${goodsReceiptNote.items.map(itemRow).join("")}
      </tbody>
    </table>

    ${goodsReceiptNote.narration ? `<p class="section muted">${escapeHtml(goodsReceiptNote.narration)}</p>` : ""}
  </body>
</html>`;
}
