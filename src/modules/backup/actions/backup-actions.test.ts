import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentSuperAdminMock, assertSuperAdminMock, isRestoreInProgressMock, runBackupMock } = vi.hoisted(
  () => ({
    getCurrentSuperAdminMock: vi.fn(),
    assertSuperAdminMock: vi.fn(),
    isRestoreInProgressMock: vi.fn(),
    runBackupMock: vi.fn(),
  })
);

vi.mock("@/lib/current-user", () => ({
  getCurrentSuperAdmin: getCurrentSuperAdminMock,
  assertSuperAdmin: assertSuperAdminMock,
}));

vi.mock("@/lib/restore-lock", () => ({ isRestoreInProgress: isRestoreInProgressMock }));

vi.mock("@/modules/backup/services/backup-service", () => ({
  backupService: { runBackup: runBackupMock, runRestore: vi.fn(), listJobs: vi.fn() },
}));

import { getRestoreStatusAction, runBackupNowAction } from "@/modules/backup/actions/backup-actions";

beforeEach(() => {
  vi.clearAllMocks();
  isRestoreInProgressMock.mockReturnValue(false);
});

describe("runBackupNowAction", () => {
  it("requires Super Admin — a non-Super-Admin caller cannot trigger a backup", async () => {
    getCurrentSuperAdminMock.mockRejectedValue(new Error("Only Super Admin can perform this action."));

    const result = await runBackupNowAction();

    expect(result.success).toBe(false);
    expect(runBackupMock).not.toHaveBeenCalled();
  });

  it("is blocked by the restore guard while a Restore is running, without ever calling the service", async () => {
    isRestoreInProgressMock.mockReturnValue(true);

    const result = await runBackupNowAction();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/restore is currently running/i);
    expect(getCurrentSuperAdminMock).not.toHaveBeenCalled();
    expect(runBackupMock).not.toHaveBeenCalled();
  });
});

describe("getRestoreStatusAction", () => {
  it("bypasses the restore guard — it keeps succeeding, reporting isRestoring: true, exactly while a restore is running", async () => {
    isRestoreInProgressMock.mockReturnValue(true);
    assertSuperAdminMock.mockResolvedValue(undefined);

    const result = await getRestoreStatusAction();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ isRestoring: true });
  });
});
