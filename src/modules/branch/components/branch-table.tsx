"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activateBranchAction, deactivateBranchAction } from "@/modules/branch/actions/branch-actions";
import { BranchStatusBadge } from "@/modules/branch/components/branch-status-badge";
import type { Branch } from "@/types/branch";

interface BranchTableProps {
  branches: Branch[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function BranchTable({ branches, canEdit = false, canManage = false }: BranchTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — the
  // hsn-code-table.tsx review-fix pattern (2026-07-15).
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  function markPending(id: string) {
    setPendingIds((prev) => new Set(prev).add(id));
  }

  function clearPending(id: string) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleToggleActive(branch: Branch) {
    markPending(branch.id);
    const action = branch.isActive ? deactivateBranchAction : activateBranchAction;

    try {
      const result = await action(branch.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update branch status.");
        return;
      }
      toast.success(branch.isActive ? "Branch deactivated." : "Branch activated.");
    } catch {
      toast.error("Failed to update branch status.");
    } finally {
      clearPending(branch.id);
    }
  }

  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No branches found.</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          A company with no branches works normally — branches are optional.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Branch Name</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>GSTIN</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {branches.map((branch) => (
          <TableRow key={branch.id}>
            <TableCell>
              <span className="font-medium text-foreground">{branch.branchName}</span>
            </TableCell>
            <TableCell>{branch.branchCode}</TableCell>
            <TableCell>
              {branch.contactNumber ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              {branch.gstRegistration ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              <BranchStatusBadge isActive={branch.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link href={`/branch/${branch.id}/edit`} aria-label="Edit branch">
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingIds.has(branch.id)}
                    onClick={() => handleToggleActive(branch)}
                  >
                    {branch.isActive ? "Deactivate" : "Activate"}
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
