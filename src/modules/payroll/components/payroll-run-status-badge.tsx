import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PayrollRunStatus } from "@/types/payroll-run";

const STATUS_CLASSES: Record<PayrollRunStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const PAYROLL_RUN_STATUS_LABELS: Record<PayrollRunStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface PayrollRunStatusBadgeProps {
  status: PayrollRunStatus;
}

export function PayrollRunStatusBadge({ status }: PayrollRunStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {PAYROLL_RUN_STATUS_LABELS[status]}
    </Badge>
  );
}
