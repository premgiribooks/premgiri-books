import { describe, expect, it } from "vitest";

import { RESTORE_CONFIRMATION_PHRASE, restoreSchema } from "@/modules/backup/validation/backup-schema";

const VALID_ID = "11111111-1111-4111-8111-111111111111";

describe("restoreSchema", () => {
  it("accepts a valid uuid with the exact confirmation phrase", () => {
    const result = restoreSchema.safeParse({
      backupJobId: VALID_ID,
      confirmationText: RESTORE_CONFIRMATION_PHRASE,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a mismatched confirmation phrase — a client-forged 'confirmed' flag without the matching text", () => {
    const result = restoreSchema.safeParse({
      backupJobId: VALID_ID,
      confirmationText: "yes i confirm",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty confirmation phrase", () => {
    const result = restoreSchema.safeParse({ backupJobId: VALID_ID, confirmationText: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid backupJobId", () => {
    const result = restoreSchema.safeParse({
      backupJobId: "not-a-uuid",
      confirmationText: RESTORE_CONFIRMATION_PHRASE,
    });
    expect(result.success).toBe(false);
  });
});
