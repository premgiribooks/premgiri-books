import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  isRecordNotFoundError,
  isRetryableTransactionError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";

function knownRequestError(code: string, meta?: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("test error", {
    code,
    clientVersion: "test",
    meta,
  });
}

describe("isRecordNotFoundError", () => {
  it("is true only for P2025", () => {
    expect(isRecordNotFoundError(knownRequestError("P2025"))).toBe(true);
    expect(isRecordNotFoundError(knownRequestError("P2002"))).toBe(false);
    expect(isRecordNotFoundError(new Error("plain"))).toBe(false);
  });
});

describe("isRetryableTransactionError", () => {
  it("is true only for P2034", () => {
    expect(isRetryableTransactionError(knownRequestError("P2034"))).toBe(true);
    expect(isRetryableTransactionError(knownRequestError("P2002"))).toBe(false);
  });
});

describe("isUniqueConstraintError", () => {
  it("is false for a non-P2002 error", () => {
    expect(isUniqueConstraintError(knownRequestError("P2025"))).toBe(false);
    expect(isUniqueConstraintError(new Error("plain"))).toBe(false);
  });

  it("is true for any P2002 when no column is given", () => {
    expect(isUniqueConstraintError(knownRequestError("P2002"))).toBe(true);
  });

  it("matches a column via the legacy meta.target array shape", () => {
    const error = knownRequestError("P2002", { target: ["companyId", "productId", "serialValue"] });
    expect(isUniqueConstraintError(error, "serialValue")).toBe(true);
    expect(isUniqueConstraintError(error, "batchNumber")).toBe(false);
  });

  // The actual shape `@prisma/client` 7.8.0's Postgres driver adapter throws
  // for a P2002 — no `meta.target` at all; found by reproducing a real
  // duplicate-serial-value insert against a live database (see
  // src/lib/prisma-errors.ts's violatedConstraintColumns doc comment).
  it("matches a column via the current driver-adapter meta shape (quoted field names)", () => {
    const error = knownRequestError("P2002", {
      modelName: "SerialNumber",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          originalCode: "23505",
          originalMessage:
            'duplicate key value violates unique constraint "SerialNumber_companyId_productId_serialValue_key"',
          kind: "UniqueConstraintViolation",
          constraint: { fields: ['"companyId"', '"productId"', '"serialValue"'] },
        },
      },
    });
    expect(isUniqueConstraintError(error, "serialValue")).toBe(true);
    expect(isUniqueConstraintError(error, "batchNumber")).toBe(false);
  });

  it("is false for a specific column when neither shape is present", () => {
    expect(isUniqueConstraintError(knownRequestError("P2002"), "serialValue")).toBe(false);
  });
});
