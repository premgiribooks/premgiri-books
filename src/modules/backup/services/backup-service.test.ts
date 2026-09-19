import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMock,
  markRunningMock,
  markSucceededMock,
  markFailedMock,
  findByIdMock,
  execFileMock,
  mkdirMock,
  accessMock,
  statMock,
  assertSuperAdminMock,
  isRestoreInProgressMock,
  setRestoreInProgressMock,
  disconnectMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  markRunningMock: vi.fn(),
  markSucceededMock: vi.fn(),
  markFailedMock: vi.fn(),
  findByIdMock: vi.fn(),
  execFileMock: vi.fn(),
  mkdirMock: vi.fn(),
  accessMock: vi.fn(),
  statMock: vi.fn(),
  assertSuperAdminMock: vi.fn(),
  isRestoreInProgressMock: vi.fn(),
  setRestoreInProgressMock: vi.fn(),
  disconnectMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/modules/backup/repositories/backup-job-repository", () => ({
  backupJobRepository: {
    create: createMock,
    markRunning: markRunningMock,
    markSucceeded: markSucceededMock,
    markFailed: markFailedMock,
    findById: findByIdMock,
  },
}));

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

vi.mock("node:fs", () => ({
  promises: { mkdir: mkdirMock, access: accessMock, stat: statMock },
  constants: { W_OK: 2 },
}));

vi.mock("@/lib/current-user", () => ({ assertSuperAdmin: assertSuperAdminMock }));
vi.mock("@/lib/restore-lock", () => ({
  isRestoreInProgress: isRestoreInProgressMock,
  setRestoreInProgress: setRestoreInProgressMock,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $disconnect: disconnectMock } }));
vi.mock("@/lib/logger", () => ({ logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn() } }));

import { backupService } from "@/modules/backup/services/backup-service";

const STARTED_AT = new Date("2026-09-18T10:00:00.000Z");
const DATABASE_URL = "postgresql://user:pass@localhost:5432/premgiri";

function pendingJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    jobType: "BACKUP",
    status: "PENDING",
    trigger: "MANUAL",
    startedAt: STARTED_AT,
    filePath: null,
    fileSizeBytes: null,
    errorMessage: null,
    triggeredBy: null,
    restoredFromJob: null,
    ...overrides,
  };
}

type ExecFileCallback = (err: Error | null, stdout?: string, stderr?: string) => void;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = DATABASE_URL;
  isRestoreInProgressMock.mockReturnValue(false);
  mkdirMock.mockResolvedValue(undefined);
  accessMock.mockResolvedValue(undefined);
  statMock.mockResolvedValue({ size: 1024 });
  execFileMock.mockImplementation(
    (_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(null, "", "");
    }
  );
});

