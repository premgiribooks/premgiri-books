"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { InfiniteScrollSentinel } from "@/components/common/infinite-scroll-sentinel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import type { Page } from "@/lib/pagination";
import { activateUnitAction, deactivateUnitAction } from "@/modules/units/actions/unit-actions";
import { UnitStatusBadge } from "@/modules/units/components/unit-status-badge";
import type { ActionResult } from "@/types/api";
import type { Unit } from "@/types/unit";

interface UnitTableProps {
  units: Unit[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<Unit>>>;
  canEdit?: boolean;
  canManage?: boolean;
}

export function UnitTable({
  units: initialUnits,
  initialHasMore = false,
  loadMore,
  canEdit = false,
  canManage = false,
}: UnitTableProps) {
  const { items: units, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialUnits,
    initialHasMore,
    loadMore,
  });
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleActive(unit: Unit) {
    setPendingId(unit.id);
    const action = unit.isActive ? deactivateUnitAction : activateUnitAction;

    try {
      const result = await action(unit.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update unit status.");
        return;
      }
      toast.success(unit.isActive ? "Unit deactivated." : "Unit activated.");
    } catch {
      toast.error("Failed to update unit status.");
    } finally {
      setPendingId(null);
    }
  }

  if (units.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No units found.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Symbol</TableHead>
          <TableHead>UQC</TableHead>
          <TableHead className="text-right">Decimal Places</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {units.map((unit) => (
          <TableRow key={unit.id}>
            <TableCell>
              <span className="font-medium text-foreground">{unit.name}</span>
            </TableCell>
            <TableCell>{unit.symbol}</TableCell>
            <TableCell>{unit.uqcCode ?? "—"}</TableCell>
            <TableCell className="text-right font-financial">{unit.decimalPlaces}</TableCell>
            <TableCell>
              <UnitStatusBadge isActive={unit.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link href={`/masters/units/${unit.id}/edit`} aria-label="Edit unit">
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === unit.id}
                    onClick={() => handleToggleActive(unit)}
                  >
                    {unit.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
      <InfiniteScrollSentinel hasMore={hasMore} isLoading={isLoading} sentinelRef={sentinelRef} />
    </>
  );
}
