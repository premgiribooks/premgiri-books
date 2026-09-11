import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseReturnStatusBadge } from "@/modules/purchase-returns/components/purchase-return-status-badge";
import { formatPurchaseReturnDate } from "@/modules/purchase-returns/utils/format-purchase-return-date";
import type { PurchaseReturnListRow } from "@/types/purchase-return";

interface PurchaseReturnTableProps {
  purchaseReturns: PurchaseReturnListRow[];
}

export function PurchaseReturnTable({ purchaseReturns }: PurchaseReturnTableProps) {
  if (purchaseReturns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No purchase returns found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Invoice Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchaseReturns.map((purchaseReturn) => (
          <TableRow key={purchaseReturn.id}>
            <TableCell>
              <Link href={`/purchase/returns/${purchaseReturn.id}`} className="font-medium text-foreground hover:underline">
                {purchaseReturn.returnNumber ?? "Draft"}
              </Link>
            </TableCell>
            <TableCell>{purchaseReturn.purchaseInvoice.invoiceNumber}</TableCell>
            <TableCell>{purchaseReturn.purchaseInvoice.supplierName}</TableCell>
            <TableCell className="font-financial">{formatPurchaseReturnDate(purchaseReturn.returnDate)}</TableCell>
            <TableCell>
              <PurchaseReturnStatusBadge status={purchaseReturn.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{purchaseReturn.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/purchase/returns/${purchaseReturn.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
