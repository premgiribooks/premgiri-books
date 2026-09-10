import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GoodsReceiptNoteStatus } from "@/types/goods-receipt-note";

// Four-state badge — mirrors delivery-challan-status-badge.tsx's convention.
const STATUS_CLASSES: Record<GoodsReceiptNoteStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  RECEIVED: "border-primary/30 bg-primary/10 text-primary",
  INVOICED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const GOODS_RECEIPT_NOTE_STATUS_LABELS: Record<GoodsReceiptNoteStatus, string> = {
  DRAFT: "Draft",
  RECEIVED: "Received",
  INVOICED: "Invoiced",
  CANCELLED: "Cancelled",
};

interface GoodsReceiptNoteStatusBadgeProps {
  status: GoodsReceiptNoteStatus;
}

export function GoodsReceiptNoteStatusBadge({ status }: GoodsReceiptNoteStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {GOODS_RECEIPT_NOTE_STATUS_LABELS[status]}
    </Badge>
  );
}
