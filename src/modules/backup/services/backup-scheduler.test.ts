import { beforeEach, describe, expect, it, vi } from "vitest";

const { findLatestSucceededBackupSinceMock, runBackupMock } = vi.hoisted(() => ({
  findLatestSucceededBackupSinceMock: vi.fn(),
  runBackupMock: vi.fn(),
}));

vi.mock("@/modules/backup/repositories/backup-job-repository", () => ({
  backupJobRepository: { findLatestSucceededBackupSince: findLatestSucceededBackupSinceMock },
}));

vi.mock("@/modules/backup/services/backup-service", () => ({
  backupService: { runBackup: runBackupMock },
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { ensureDailyBackup } from "@/modules/backup/services/backup-scheduler";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureDailyBackup", () => {
  it("triggers exactly one SCHEDULED backup when no SUCCEEDED backup exists for today", async () => {
    findLatestSucceededBackupSinceMock.mockResolvedValue(null);
    runBackupMock.mockResolvedValue({ status: "SUCCEEDED" });

    await ensureDailyBackup();

    expect(runBackupMock).toHaveBeenCalledTimes(1);
    expect(runBackupMock).toHaveBeenCalledWith("SCHEDULED", null);
  });

  it("does not trigger a second backup on a same-day re-check", async () => {
    findLatestSucceededBackupSinceMock.mockResolvedValue({
      id: "job-1",
      status: "SUCCEEDED",
      jobType: "BACKUP",
    });

    await ensureDailyBackup();

    expect(runBackupMock).not.toHaveBeenCalled();
  });
});
