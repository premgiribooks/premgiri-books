import type { BackupJobStatus, BackupJobTrigger, BackupJobType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { BackupJobListFilters, BackupJobWithRelations } from "@/types/backup";

const RELATIONS_INCLUDE = {
  triggeredBy: { select: { id: true, fullName: true } },
  restoredFromJob: { select: { id: true, startedAt: true } },
} as const;

/**
 * The only Prisma access for `BackupJob` — deliberately never touches any
 * business-domain table (Company, Voucher, Product, …). Every query here is
 * installation-wide (no companyId filter — see 81-backup-restore.md's
 * Company-vs-Platform Disambiguation).
 */
export const backupJobRepository = {
  findById(id: string): Promise<BackupJobWithRelations | null> {
    return prisma.backupJob.findUnique({ where: { id }, include: RELATIONS_INCLUDE });
  },

  findMany(filters: BackupJobListFilters = {}): Promise<BackupJobWithRelations[]> {
    return prisma.backupJob.findMany({
      where: filters.jobType ? { jobType: filters.jobType } : undefined,
      include: RELATIONS_INCLUDE,
      orderBy: { startedAt: "desc" },
    });
  },

  create(data: {
    jobType: BackupJobType;
    trigger: BackupJobTrigger;
    triggeredByUserId: string | null;
    restoredFromJobId?: string | null;
  }): Promise<BackupJobWithRelations> {
    return prisma.backupJob.create({
      data: {
        jobType: data.jobType,
        trigger: data.trigger,
        triggeredByUserId: data.triggeredByUserId,
        restoredFromJobId: data.restoredFromJobId ?? null,
      },
      include: RELATIONS_INCLUDE,
    });
  },

  markRunning(id: string): Promise<BackupJobWithRelations> {
    return prisma.backupJob.update({
      where: { id },
      data: { status: "RUNNING" as BackupJobStatus },
      include: RELATIONS_INCLUDE,
    });
  },

  // `extra` is only ever populated for a BACKUP-type job (its own dump
  // file's path/size) — a RESTORE-type job's "file" is the BACKUP job it
  // restored from, already captured via restoredFromJobId, so it completes
  // with no extra fields.
  markSucceeded(
    id: string,
    extra: { filePath?: string; fileSizeBytes?: bigint } = {}
  ): Promise<BackupJobWithRelations> {
    return prisma.backupJob.update({
      where: { id },
      data: {
        status: "SUCCEEDED" as BackupJobStatus,
        filePath: extra.filePath,
        fileSizeBytes: extra.fileSizeBytes,
        completedAt: new Date(),
      },
      include: RELATIONS_INCLUDE,
    });
  },

  markFailed(id: string, errorMessage: string): Promise<BackupJobWithRelations> {
    return prisma.backupJob.update({
      where: { id },
      data: {
        status: "FAILED" as BackupJobStatus,
        errorMessage,
        completedAt: new Date(),
      },
      include: RELATIONS_INCLUDE,
    });
  },

  /** The scheduler's own read: does a SUCCEEDED BACKUP-type job already exist since `since`? */
  findLatestSucceededBackupSince(since: Date): Promise<BackupJobWithRelations | null> {
    return prisma.backupJob.findFirst({
      where: { jobType: "BACKUP", status: "SUCCEEDED", startedAt: { gte: since } },
      include: RELATIONS_INCLUDE,
      orderBy: { startedAt: "desc" },
    });
  },
};
