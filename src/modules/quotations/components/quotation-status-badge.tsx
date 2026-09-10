import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuotationStatus } from "@/types/quotation";

// Six-state badge — the multi-value convention of customer-type-badge.tsx /
// product-type-badge.tsx.
const STATUS_CLASSES: Record<QuotationStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  SENT: "border-primary/30 bg-primary/10 text-primary",
  ACCEPTED: "border-success/30 bg-success/10 text-success",
  REJECTED: "border-destructive/30 bg-destructive/10 text-destructive",
  EXPIRED: "border-warning/30 bg-warning/10 text-warning",
  CANCELLED: "border-muted-foreground/20 bg-muted text-muted-foreground line-through",
};

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

interface QuotationStatusBadgeProps {
  status: QuotationStatus;
}

export function QuotationStatusBadge({ status }: QuotationStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {QUOTATION_STATUS_LABELS[status]}
    </Badge>
  );
}
