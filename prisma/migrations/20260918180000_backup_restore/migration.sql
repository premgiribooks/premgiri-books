-- CreateEnum
CREATE TYPE "BackupJobType" AS ENUM ('BACKUP', 'RESTORE');

-- CreateEnum
CREATE TYPE "BackupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupJobTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'PRE_RESTORE_SAFETY');

-- CreateTable
CREATE TABLE "BackupJob" (
    "id" TEXT NOT NULL,
    "jobType" "BackupJobType" NOT NULL,
    "status" "BackupJobStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "BackupJobTrigger" NOT NULL,
    "companyId" TEXT,
    "filePath" TEXT,
    "fileSizeBytes" BIGINT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "triggeredByUserId" TEXT,
    "restoredFromJobId" TEXT,

    CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupJob_jobType_status_idx" ON "BackupJob"("jobType", "status");

-- CreateIndex
CREATE INDEX "BackupJob_startedAt_idx" ON "BackupJob"("startedAt");

-- AddForeignKey
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_restoredFromJobId_fkey" FOREIGN KEY ("restoredFromJobId") REFERENCES "BackupJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
