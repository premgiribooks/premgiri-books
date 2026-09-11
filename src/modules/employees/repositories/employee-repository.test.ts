import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

// employee-repository.ts imports the module-level `prisma` client (used by
// findMany/findById/create/update, which each open their own
// runInTransaction) even though assertAssignableBranch/assertAssignableUser
// take their own `tx` parameter — importing the real module without this
// mock throws at import time ("DATABASE_URL is not set") outside a
// configured environment, mirroring customer-repository.test.ts's
// convention of mocking "@/lib/prisma" rather than hitting a real database.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  assertAssignableBranch,
  assertAssignableUser,
  BRANCH_INACTIVE_MESSAGE,
  BRANCH_NOT_FOUND_MESSAGE,
  USER_ALREADY_LINKED_MESSAGE,
  USER_INACTIVE_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from "@/modules/employees/repositories/employee-repository";

const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";

function fakeTx(overrides: {
  branchFindUnique?: unknown;
  userFindUnique?: unknown;
  employeeFindUnique?: unknown;
}) {
  return {
    branch: { findUnique: vi.fn().mockResolvedValue(overrides.branchFindUnique ?? null) },
    user: { findUnique: vi.fn().mockResolvedValue(overrides.userFindUnique ?? null) },
    employee: { findUnique: vi.fn().mockResolvedValue(overrides.employeeFindUnique ?? null) },
  } as unknown as Prisma.TransactionClient;
}

describe("assertAssignableBranch", () => {
  it("throws when the branch does not exist", async () => {
    const tx = fakeTx({ branchFindUnique: null });

    await expect(assertAssignableBranch(tx, COMPANY_ID, "branch-1")).rejects.toThrow(
      BRANCH_NOT_FOUND_MESSAGE
    );
  });

  it("throws when the branch belongs to a different company", async () => {
    const tx = fakeTx({ branchFindUnique: { id: "branch-1", companyId: OTHER_COMPANY_ID, isActive: true } });

    await expect(assertAssignableBranch(tx, COMPANY_ID, "branch-1")).rejects.toThrow(
      BRANCH_NOT_FOUND_MESSAGE
    );
  });

  it("throws when the branch is inactive", async () => {
    const tx = fakeTx({ branchFindUnique: { id: "branch-1", companyId: COMPANY_ID, isActive: false } });

    await expect(assertAssignableBranch(tx, COMPANY_ID, "branch-1")).rejects.toThrow(
      BRANCH_INACTIVE_MESSAGE
    );
  });

  it("succeeds for an active, same-company branch", async () => {
    const tx = fakeTx({ branchFindUnique: { id: "branch-1", companyId: COMPANY_ID, isActive: true } });

    await expect(assertAssignableBranch(tx, COMPANY_ID, "branch-1")).resolves.toBeUndefined();
  });
});

describe("assertAssignableUser", () => {
  it("throws when the user does not exist", async () => {
    const tx = fakeTx({ userFindUnique: null });

    await expect(assertAssignableUser(tx, COMPANY_ID, "user-1", null)).rejects.toThrow(
      USER_NOT_FOUND_MESSAGE
    );
  });

  it("throws when the user belongs to a different company", async () => {
    const tx = fakeTx({
      userFindUnique: { id: "user-1", companyId: OTHER_COMPANY_ID, isActive: true },
    });

    await expect(assertAssignableUser(tx, COMPANY_ID, "user-1", null)).rejects.toThrow(
      USER_NOT_FOUND_MESSAGE
    );
  });

  it("throws when the user is inactive", async () => {
    const tx = fakeTx({
      userFindUnique: { id: "user-1", companyId: COMPANY_ID, isActive: false },
    });

    await expect(assertAssignableUser(tx, COMPANY_ID, "user-1", null)).rejects.toThrow(
      USER_INACTIVE_MESSAGE
    );
  });

  it("throws when the user is already linked to a different employee", async () => {
    const tx = fakeTx({
      userFindUnique: { id: "user-1", companyId: COMPANY_ID, isActive: true },
      employeeFindUnique: { id: "employee-other" },
    });

    await expect(assertAssignableUser(tx, COMPANY_ID, "user-1", "employee-self")).rejects.toThrow(
      USER_ALREADY_LINKED_MESSAGE
    );
  });

  it("succeeds when the user is already linked to the SAME employee being edited (re-submitting an unchanged link)", async () => {
    const tx = fakeTx({
      userFindUnique: { id: "user-1", companyId: COMPANY_ID, isActive: true },
      employeeFindUnique: { id: "employee-self" },
    });

    await expect(
      assertAssignableUser(tx, COMPANY_ID, "user-1", "employee-self")
    ).resolves.toBeUndefined();
  });

  it("succeeds for an active, same-company, unlinked user", async () => {
    const tx = fakeTx({
      userFindUnique: { id: "user-1", companyId: COMPANY_ID, isActive: true },
      employeeFindUnique: null,
    });

    await expect(assertAssignableUser(tx, COMPANY_ID, "user-1", null)).resolves.toBeUndefined();
  });
});
