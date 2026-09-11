import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReceiptVoucherCancelButton } from "@/modules/manual-vouchers/components/receipt-voucher-cancel-button";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";
import { receiptVoucherService } from "@/modules/manual-vouchers/services/receipt-voucher-service";

interface ReceiptVoucherDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    date
  );
}

/**
 * Read-only detail view (53-receipt-voucher.md's UI section) — no Edit, per
 * every voucher in this project being immutable once posted; correcting one
 * means Cancel + re-entry.
 */
export default async function ReceiptVoucherDetailPage({ params }: ReceiptVoucherDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/accounting/receipt-vouchers");
  }

  const [voucher, ledgerOptions, isAdmin, canCancel] = await Promise.all([
    receiptVoucherService.getReceiptVoucher(id),
    paymentVoucherService.listLedgerOptions(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "accounting", "approve"),
  ]);
  if (!voucher) {
    notFound();
  }

  const ledgerNameById = new Map(ledgerOptions.map((ledger) => [ledger.id, ledger.name]));

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{voucher.voucherNumber}</h1>
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
            </div>
            <p className="text-sm text-muted-foreground">{formatDate(voucher.voucherDate)}</p>
          </div>

          {canCancel && voucher.status === "POSTED" ? (
            <ReceiptVoucherCancelButton id={voucher.id} voucherNumber={voucher.voucherNumber} />
          ) : null}
        </div>

        {voucher.narration ? (
          <div>
            <p className="text-xs text-muted-foreground">Narration</p>
            <p className="text-sm text-foreground">{voucher.narration}</p>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ledger</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {voucher.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium text-foreground">
                    {ledgerNameById.get(entry.ledgerId) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.entryType === "DEBIT" ? "Debit" : "Credit"}
                  </TableCell>
                  <TableCell className="text-right font-financial">{entry.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-sm text-muted-foreground">
          Total: <span className="font-financial text-foreground">{voucher.totalAmount.toFixed(2)}</span>
        </p>
      </div>
    </AppShell>
  );
}
