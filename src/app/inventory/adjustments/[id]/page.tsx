import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { StockAdjustmentStatusActions } from "@/modules/stock-adjustments/components/stock-adjustment-status-actions";
import { StockAdjustmentStatusBadge } from "@/modules/stock-adjustments/components/stock-adjustment-status-badge";
import { formatStockAdjustmentDate } from "@/modules/stock-adjustments/utils/format-stock-adjustment-date";
import { stockAdjustmentService } from "@/modules/stock-adjustments/services/stock-adjustment-service";

interface StockAdjustmentDetailPageProps {
  params: Promise<{ id: string }>;
}

const DIRECTION_LABELS = { IN: "Found (IN)", OUT: "Write-off (OUT)" } as const;

export default async function StockAdjustmentDetailPage({ params }: StockAdjustmentDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "inventory", "view");
  if (!canView) {
    redirect("/");
  }

  const stockAdjustment = await stockAdjustmentService.getStockAdjustment(id);
  if (!stockAdjustment) {
    notFound();
  }

  const [isAdmin, canEdit, canApprove] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "inventory", "edit"),
    hasPermission(user, "inventory", "approve"),
  ]);

  const isEditable = stockAdjustment.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{stockAdjustment.adjustmentNumber ?? "Draft Stock Adjustment"}</h1>
              <StockAdjustmentStatusBadge status={stockAdjustment.status} />
            </div>
            <p className="text-sm text-muted-foreground">{formatStockAdjustmentDate(stockAdjustment.adjustmentDate)}</p>
          </div>

          <div className="flex items-center gap-2">
            {isEditable && canEdit ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/inventory/adjustments/${stockAdjustment.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <StockAdjustmentStatusActions stockAdjustment={stockAdjustment} canPost={canApprove} canCancel={canApprove} />
          </div>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Reason</p>
          <p className="text-sm text-foreground">{stockAdjustment.reason}</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Narration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockAdjustment.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.productName}
                    {item.productCode ? ` (${item.productCode})` : ""}
                  </TableCell>
                  <TableCell>{item.warehouseName}</TableCell>
                  <TableCell>{DIRECTION_LABELS[item.direction]}</TableCell>
                  <TableCell className="text-right font-financial">
                    {item.quantity} {item.unitSymbol}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.narration ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
