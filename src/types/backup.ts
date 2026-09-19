import type { BackupJob, BackupJobStatus, BackupJobTrigger, BackupJobType } from "@prisma/client";

export type { BackupJob, BackupJobStatus, BackupJobTrigger, BackupJobType };

export type BackupJobWithRelations = BackupJob & {
  triggeredBy: { id: string; fullName: string } | null;
  restoredFromJob: { id: string; startedAt: Date } | null;
};

export interface BackupJobListFilters {
  jobType?: BackupJobType;
}
