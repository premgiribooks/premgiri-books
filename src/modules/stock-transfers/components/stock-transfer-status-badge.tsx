import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StockTransferStatus } from "@/types/stock-transfer";

const STATUS_CLASSES: Record<StockTransferStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const STOCK_TRANSFER_STATUS_LABELS: Record<StockTransferStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface StockTransferStatusBadgeProps {
  status: StockTransferStatus;
}

export function StockTransferStatusBadge({ status }: StockTransferStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {STOCK_TRANSFER_STATUS_LABELS[status]}
    </Badge>
  );
}
