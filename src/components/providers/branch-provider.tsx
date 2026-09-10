"use client";

import * as React from "react";

import type { Branch } from "@/types/branch";

interface BranchContextValue {
  branch: Branch | null;
  isLoading: boolean;
}

const BranchContext = React.createContext<BranchContextValue | undefined>(undefined);

interface BranchProviderProps {
  initialBranch: Branch | null;
  children: React.ReactNode;
}

export function BranchProvider({ initialBranch, children }: BranchProviderProps) {
  const value = React.useMemo<BranchContextValue>(
    () => ({ branch: initialBranch, isLoading: false }),
    [initialBranch]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch(): BranchContextValue {
  const context = React.useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within a BranchProvider");
  }

  return context;
}
