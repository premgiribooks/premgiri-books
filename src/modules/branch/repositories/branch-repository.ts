import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type { ActivateBranchResult, Branch, DeactivateBranchResult } from "@/types/branch";

export interface BranchPersistData {
  branchName: string;
  branchCode: string;
  address: string | null;
  contactNumber: string | null;
  gstRegistration: string | null;
}

export const branchRepository = {
  async findMany(companyId: string): Promise<Branch[]> {
    return prisma.branch.findMany({ where: { companyId }, orderBy: { branchName: "asc" } });
  },

  // The Branch Selection screen's options (12-branch-management.md) — only
  // active branches are ever offered for selection.
  async findManyActive(companyId: string): Promise<Branch[]> {
    return prisma.branch.findMany({
      where: { companyId, isActive: true },
      orderBy: { branchName: "asc" },
    });
  },

  async findById(id: string): Promise<Branch | null> {
    return prisma.branch.findUnique({ where: { id } });
  },

  // No Serializable isolation — a Branch has no cross-row invariant to guard
  // (unlike Warehouse's one-default flag or Financial Year's one-current
  // flag); "zero active branches" is itself a fully-supported state
  // (12-branch-management.md's Features section).
  async create(companyId: string, data: BranchPersistData): Promise<Branch> {
    return prisma.branch.create({ data: { ...data, companyId } });
  },

  async update(id: string, companyId: string, data: BranchPersistData): Promise<Branch | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.branch.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      try {
        return await tx.branch.update({ where: { id }, data });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateBranchResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.branch.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const branch = await tx.branch.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", branch };
    });
  },

  // Deactivating a branch does not cascade to anything that may reference it
  // later (12-branch-management.md's Features section — "does not delete or
  // alter anything that may reference it later"); the reverse of Warehouse's
  // existing "a branch later deactivated does not cascade to its warehouses"
  // note. Any active branch, including the last one, may be deactivated
  // freely — there is no "at least one active branch" invariant to protect.
  async deactivate(id: string, companyId: string): Promise<DeactivateBranchResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.branch.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const branch = await tx.branch.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", branch };
    });
  },
};
