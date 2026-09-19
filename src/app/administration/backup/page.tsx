import { PlatformShell } from "@/components/layout/platform-shell";
import { requireSuperAdmin } from "@/lib/current-user";
import { BackupHistoryTable } from "@/modules/backup/components/backup-history-table";
import { BackupNowButton } from "@/modules/backup/components/backup-now-button";
import { RestoringGuard } from "@/modules/backup/components/restoring-guard";
import { backupService } from "@/modules/backup/services/backup-service";
import { isRestoreInProgress } from "@/lib/restore-lock";

export default async function BackupPage() {
  await requireSuperAdmin();

  const jobs = await backupService.listJobs();
  const backupDirectory = backupService.getBackupDirectory();
  const isRestoring = isRestoreInProgress();

  return (
    <PlatformShell>
      <RestoringGuard>
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Backup & Restore</h1>
              <p className="text-sm text-muted-foreground">
                Whole-installation PostgreSQL backup and restore. Backup directory:{" "}
                <span className="font-financial text-foreground">{backupDirectory}</span>
              </p>
            </div>
            <BackupNowButton disabled={isRestoring} />
          </div>

          <BackupHistoryTable jobs={jobs} isRestoring={isRestoring} />
        </div>
      </RestoringGuard>
    </PlatformShell>
  );
}
