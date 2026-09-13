import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PAYMENT_MODE_LEDGER_CLASS_LABELS } from "@/modules/payment-modes/validation/payment-mode-schema";
import type { PaymentModeLedgerClass } from "@/types/payment-mode";

interface LedgerClassBadgeProps {
  ledgerClass: PaymentModeLedgerClass;
}

const LEDGER_CLASS_STYLES: Record<PaymentModeLedgerClass, string> = {
  CASH: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  BANK: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ANY: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

export function LedgerClassBadge({ ledgerClass }: LedgerClassBadgeProps) {
  return (
    <Badge variant="outline" className={cn(LEDGER_CLASS_STYLES[ledgerClass])}>
      {PAYMENT_MODE_LEDGER_CLASS_LABELS[ledgerClass]}
    </Badge>
  );
}
