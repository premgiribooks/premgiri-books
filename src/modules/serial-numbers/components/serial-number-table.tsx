"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  activateSerialNumberAction,
  deactivateSerialNumberAction,
} from "@/modules/serial-numbers/actions/serial-number-actions";
import type { SerialNumberWithStatus, SerialStatus } from "@/types/serial-number";

interface SerialNumberTableProps {
  serialNumbers: SerialNumberWithStatus[];
  canManage?: boolean;
}

const STATUS_LABEL: Record<SerialStatus, string> = {
  NO_MOVEMENTS: "Not Received",
  IN_STOCK: "In Stock",
  SOLD: "Sold",
  RETURNED: "Returned",
  OUT_OF_STOCK: "Out of Stock",
};

const STATUS_CLASS: Record<SerialStatus, string> = {
  NO_MOVEMENTS: "border-muted-foreground/20 bg-muted text-muted-foreground",
  IN_STOCK: "border-success/30 bg-success/10 text-success",
  SOLD: "border-muted-foreground/20 bg-muted text-muted-foreground",
  RETURNED: "border-warning/30 bg-warning/10 text-warning",
  OUT_OF_STOCK: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

/**
 * Serial Numbers tab content's table (51-serial-number-tracking.md's UI
 * section) — no Edit action exists (a serial is never renamed once created,
 * see the spec's Decisions), only Activate/Deactivate, mirroring
 * ProductBatchTable's shape minus its Edit column.
 */
export function SerialNumberTable({ serialNumbers, canManage = false }: SerialNumberTableProps) {
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(serialNumber: SerialNumberWithStatus) {
    setPendingIds((prev) => new Set(prev).add(serialNumber.id));
    const action = serialNumber.isActive ? deactivateSerialNumberAction : activateSerialNumberAction;

    try {
      const result = await action(serialNumber.id, serialNumber.productId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update serial number status.");
        return;
      }
      toast.success(serialNumber.isActive ? "Serial number deactivated." : "Serial number activated.");
    } catch {
      toast.error("Failed to update serial number status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(serialNumber.id);
        return next;
      });
    }
  }

  if (serialNumbers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No serial numbers found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Serial Value</TableHead>
          <TableHead>Current Status</TableHead>
          <TableHead>Current Warehouse</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {serialNumbers.map((serialNumber) => (
          <TableRow key={serialNumber.id}>
            <TableCell>
              <span className="font-medium text-foreground">{serialNumber.serialValue}</span>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={STATUS_CLASS[serialNumber.status]}>
                {STATUS_LABEL[serialNumber.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {serialNumber.currentWarehouseName ?? "—"}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  serialNumber.isActive
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-muted-foreground/20 bg-muted text-muted-foreground"
                }
              >
                {serialNumber.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {canManage ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingIds.has(serialNumber.id)}
                  onClick={() => handleToggleActive(serialNumber)}
                >
                  {serialNumber.isActive ? "Deactivate" : "Activate"}
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
