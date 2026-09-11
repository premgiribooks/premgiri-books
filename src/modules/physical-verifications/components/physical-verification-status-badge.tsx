import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PhysicalVerificationStatus } from "@/types/physical-verification";

const STATUS_CLASSES: Record<PhysicalVerificationStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  COMPLETED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const PHYSICAL_VERIFICATION_STATUS_LABELS: Record<PhysicalVerificationStatus, string> = {
  DRAFT: "Draft",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

interface PhysicalVerificationStatusBadgeProps {
  status: PhysicalVerificationStatus;
}

export function PhysicalVerificationStatusBadge({ status }: PhysicalVerificationStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {PHYSICAL_VERIFICATION_STATUS_LABELS[status]}
    </Badge>
  );
}
