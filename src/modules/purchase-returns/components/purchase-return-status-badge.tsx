import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PurchaseReturnStatus } from "@/types/purchase-return";

const STATUS_CLASSES: Record<PurchaseReturnStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const PURCHASE_RETURN_STATUS_LABELS: Record<PurchaseReturnStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface PurchaseReturnStatusBadgeProps {
  status: PurchaseReturnStatus;
}

export function PurchaseReturnStatusBadge({ status }: PurchaseReturnStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {PURCHASE_RETURN_STATUS_LABELS[status]}
    </Badge>
  );
}
