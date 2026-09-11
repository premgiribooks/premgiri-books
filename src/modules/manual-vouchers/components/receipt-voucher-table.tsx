import Link from "next/link";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PostedVoucher } from "@/engines/voucher/types";

interface ReceiptVoucherTableProps {
  vouchers: PostedVoucher[];
  ledgerNameById: ReadonlyMap<string, string>;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    date
  );
}

/** "Received From" summary — every Credit entry's ledger, comma-joined; a single-Credit voucher (the common case) shows just that one name. */
function receivedFromSummary(voucher: PostedVoucher, ledgerNameById: ReadonlyMap<string, string>): string {
  const creditLedgerIds = voucher.entries.filter((entry) => entry.entryType === "CREDIT").map((entry) => entry.ledgerId);
  return creditLedgerIds.map((id) => ledgerNameById.get(id) ?? "—").join(", ");
}

export function ReceiptVoucherTable({ vouchers, ledgerNameById }: ReceiptVoucherTableProps) {
  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No receipt vouchers found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Received From</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vouchers.map((voucher) => (
          <TableRow key={voucher.id}>
            <TableCell className="font-medium text-foreground">{voucher.voucherNumber}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(voucher.voucherDate)}</TableCell>
            <TableCell className="text-muted-foreground">{receivedFromSummary(voucher, ledgerNameById)}</TableCell>
            <TableCell className="text-right font-financial">{voucher.totalAmount.toFixed(2)}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  voucher.status === "POSTED"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-muted-foreground/20 bg-muted text-muted-foreground"
                }
              >
                {voucher.status === "POSTED" ? "Posted" : "Cancelled"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                render={
                  <Link href={`/accounting/receipt-vouchers/${voucher.id}`} aria-label="View receipt voucher">
                    <Eye size={16} />
                  </Link>
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
