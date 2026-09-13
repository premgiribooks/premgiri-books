import type { PaymentMode as PrismaPaymentMode, PaymentModeLedgerClass } from "@prisma/client";

export type PaymentMode = PrismaPaymentMode;
export type { PaymentModeLedgerClass };

export type PaymentModeStatusFilter = "all" | "active" | "inactive";

export interface PaymentModeListFilters {
  search?: string;
  status?: PaymentModeStatusFilter;
}

export type ActivatePaymentModeResult =
  | { status: "not_found" }
  | { status: "ok"; paymentMode: PaymentMode };

export type DeactivatePaymentModeResult =
  | { status: "not_found" }
  | { status: "ok"; paymentMode: PaymentMode };
