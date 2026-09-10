import { formatSalesInvoiceDate } from "@/modules/sales-invoices/utils/format-sales-invoice-date";
import type { SalesInvoiceDetail } from "@/types/sales-invoice";

interface SalesInvoicePrintViewProps {
  salesInvoice: SalesInvoiceDetail;
}

function customerDisplayName(invoice: SalesInvoiceDetail): string {
  if (invoice.customer) {
    return invoice.customer.name;
  }
  if (invoice.customerMode === "QUICK") {
    return invoice.quickCustomerName ?? "Quick Customer";
  }
  return invoice.quickCustomerName ?? "Walk-in Customer";
}

/** A plain print-stylesheet layout (`ui-context.md`'s A4/A5 convention) —
 * hidden on screen, shown only via the browser's print dialog. No PDF
 * library, no WhatsApp (38-sales-invoice.md's Do Not). */
export function SalesInvoicePrintView({ salesInvoice }: SalesInvoicePrintViewProps) {
  return (
    <div className="hidden print:block print:p-8">
      <div className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-lg font-semibold">Tax Invoice</h1>
          <p className="text-sm">{salesInvoice.invoiceNumber}</p>
        </div>
        <div className="text-right text-sm">
          <p>{formatSalesInvoiceDate(salesInvoice.invoiceDate)}</p>
          <p>Place of Supply: {salesInvoice.placeOfSupplyStateCode}</p>
        </div>
      </div>

      <div className="mt-4 text-sm">
        <p className="font-medium">Bill To</p>
        <p>{customerDisplayName(salesInvoice)}</p>
        {salesInvoice.quickCustomerMobile ? <p>{salesInvoice.quickCustomerMobile}</p> : null}
        {salesInvoice.quickCustomerGstin ? <p>GSTIN: {salesInvoice.quickCustomerGstin}</p> : null}
        {salesInvoice.quickCustomerAddress ? <p>{salesInvoice.quickCustomerAddress}</p> : null}
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1">Product</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Taxable</th>
            <th className="py-1 text-right">Tax</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {salesInvoice.items.map((item) => {
            const tax =
              (item.isTaxOverridden ? (item.overriddenCgst ?? 0) : item.cgst) +
              (item.isTaxOverridden ? (item.overriddenSgst ?? 0) : item.sgst) +
              (item.isTaxOverridden ? (item.overriddenIgst ?? 0) : item.igst) +
              (item.isTaxOverridden ? (item.overriddenCess ?? 0) : item.cess);
            return (
              <tr key={item.id} className="border-b border-border/60">
                <td className="py-1">
                  {item.product.name} ({item.product.productCode})
                </td>
                <td className="py-1 text-right">{item.quantity}</td>
                <td className="py-1 text-right">{item.rate.toFixed(2)}</td>
                <td className="py-1 text-right">{item.taxableAmount.toFixed(2)}</td>
                <td className="py-1 text-right">{tax.toFixed(2)}</td>
                <td className="py-1 text-right">{item.totalAmount.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-64 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{salesInvoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <span>{salesInvoice.totalDiscount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxable Amount</span>
            <span>{salesInvoice.taxableAmount.toFixed(2)}</span>
          </div>
          {salesInvoice.totalCgst > 0 ? (
            <div className="flex justify-between">
              <span>CGST</span>
              <span>{salesInvoice.totalCgst.toFixed(2)}</span>
            </div>
          ) : null}
          {salesInvoice.totalSgst > 0 ? (
            <div className="flex justify-between">
              <span>SGST</span>
              <span>{salesInvoice.totalSgst.toFixed(2)}</span>
            </div>
          ) : null}
          {salesInvoice.totalIgst > 0 ? (
            <div className="flex justify-between">
              <span>IGST</span>
              <span>{salesInvoice.totalIgst.toFixed(2)}</span>
            </div>
          ) : null}
          {salesInvoice.totalCess > 0 ? (
            <div className="flex justify-between">
              <span>Cess</span>
              <span>{salesInvoice.totalCess.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>Round Off</span>
            <span>{salesInvoice.roundOff.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <span>Grand Total</span>
            <span>{salesInvoice.grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid</span>
            <span>{salesInvoice.amountPaid.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {salesInvoice.payments.length > 0 ? (
        <div className="mt-4 text-sm">
          <p className="font-medium">Payments</p>
          {salesInvoice.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between">
              <span>
                {payment.ledger.name}
                {payment.reference ? ` (${payment.reference})` : ""}
              </span>
              <span>{payment.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {salesInvoice.narration ? <p className="mt-4 text-xs">{salesInvoice.narration}</p> : null}
    </div>
  );
}
