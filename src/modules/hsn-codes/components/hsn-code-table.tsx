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
import {
  activateHsnCodeAction,
  deactivateHsnCodeAction,
} from "@/modules/hsn-codes/actions/hsn-code-actions";
import { HsnCodeStatusBadge } from "@/modules/hsn-codes/components/hsn-code-status-badge";
import { HsnCodeTypeBadge } from "@/modules/hsn-codes/components/hsn-code-type-badge";
import type { ActionResult } from "@/types/api";
import type { HsnCode } from "@/types/hsn-code";

interface HsnCodeTableProps {
  hsnCodes: HsnCode[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<HsnCode>>>;
  canEdit?: boolean;
  canManage?: boolean;
}

export function HsnCodeTable({
  hsnCodes: initialHsnCodes,
  initialHasMore = false,
  loadMore,
  canEdit = false,
  canManage = false,
}: HsnCodeTableProps) {
  const { items: hsnCodes, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialHsnCodes,
    initialHasMore,
    loadMore,
  });
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — a lone id would be
  // overwritten by the second click and cleared by whichever action finishes
  // first, re-enabling the still-in-flight row's button.
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(hsnCode: HsnCode) {
    setPendingIds((prev) => new Set(prev).add(hsnCode.id));
    const action = hsnCode.isActive ? deactivateHsnCodeAction : activateHsnCodeAction;

    try {
      const result = await action(hsnCode.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update HSN/SAC code status.");
        return;
      }
      toast.success(hsnCode.isActive ? "HSN/SAC code deactivated." : "HSN/SAC code activated.");
    } catch {
      toast.error("Failed to update HSN/SAC code status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(hsnCode.id);
        return next;
      });
    }
  }

  if (hsnCodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No HSN/SAC codes found.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hsnCodes.map((hsnCode) => (
            <TableRow key={hsnCode.id}>
              <TableCell>
                <span className="font-financial font-medium text-foreground">{hsnCode.code}</span>
              </TableCell>
              <TableCell>
                <HsnCodeTypeBadge codeType={hsnCode.codeType} />
              </TableCell>
              <TableCell>{hsnCode.description}</TableCell>
              <TableCell>
                <HsnCodeStatusBadge isActive={hsnCode.isActive} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={
                        <Link
                          href={`/masters/hsn-codes/${hsnCode.id}/edit`}
                          aria-label="Edit HSN/SAC code"
                        >
                          <Pencil size={16} />
                        </Link>
                      }
                    />
                  ) : null}
                  {canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingIds.has(hsnCode.id)}
                      onClick={() => handleToggleActive(hsnCode)}
                    >
                      {hsnCode.isActive ? "Deactivate" : "Activate"}
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
