import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LiabilitySettlementReport } from "@/types/liability-settlement";

interface LiabilitySettlementTableProps {
  report: LiabilitySettlementReport;
  /**
   * Gated on `accounting`/`create` — the same permission Payment Voucher's
   * own New screen requires. A `view`-only role can see this list but not
   * post a Payment Voucher, so the "Settle" link is hidden rather than
   * dead-ending at that page's own `redirect("/")`, mirroring
   * goods-receipt-note-status-actions.tsx's `canCreateInvoice` precedent for
   * the identical "read screen links into a create-gated destination" shape.
   */
  canSettle: boolean;
}

/**
 * The Liability Settlement screen's own table (87-liability-settlement.md's
 * UI section): Ledger Group, Ledger Name, Outstanding Amount, and a "Settle"
 * link per row that navigates straight into Payment Voucher's existing New
 * screen with that ledger and amount prefilled via query params — this
 * component posts nothing itself.
 */
export function LiabilitySettlementTable({ report, canSettle }: LiabilitySettlementTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No liability ledger has an outstanding balance as of this date.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ledger Group</TableHead>
          <TableHead>Ledger Name</TableHead>
          <TableHead className="text-right">Outstanding Amount</TableHead>
          {canSettle ? <TableHead className="text-right">Action</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.ledgerId}>
            <TableCell className="text-muted-foreground">{row.ledgerGroupName}</TableCell>
            <TableCell className="font-medium text-foreground">{row.ledgerName}</TableCell>
            <TableCell className="text-right font-financial">{row.outstandingAmount.toFixed(2)}</TableCell>
            {canSettle ? (
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link
                      href={`/accounting/payment-vouchers/new?${new URLSearchParams({
                        debitLedgerId: row.ledgerId,
                        amount: String(row.outstandingAmount),
                      }).toString()}`}
                    >
                      Settle
                    </Link>
                  }
                />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2} className="font-medium text-foreground">
            Grand Total
          </TableCell>
          <TableCell className="text-right font-financial font-medium text-foreground">
            {report.totalOutstanding.toFixed(2)}
          </TableCell>
          {canSettle ? <TableCell /> : null}
        </TableRow>
      </TableFooter>
    </Table>
  );
}
