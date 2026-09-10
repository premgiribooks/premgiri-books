"use client";

import * as React from "react";
import { toast } from "sonner";

import { BranchCard } from "@/modules/branch/components/branch-card";
import { selectBranchAction } from "@/modules/branch/actions/branch-actions";
import type { Branch } from "@/types/branch";

interface BranchSelectorProps {
  branches: Branch[];
}

export function BranchSelector({ branches }: BranchSelectorProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const hasAutoSelected = React.useRef(false);

  const handleSelect = React.useCallback(async (branchId: string) => {
    setPendingId(branchId);
    const result = await selectBranchAction(branchId);
    if (result && !result.success) {
      toast.error(result.error ?? "Failed to select branch.");
    }
    setPendingId(null);
  }, []);

  React.useEffect(() => {
    // Unlike Company/Financial Year Selection, Branch has no "current" flag —
    // auto-select fires only when exactly one active branch exists
    // (12-branch-management.md's Branch Selection rules).
    if (branches.length === 1 && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      void handleSelect(branches[0].id);
    }
  }, [branches, handleSelect]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {branches.map((branch) => (
        <BranchCard
          key={branch.id}
          branch={branch}
          onSelect={() => handleSelect(branch.id)}
          isSelecting={pendingId === branch.id}
        />
      ))}
    </div>
  );
}
