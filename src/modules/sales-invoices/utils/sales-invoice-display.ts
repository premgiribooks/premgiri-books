import type { SalesInvoiceDetail, SalesInvoiceItemDetail } from "@/types/sales-invoice";

/** Shared by `SalesInvoicePrintView` and `buildSalesInvoiceHtml` so the
 * on-screen preview and the downloaded PDF can never silently disagree on
 * how a party or a line's effective tax is displayed (code review finding —
 * these were previously duplicated in both places). */
export function customerDisplayName(invoice: SalesInvoiceDetail): string {
  if (invoice.customer) {
    return invoice.customer.name;
  }
  if (invoice.customerMode === "QUICK") {
    return invoice.quickCustomerName ?? "Quick Customer";
  }
  return invoice.quickCustomerName ?? "Walk-in Customer";
}

/** The tax actually used for a line — the override, when set, otherwise the
 * system-computed value (38-sales-invoice.md's Data Model decision). */
export function effectiveLineTax(item: SalesInvoiceItemDetail): number {
  return (
    (item.isTaxOverridden ? (item.overriddenCgst ?? 0) : item.cgst) +
    (item.isTaxOverridden ? (item.overriddenSgst ?? 0) : item.sgst) +
    (item.isTaxOverridden ? (item.overriddenIgst ?? 0) : item.igst) +
    (item.isTaxOverridden ? (item.overriddenCess ?? 0) : item.cess)
  );
}
