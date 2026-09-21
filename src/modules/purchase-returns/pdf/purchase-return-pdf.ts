import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatPurchaseReturnDate } from "@/modules/purchase-returns/utils/format-purchase-return-date";
import type { PurchaseReturnDetail, PurchaseReturnItemDetail } from "@/types/purchase-return";

function itemRow(item: PurchaseReturnItemDetail): string {
  const tax = item.cgst + item.sgst + item.igst + item.cess;
  return `
    <tr>
      <td>${escapeHtml(item.purchaseInvoiceItem.productName)}${item.purchaseInvoiceItem.productCode ? ` (${escapeHtml(item.purchaseInvoiceItem.productCode)})` : ""}</td>
      <td>${escapeHtml(item.purchaseInvoiceItem.warehouseName)}</td>
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
 * Renders a Purchase Return's already-loaded data (loaded by
 * `purchaseReturnService.getPurchaseReturn`) into a self-contained HTML
 * string — every figure shown is read verbatim from the document, no new
 * business computation (78-pdf-generation.md's Document PDFs rule). Mirrors
 * `buildPurchaseOrderHtml`'s shape, adapted to the fields
 * `PurchaseReturnDetail` actually carries: no `subtotal`/`totalDiscount`
 * (a return has no gross-before-discount concept — see
 * `types/purchase-return.ts`'s `PurchaseReturnTotals`), and the party is
 * read from the linked `purchaseInvoice` snapshot rather than a `supplier`
 * relation. `returnNumber` is nullable (only assigned at posting), so a
 * still-DRAFT return prints "Draft" in its place — the same fallback Sales
 * Return/Credit Note/Debit Note use for their own nullable numbers.
 */
export function buildPurchaseReturnHtml(purchaseReturn: PurchaseReturnDetail): string {
  const supplierName = escapeHtml(purchaseReturn.purchaseInvoice.supplierName);
  const returnNumber = escapeHtml(purchaseReturn.returnNumber ?? "Draft");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Purchase Return</h1>
        <p>${returnNumber}</p>
      </div>
      <div class="text-right">
        <p>${formatPurchaseReturnDate(purchaseReturn.returnDate)}</p>
        <p>Against Invoice: ${escapeHtml(purchaseReturn.purchaseInvoice.invoiceNumber)}</p>
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
          <th class="text-right">Qty</th>
          <th class="text-right">Taxable</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${purchaseReturn.items.map(itemRow).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        ${totalsRow("Taxable Amount", purchaseReturn.taxableAmount, "always")}
        ${totalsRow("CGST", purchaseReturn.totalCgst)}
        ${totalsRow("SGST", purchaseReturn.totalSgst)}
        ${totalsRow("IGST", purchaseReturn.totalIgst)}
        ${totalsRow("Cess", purchaseReturn.totalCess)}
        ${totalsRow("Grand Total", purchaseReturn.grandTotal, "grand-total")}
      </div>
    </div>

    ${purchaseReturn.reason ? `<p class="section muted">${escapeHtml(purchaseReturn.reason)}</p>` : ""}
  </body>
</html>`;
}
