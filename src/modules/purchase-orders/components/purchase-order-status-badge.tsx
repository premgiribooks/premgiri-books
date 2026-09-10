import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PurchaseOrderStatus } from "@/types/purchase-order";

// Six-state badge — mirrors sales-order-status-badge.tsx's convention.
const STATUS_CLASSES: Record<PurchaseOrderStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  CONFIRMED: "border-primary/30 bg-primary/10 text-primary",
  PARTIALLY_RECEIVED: "border-warning/30 bg-warning/10 text-warning",
  RECEIVED: "border-success/30 bg-success/10 text-success",
  CLOSED: "border-muted-foreground/20 bg-muted text-muted-foreground",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

interface PurchaseOrderStatusBadgeProps {
  status: PurchaseOrderStatus;
}

export function PurchaseOrderStatusBadge({ status }: PurchaseOrderStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {PURCHASE_ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
