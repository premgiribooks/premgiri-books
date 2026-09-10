import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SalesReturnStatus } from "@/types/sales-return";

const STATUS_CLASSES: Record<SalesReturnStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const SALES_RETURN_STATUS_LABELS: Record<SalesReturnStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface SalesReturnStatusBadgeProps {
  status: SalesReturnStatus;
}

export function SalesReturnStatusBadge({ status }: SalesReturnStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {SALES_RETURN_STATUS_LABELS[status]}
    </Badge>
  );
}
