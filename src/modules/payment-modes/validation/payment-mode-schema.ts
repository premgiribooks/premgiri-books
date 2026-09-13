import { z } from "zod";

export const PAYMENT_MODE_LEDGER_CLASSES = ["CASH", "BANK", "ANY"] as const;

export const PAYMENT_MODE_LEDGER_CLASS_LABELS: Record<(typeof PAYMENT_MODE_LEDGER_CLASSES)[number], string> = {
  CASH: "Cash",
  BANK: "Bank",
  ANY: "Any (Cash or Bank)",
};

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters");

export const createPaymentModeSchema = z.object({
  name: NAME_SCHEMA,
  ledgerClass: z.enum(PAYMENT_MODE_LEDGER_CLASSES),
});

export type CreatePaymentModeInput = z.infer<typeof createPaymentModeSchema>;

// Create and Update share the same field set — name/ledgerClass remain
// editable on every Payment Mode, including seeded ones
// (86-payment-mode-master.md's Business Rules). Kept as a separate named
// schema so a future spec can diverge them without touching callers.
export const updatePaymentModeSchema = createPaymentModeSchema;

export type UpdatePaymentModeInput = z.infer<typeof updatePaymentModeSchema>;
