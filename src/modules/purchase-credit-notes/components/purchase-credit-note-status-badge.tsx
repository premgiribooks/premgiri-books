import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CreditNoteStatus } from "@/types/purchase-credit-note";

const STATUS_CLASSES: Record<CreditNoteStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const PURCHASE_CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface PurchaseCreditNoteStatusBadgeProps {
  status: CreditNoteStatus;
}

export function PurchaseCreditNoteStatusBadge({ status }: PurchaseCreditNoteStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {PURCHASE_CREDIT_NOTE_STATUS_LABELS[status]}
    </Badge>
  );
}
