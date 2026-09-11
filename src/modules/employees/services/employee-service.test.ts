import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// employee-service.ts imports employee-repository.ts, which imports the
// module-level `prisma` client — mocked for the same reason
// employee-repository.test.ts mocks it (importing without this throws at
// import time outside a configured environment).
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { translatePersistError } from "@/modules/employees/services/employee-service";
import { USER_ALREADY_LINKED_MESSAGE } from "@/modules/employees/repositories/employee-repository";

function uniqueConstraintError(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("employeeService.translatePersistError", () => {
  it("translates an employeeCode uniqueness violation into a friendly message", () => {
    expect(() => translatePersistError(uniqueConstraintError(["companyId", "employeeCode"]))).toThrow(
      "An employee with this code already exists in this company."
    );
  });

  it("translates a userId uniqueness violation (a race past assertAssignableUser) into the shared friendly message", () => {
    expect(() => translatePersistError(uniqueConstraintError(["userId"]))).toThrow(
      USER_ALREADY_LINKED_MESSAGE
    );
  });

  it("rethrows any other error unchanged", () => {
    const error = new Error("boom");
    expect(() => translatePersistError(error)).toThrow(error);
  });
});
