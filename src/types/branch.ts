import type { Branch as PrismaBranch } from "@prisma/client";

// No Decimal columns on Branch — the Prisma row serializes as-is across the
// Server Component / Server Action boundary (unlike GstRate/Ledger).
export type Branch = PrismaBranch;

export type ActivateBranchResult = { status: "not_found" } | { status: "ok"; branch: Branch };

export type DeactivateBranchResult = { status: "not_found" } | { status: "ok"; branch: Branch };
