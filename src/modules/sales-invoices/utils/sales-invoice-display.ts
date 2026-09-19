import type { SalesInvoiceDetail } from "@/types/sales-invoice";

/** Used by `buildSalesInvoiceHtml` to render the party name on the
 * downloaded/printed PDF. */
export function customerDisplayName(invoice: SalesInvoiceDetail): string {
  if (invoice.customer) {
    return invoice.customer.name;
  }
  if (invoice.customerMode === "QUICK") {
    return invoice.quickCustomerName ?? "Quick Customer";
  }
  return invoice.quickCustomerName ?? "Walk-in Customer";
}
