import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackupStatusBadge } from "@/modules/backup/components/backup-status-badge";
import { RestoreConfirmationDialog } from "@/modules/backup/components/restore-confirmation-dialog";
import type { BackupJobWithRelations } from "@/types/backup";

const DATE_FORMAT = "dd MMM yyyy, HH:mm";

function formatFileSize(bytes: bigint | null): string {
  if (bytes === null) {
    return "—";
  }
  const kb = Number(bytes) / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface BackupHistoryTableProps {
  jobs: BackupJobWithRelations[];
  isRestoring: boolean;
}

export function BackupHistoryTable({ jobs, isRestoring }: BackupHistoryTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No backups yet. Use “Backup Now” to create the first one.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Completed</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Triggered By</TableHead>
          <TableHead>Restored From</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell>{job.jobType}</TableCell>
            <TableCell>{job.trigger.replace(/_/g, " ")}</TableCell>
            <TableCell>
              <BackupStatusBadge status={job.status} />
            </TableCell>
            <TableCell className="font-financial">{format(job.startedAt, DATE_FORMAT)}</TableCell>
            <TableCell className="font-financial">
              {job.completedAt ? format(job.completedAt, DATE_FORMAT) : "—"}
            </TableCell>
            <TableCell className="font-financial">{formatFileSize(job.fileSizeBytes)}</TableCell>
            <TableCell>{job.triggeredBy?.fullName ?? "System"}</TableCell>
            <TableCell>
              {job.restoredFromJob ? format(job.restoredFromJob.startedAt, DATE_FORMAT) : "—"}
            </TableCell>
            <TableCell className="text-right">
              {job.jobType === "BACKUP" && job.status === "SUCCEEDED" && (
                <RestoreConfirmationDialog
                  backupJobId={job.id}
                  backupLabel={format(job.startedAt, DATE_FORMAT)}
                  disabled={isRestoring}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