describe("backupService.runBackup", () => {
  it("transitions PENDING -> RUNNING -> SUCCEEDED and records file path/size on success", async () => {
    const job = pendingJob();
    createMock.mockResolvedValue(job);
    markRunningMock.mockResolvedValue({ ...job, status: "RUNNING" });
    markSucceededMock.mockResolvedValue({ ...job, status: "SUCCEEDED" });

    const result = await backupService.runBackup("MANUAL", "user-1");

    expect(createMock).toHaveBeenCalledWith({
      jobType: "BACKUP",
      trigger: "MANUAL",
      triggeredByUserId: "user-1",
    });
    expect(markRunningMock).toHaveBeenCalledWith("job-1");
    expect(markSucceededMock).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ fileSizeBytes: BigInt(1024) })
    );
    expect(result.status).toBe("SUCCEEDED");
  });

  it("constructs pg_dump with -Fc and the destination file, connecting via PG* env vars rather than a DATABASE_URL argv element", async () => {
    const job = pendingJob();
    createMock.mockResolvedValue(job);
    markRunningMock.mockResolvedValue({ ...job, status: "RUNNING" });
    markSucceededMock.mockResolvedValue({ ...job, status: "SUCCEEDED" });

    await backupService.runBackup("MANUAL", "user-1");

    expect(execFileMock).toHaveBeenCalledWith(
      "pg_dump",
      ["-Fc", "-f", expect.stringContaining("premgiri-books-backup-")],
      expect.objectContaining({
        env: expect.objectContaining({
          PGHOST: "localhost",
          PGPORT: "5432",
          PGUSER: "user",
          PGPASSWORD: "pass",
          PGDATABASE: "premgiri",
        }),
      }),
      expect.any(Function)
    );
    // No argument anywhere in the call carries the credential-bearing URL —
    // a CLI argument stays visible in the OS process list for the spawned
    // process's lifetime, unlike an env var passed only to its own env.
    const [, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(args.join(" ")).not.toContain("pass@localhost");
  });

  it("marks the job FAILED with a clear message when the backup directory is missing/unwritable, never a silent no-op", async () => {
    const job = pendingJob();
    createMock.mockResolvedValue(job);
    mkdirMock.mockRejectedValue(new Error("EACCES: permission denied"));
    markFailedMock.mockResolvedValue({ ...job, status: "FAILED", errorMessage: "boom" });

    const result = await backupService.runBackup("MANUAL", "user-1");

    expect(markRunningMock).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
    expect(markFailedMock).toHaveBeenCalledWith("job-1", expect.stringContaining("EACCES"));
    expect(result.status).toBe("FAILED");
  });

  it("marks the job FAILED when pg_dump exits with an error", async () => {
    const job = pendingJob();
    createMock.mockResolvedValue(job);
    markRunningMock.mockResolvedValue({ ...job, status: "RUNNING" });
    markFailedMock.mockResolvedValue({ ...job, status: "FAILED", errorMessage: "pg_dump: error" });
    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
        callback(new Error("pg_dump: error"));
      }
    );

    const result = await backupService.runBackup("MANUAL", "user-1");

    expect(markFailedMock).toHaveBeenCalledWith("job-1", "pg_dump: error");
    expect(result.status).toBe("FAILED");
  });

  it("never leaks DATABASE_URL's credentials into the recorded errorMessage or the logger — regression for a real spawn-error leak (execFile's ENOENT error carries the full command line, including the connection string, on `cmd`/`spawnargs`)", async () => {
    const job = pendingJob();
    createMock.mockResolvedValue(job);
    markRunningMock.mockResolvedValue({ ...job, status: "RUNNING" });
    markFailedMock.mockResolvedValue({ ...job, status: "FAILED" });

    const spawnError = Object.assign(new Error("spawn pg_dump ENOENT"), {
      cmd: `pg_dump -Fc -f /tmp/x.dump ${DATABASE_URL}`,
      spawnargs: ["-Fc", "-f", "/tmp/x.dump", DATABASE_URL],
    });
    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: (err: Error) => void) => {
        callback(spawnError);
      }
    );

    await backupService.runBackup("MANUAL", "user-1");

    const [, recordedMessage] = markFailedMock.mock.calls[0] as [string, string];
    expect(recordedMessage).not.toContain(DATABASE_URL);

    // The logger call must never receive the raw error object either — only
    // the already-redacted string, and never `spawnError` itself (whose
    // own `cmd`/`spawnargs` properties still carry the raw credentials).
    const loggedPayload = JSON.stringify(loggerErrorMock.mock.calls[0]?.[0]);
    expect(loggedPayload).not.toContain(DATABASE_URL);
    expect(loggerErrorMock.mock.calls[0]?.[0]).not.toHaveProperty("err");
  });

  it("redacts a Postgres URL embedded directly inside an error message, not just left off a mocked spawn error's extra properties", async () => {
    const job = pendingJob();
    createMock.mockResolvedValue(job);
    markRunningMock.mockResolvedValue({ ...job, status: "RUNNING" });
    markFailedMock.mockResolvedValue({ ...job, status: "FAILED" });
    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: (err: Error) => void) => {
        callback(new Error(`Command failed: pg_dump ... ${DATABASE_URL}\nsome stderr`));
      }
    );

    await backupService.runBackup("MANUAL", "user-1");

    const [, recordedMessage] = markFailedMock.mock.calls[0] as [string, string];
    expect(recordedMessage).not.toContain(DATABASE_URL);
    expect(recordedMessage).toContain("[REDACTED_DATABASE_URL]");
  });
});

