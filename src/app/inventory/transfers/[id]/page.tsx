import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { StockTransferStatusActions } from "@/modules/stock-transfers/components/stock-transfer-status-actions";
import { StockTransferStatusBadge } from "@/modules/stock-transfers/components/stock-transfer-status-badge";
import { formatStockTransferDate } from "@/modules/stock-transfers/utils/format-stock-transfer-date";
import { stockTransferService } from "@/modules/stock-transfers/services/stock-transfer-service";

interface StockTransferDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StockTransferDetailPage({ params }: StockTransferDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "inventory", "view");
  if (!canView) {
    redirect("/");
  }

  const stockTransfer = await stockTransferService.getStockTransfer(id);
  if (!stockTransfer) {
    notFound();
  }

  const [isAdmin, canEdit, canApprove] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "inventory", "edit"),
    hasPermission(user, "inventory", "approve"),
  ]);

  const isEditable = stockTransfer.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{stockTransfer.transferNumber ?? "Draft Stock Transfer"}</h1>
              <StockTransferStatusBadge status={stockTransfer.status} />
            </div>
            <p className="text-sm text-muted-foreground">{formatStockTransferDate(stockTransfer.transferDate)}</p>
          </div>

          <div className="flex items-center gap-2">
            {isEditable && canEdit ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/inventory/transfers/${stockTransfer.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <StockTransferStatusActions stockTransfer={stockTransfer} canPost={canApprove} canCancel={canApprove} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Source Warehouse</p>
            <p className="text-sm text-foreground">{stockTransfer.sourceWarehouseName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Destination Warehouse</p>
            <p className="text-sm text-foreground">{stockTransfer.destinationWarehouseName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Narration</p>
            <p className="text-sm text-foreground">{stockTransfer.narration ?? "—"}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockTransfer.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.productName} ({item.productCode})
                  </TableCell>
                  <TableCell className="text-right font-financial">
                    {item.quantity} {item.unitSymbol}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
