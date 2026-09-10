"use client";

import { Building } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BranchStatusBadge } from "@/modules/branch/components/branch-status-badge";
import type { Branch } from "@/types/branch";

interface BranchCardProps {
  branch: Branch;
  onSelect: () => void;
  isSelecting?: boolean;
}

export function BranchCard({ branch, onSelect, isSelecting }: BranchCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isSelecting}
      className="w-full text-left outline-none disabled:opacity-60"
    >
      <Card className="transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
              <Building size={20} />
            </div>
            <CardTitle>{branch.branchName}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{branch.branchCode}</span>
          <BranchStatusBadge isActive={branch.isActive} />
        </CardContent>
      </Card>
    </button>
  );
}
