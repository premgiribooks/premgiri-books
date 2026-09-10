import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DeliveryChallanStatus } from "@/types/delivery-challan";

// Four-state badge — mirrors sales-order-status-badge.tsx's convention.
const STATUS_CLASSES: Record<DeliveryChallanStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  DISPATCHED: "border-primary/30 bg-primary/10 text-primary",
  INVOICED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const DELIVERY_CHALLAN_STATUS_LABELS: Record<DeliveryChallanStatus, string> = {
  DRAFT: "Draft",
  DISPATCHED: "Dispatched",
  INVOICED: "Invoiced",
  CANCELLED: "Cancelled",
};

interface DeliveryChallanStatusBadgeProps {
  status: DeliveryChallanStatus;
}

export function DeliveryChallanStatusBadge({ status }: DeliveryChallanStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {DELIVERY_CHALLAN_STATUS_LABELS[status]}
    </Badge>
  );
}