describe("backupService.runRestore", () => {
  const BACKUP_ROW = pendingJob({ id: "backup-1", status: "SUCCEEDED", filePath: "/backups/x.dump" });

  it("runs the mandatory pre-restore safety backup before pg_restore, and never spawns pg_restore before it succeeds", async () => {
    findByIdMock.mockResolvedValue(BACKUP_ROW);

    // First create() call is the safety BACKUP job, second is the RESTORE job.
    createMock
      .mockResolvedValueOnce(pendingJob({ id: "safety-1", trigger: "PRE_RESTORE_SAFETY" }))
      .mockResolvedValueOnce(pendingJob({ id: "restore-1", jobType: "RESTORE", trigger: "MANUAL" }));
    markRunningMock.mockImplementation((id: string) => Promise.resolve(pendingJob({ id, status: "RUNNING" })));
    markSucceededMock.mockImplementation((id: string) =>
      Promise.resolve(pendingJob({ id, status: "SUCCEEDED" }))
    );

    const callOrder: string[] = [];
    execFileMock.mockImplementation(
      (file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
        callOrder.push(file);
        callback(null);
      }
    );

    const result = await backupService.runRestore("backup-1", "admin-1");

    expect(callOrder).toEqual(["pg_dump", "pg_restore"]);
    expect(disconnectMock).toHaveBeenCalled();
    expect(setRestoreInProgressMock).toHaveBeenNthCalledWith(1, true);
    expect(setRestoreInProgressMock).toHaveBeenNthCalledWith(2, false);
    expect(result.status).toBe("SUCCEEDED");
  });

  it("passes pg_restore's target database name as a plain argument, never the full credential-bearing URL", async () => {
    findByIdMock.mockResolvedValue(BACKUP_ROW);
    createMock
      .mockResolvedValueOnce(pendingJob({ id: "safety-1", trigger: "PRE_RESTORE_SAFETY" }))
      .mockResolvedValueOnce(pendingJob({ id: "restore-1", jobType: "RESTORE", trigger: "MANUAL" }));
    markRunningMock.mockImplementation((id: string) => Promise.resolve(pendingJob({ id, status: "RUNNING" })));
    markSucceededMock.mockImplementation((id: string) =>
      Promise.resolve(pendingJob({ id, status: "SUCCEEDED" }))
    );
    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => callback(null)
    );

    await backupService.runRestore("backup-1", "admin-1");

    const restoreCall = execFileMock.mock.calls.find(([file]) => file === "pg_restore");
    expect(restoreCall).toBeDefined();
    const [, args, options] = restoreCall as [string, string[], { env?: Record<string, string> }];
    expect(args).toEqual(["--clean", "--if-exists", "-d", "premgiri", "/backups/x.dump"]);
    expect(args.join(" ")).not.toContain("pass@localhost");
    expect(options?.env).toMatchObject({ PGPASSWORD: "pass", PGHOST: "localhost" });
  });

  it("rejects a second concurrent restore attempt without ever looking up the backup or spawning anything", async () => {
    isRestoreInProgressMock.mockReturnValue(true);

    await expect(backupService.runRestore("backup-1", "admin-1")).rejects.toThrow(/already running/i);

    expect(findByIdMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
    // Must not clear a lock it never engaged itself.
    expect(setRestoreInProgressMock).not.toHaveBeenCalled();
  });

  it("engages the restore lock BEFORE the safety backup starts, not after it succeeds — regression for a race where two restores could both pass the guard during the safety-backup window", async () => {
    findByIdMock.mockResolvedValue(BACKUP_ROW);
    createMock.mockResolvedValueOnce(pendingJob({ id: "safety-1", trigger: "PRE_RESTORE_SAFETY" }));
    markRunningMock.mockResolvedValue(pendingJob({ id: "safety-1", status: "RUNNING" }));

    let lockEngagedBeforeExecFile = false;
    setRestoreInProgressMock.mockImplementation((value: boolean) => {
      if (value === true) {
        // At the moment the lock is engaged, pg_dump for the safety backup
        // must not have run yet — proving the lock covers that whole window.
        lockEngagedBeforeExecFile = execFileMock.mock.calls.length === 0;
      }
    });
    markFailedMock.mockResolvedValue(
      pendingJob({ id: "safety-1", status: "FAILED", errorMessage: "disk full" })
    );
    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
        callback(new Error("disk full"));
      }
    );

    await expect(backupService.runRestore("backup-1", "admin-1")).rejects.toThrow(/safety backup failed/i);

    expect(lockEngagedBeforeExecFile).toBe(true);
    // The lock is still engaged-then-cleared even though the safety backup
    // failed — it must not leave the app unguarded for the failure path.
    expect(setRestoreInProgressMock).toHaveBeenNthCalledWith(1, true);
    expect(setRestoreInProgressMock).toHaveBeenNthCalledWith(2, false);
  });

  it("aborts before touching the live database if the safety backup fails — pg_restore is never spawned, and no RESTORE row is ever created", async () => {
    findByIdMock.mockResolvedValue(BACKUP_ROW);
    createMock.mockResolvedValueOnce(pendingJob({ id: "safety-1", trigger: "PRE_RESTORE_SAFETY" }));
    markRunningMock.mockResolvedValue(pendingJob({ id: "safety-1", status: "RUNNING" }));
    markFailedMock.mockResolvedValue(
      pendingJob({ id: "safety-1", status: "FAILED", errorMessage: "disk full" })
    );
    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
        callback(new Error("disk full"));
      }
    );

    await expect(backupService.runRestore("backup-1", "admin-1")).rejects.toThrow(/safety backup failed/i);

    // Only the safety backup's own pg_dump call happened — no second
    // (RESTORE) job was ever created, and pg_restore was never spawned.
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a backup that is not a SUCCEEDED BACKUP-type job", async () => {
    findByIdMock.mockResolvedValue(null);

    await expect(backupService.runRestore("missing", "admin-1")).rejects.toThrow(/completed backup/i);
    expect(createMock).not.toHaveBeenCalled();
  });
});
