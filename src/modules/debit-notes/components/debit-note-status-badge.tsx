import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DebitNoteStatus } from "@/types/debit-note";

const STATUS_CLASSES: Record<DebitNoteStatus, string> = {
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  POSTED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive line-through",
};

export const DEBIT_NOTE_STATUS_LABELS: Record<DebitNoteStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

interface DebitNoteStatusBadgeProps {
  status: DebitNoteStatus;
}

export function DebitNoteStatusBadge({ status }: DebitNoteStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {DEBIT_NOTE_STATUS_LABELS[status]}
    </Badge>
  );
}
