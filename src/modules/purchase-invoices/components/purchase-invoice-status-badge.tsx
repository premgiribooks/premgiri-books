import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PurchaseInvoiceStatus } from "@/types/purchase-invoice";

const STATUS_CLASSES: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const PURCHASE_INVOICE_STATUS_LABELS: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface PurchaseInvoiceStatusBadgeProps {
  status: PurchaseInvoiceStatus;
}

export function PurchaseInvoiceStatusBadge({ status }: PurchaseInvoiceStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {PURCHASE_INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}
