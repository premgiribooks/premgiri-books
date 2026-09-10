import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  branchRepository,
  type BranchPersistData,
} from "@/modules/branch/repositories/branch-repository";
import {
  createBranchSchema,
  updateBranchSchema,
  type CreateBranchInput,
  type UpdateBranchInput,
} from "@/modules/branch/validation/branch-schema";
import type { Branch } from "@/types/branch";

// The permission catalog (11-role-permissions.md) has no dedicated "branch"
// module and 12-branch-management.md forbids extending the RBAC model, so
// Branch gates on the "company" module — Branches are Company-family master
// data (architecture-context.md), and only the Company Admin role holds any
// "company" permission pair (TenantBootstrapService grants it full catalog
// coverage; no other reserved role in src/constants/permissions.ts's
// DEFAULT_ROLE_PERMISSIONS lists "company" at all), matching the spec's
// "Only Administrator users may Create, Edit, Activate, Deactivate branches."
// Activate/Deactivate reuse "delete" as the lifecycle action, mirroring
// warehouse-service.ts/ledger-service.ts's identical reasoning (the catalog
// has no dedicated activate/deactivate action).
const LIFECYCLE_ACTION = "delete";

const NOT_FOUND_MESSAGE = "Branch not found.";

function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "branchCode")) {
    throw new AppError("A branch with this code already exists in this company.");
  }
  throw error;
}

function toPersistData(data: CreateBranchInput): BranchPersistData {
  return {
    branchName: data.branchName,
    branchCode: data.branchCode,
    address: data.address ?? null,
    contactNumber: data.contactNumber ?? null,
    gstRegistration: data.gstRegistration ?? null,
  };
}

export const branchService = {
  async listBranches(): Promise<Branch[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "company", "view");
    return branchRepository.findMany(user.companyId);
  },

  // A branch belonging to a different company must resolve identically to
  // "not found" — the same company-scoped-for-everyone rule
  // user-service.ts established (12-branch-management.md's Business Rules).
  //
  // Deliberately has NO assertPermission: getCurrentBranch() (src/lib/
  // current-branch.ts) calls this from RootLayout on every request for every
  // authenticated user, and Branch Selection itself is open to any
  // authenticated user, not just an Administrator (the spec's Security
  // section) — asserting "company"/"view" here would throw
  // AuthorizationError for a Sales/Purchase/Store Manager user who merely
  // has a branch selected.
  async getBranch(id: string): Promise<Branch | null> {
    const user = await getCurrentCompanyUser();

    const branch = await branchRepository.findById(id);
    if (!branch || branch.companyId !== user.companyId) {
      return null;
    }
    return branch;
  },

  // The Branch Selection screen's options — open to any authenticated user
  // (12-branch-management.md's Security section), so no assertPermission
  // here either, matching getBranch above.
  async listSelectableBranches(): Promise<Branch[]> {
    const user = await getCurrentCompanyUser();
    return branchRepository.findManyActive(user.companyId);
  },

  async createBranch(input: CreateBranchInput): Promise<Branch> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "company", "create");

    const data = createBranchSchema.parse(input);

    try {
      return await branchRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async updateBranch(id: string, input: UpdateBranchInput): Promise<Branch> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "company", "edit");

    const data = updateBranchSchema.parse(input);

    try {
      const branch = await branchRepository.update(id, user.companyId, toPersistData(data));
      if (!branch) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return branch;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateBranch(id: string): Promise<Branch> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "company", LIFECYCLE_ACTION);

    const result = await branchRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.branch;
    }
  },

  async deactivateBranch(id: string): Promise<Branch> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "company", LIFECYCLE_ACTION);

    const result = await branchRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.branch;
    }
  },
};
