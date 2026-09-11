"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  activateProductBatchAction,
  deactivateProductBatchAction,
} from "@/modules/product-batches/actions/product-batch-actions";
import { formatProductBatchDate } from "@/modules/product-batches/utils/format-product-batch-date";
import type { ProductBatchWithStock } from "@/types/product-batch";

interface ProductBatchTableProps {
  batches: ProductBatchWithStock[];
  canEdit?: boolean;
  canManage?: boolean;
  /** No page route owns batch editing yet (50-batch-tracking.md's deferred
   * UI entry point) — the composing screen supplies how "Edit" opens
   * ProductBatchForm (a dialog, a panel, etc). */
  onEdit?: (batch: ProductBatchWithStock) => void;
}

export function ProductBatchTable({ batches, canEdit = false, canManage = false, onEdit }: ProductBatchTableProps) {
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(batch: ProductBatchWithStock) {
    setPendingIds((prev) => new Set(prev).add(batch.id));
    const action = batch.isActive ? deactivateProductBatchAction : activateProductBatchAction;

    try {
      const result = await action(batch.id, batch.productId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update batch status.");
        return;
      }
      toast.success(batch.isActive ? "Batch deactivated." : "Batch activated.");
    } catch {
      toast.error("Failed to update batch status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(batch.id);
        return next;
      });
    }
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No batches found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch Number</TableHead>
          <TableHead>Manufacture Date</TableHead>
          <TableHead>Expiry Date</TableHead>
          <TableHead className="text-right">Current Stock</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((batch) => (
          <TableRow key={batch.id}>
            <TableCell>
              <span className="font-medium text-foreground">{batch.batchNumber}</span>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {batch.manufactureDate ? formatProductBatchDate(batch.manufactureDate) : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {batch.expiryDate ? formatProductBatchDate(batch.expiryDate) : "—"}
            </TableCell>
            <TableCell className="text-right font-financial">{batch.currentStock}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  batch.isActive
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-muted-foreground/20 bg-muted text-muted-foreground"
                }
              >
                {batch.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button variant="ghost" size="sm" onClick={() => onEdit?.(batch)}>
                    Edit
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingIds.has(batch.id)}
                    onClick={() => handleToggleActive(batch)}
                  >
                    {batch.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
