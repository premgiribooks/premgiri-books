import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StockAdjustmentStatus } from "@/types/stock-adjustment";

const STATUS_CLASSES: Record<StockAdjustmentStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const STOCK_ADJUSTMENT_STATUS_LABELS: Record<StockAdjustmentStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface StockAdjustmentStatusBadgeProps {
  status: StockAdjustmentStatus;
}

export function StockAdjustmentStatusBadge({ status }: StockAdjustmentStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {STOCK_ADJUSTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
