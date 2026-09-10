import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SalesInvoiceStatus } from "@/types/sales-invoice";

const STATUS_CLASSES: Record<SalesInvoiceStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const SALES_INVOICE_STATUS_LABELS: Record<SalesInvoiceStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface SalesInvoiceStatusBadgeProps {
  status: SalesInvoiceStatus;
}

export function SalesInvoiceStatusBadge({ status }: SalesInvoiceStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {SALES_INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}
