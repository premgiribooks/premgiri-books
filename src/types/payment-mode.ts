import type { PaymentMode as PrismaPaymentMode, PaymentModeLedgerClass } from "@prisma/client";

export type PaymentMode = PrismaPaymentMode;
export type { PaymentModeLedgerClass };

export type PaymentModeStatusFilter = "all" | "active" | "inactive";

export interface PaymentModeListFilters {
  search?: string;
  status?: PaymentModeStatusFilter;
}

/** A Payment Mode picker's option shape — shared by every payment-line
 * dropdown across Sales Invoice, Sales Return, Credit Note
 * (91-payment-mode-integration-sales.md's UI section), and Purchase Invoice,
 * Purchase Return (92-payment-mode-integration-purchase.md's UI section). */
export interface PaymentModeOption {
  id: string;
  name: string;
  ledgerClass: PaymentModeLedgerClass;
}

export type ActivatePaymentModeResult =
  | { status: "not_found" }
  | { status: "ok"; paymentMode: PaymentMode };

export type DeactivatePaymentModeResult =
  | { status: "not_found" }
  | { status: "ok"; paymentMode: PaymentMode };
