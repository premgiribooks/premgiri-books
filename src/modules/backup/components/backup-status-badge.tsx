import { Badge } from "@/components/ui/badge";
import type { BackupJobStatus } from "@/types/backup";

const VARIANT_BY_STATUS: Record<BackupJobStatus, "secondary" | "default" | "destructive" | "outline"> = {
  PENDING: "outline",
  RUNNING: "secondary",
  SUCCEEDED: "default",
  FAILED: "destructive",
};

interface BackupStatusBadgeProps {
  status: BackupJobStatus;
}

export function BackupStatusBadge({ status }: BackupStatusBadgeProps) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{status}</Badge>;
}
