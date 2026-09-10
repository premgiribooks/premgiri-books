import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SalesOrderStatus } from "@/types/sales-order";

// Six-state badge — mirrors quotation-status-badge.tsx's convention.
const STATUS_CLASSES: Record<SalesOrderStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  CONFIRMED: "border-primary/30 bg-primary/10 text-primary",
  PARTIALLY_DELIVERED: "border-warning/30 bg-warning/10 text-warning",
  DELIVERED: "border-success/30 bg-success/10 text-success",
  CLOSED: "border-muted-foreground/20 bg-muted text-muted-foreground",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PARTIALLY_DELIVERED: "Partially Delivered",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

interface SalesOrderStatusBadgeProps {
  status: SalesOrderStatus;
}

export function SalesOrderStatusBadge({ status }: SalesOrderStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {SALES_ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
