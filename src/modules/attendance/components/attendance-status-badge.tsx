import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/attendance";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  ON_LEAVE: "On Leave",
};

const STATUS_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: "border-success/30 bg-success/10 text-success",
  ABSENT: "border-destructive/30 bg-destructive/10 text-destructive",
  HALF_DAY: "border-warning/30 bg-warning/10 text-warning",
  ON_LEAVE: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
}

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
