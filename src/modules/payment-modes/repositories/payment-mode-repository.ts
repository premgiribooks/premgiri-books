import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivatePaymentModeResult,
  DeactivatePaymentModeResult,
  PaymentMode,
  PaymentModeLedgerClass,
  PaymentModeListFilters,
} from "@/types/payment-mode";

export interface PaymentModePersistData {
  name: string;
  ledgerClass: PaymentModeLedgerClass;
}

// The five defaults seeded at company creation (86-payment-mode-master.md's
// Business Rules table) — kept here (not in the service) since only the
// repository's seedDefaults() below reads it.
const DEFAULT_PAYMENT_MODES: readonly PaymentModePersistData[] = [
  { name: "Cash", ledgerClass: "CASH" },
  { name: "Bank Transfer", ledgerClass: "BANK" },
  { name: "UPI", ledgerClass: "BANK" },
  { name: "Card", ledgerClass: "BANK" },
  { name: "Cheque", ledgerClass: "BANK" },
];

function buildWhere(companyId: string, filters: PaymentModeListFilters): Prisma.PaymentModeWhereInput {
  const where: Prisma.PaymentModeWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return where;
}

export const paymentModeRepository = {
  async findMany(companyId: string, filters: PaymentModeListFilters = {}): Promise<PaymentMode[]> {
    return prisma.paymentMode.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { name: "asc" },
    });
  },

  async findActive(companyId: string): Promise<PaymentMode[]> {
    return prisma.paymentMode.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string): Promise<PaymentMode | null> {
    return prisma.paymentMode.findUnique({ where: { id } });
  },

  async create(companyId: string, data: PaymentModePersistData): Promise<PaymentMode> {
    return prisma.paymentMode.create({ data: { ...data, companyId } });
  },

  // Company-scoping is checked in the same transaction as the write,
  // mirroring unit-repository.ts's update(). No immutable-field rule to
  // enforce — name/ledgerClass remain editable on every row, including
  // isSystemDefined ones (86-payment-mode-master.md's Business Rules: this
  // master carries no downstream foreign key yet, so there is nothing to
  // retroactively invalidate).
  async update(id: string, companyId: string, data: PaymentModePersistData): Promise<PaymentMode | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.paymentMode.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      try {
        return await tx.paymentMode.update({ where: { id }, data });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivatePaymentModeResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.paymentMode.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const paymentMode = await tx.paymentMode.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", paymentMode };
    });
  },

  // No count-then-write invariant exists here — a Payment Mode has no
  // dependents yet (86-payment-mode-master.md's own Do Not: no consumer is
  // wired in by this spec) — so no Serializable isolation/retry is needed,
  // mirroring unit-repository.ts's deactivate().
  async deactivate(id: string, companyId: string): Promise<DeactivatePaymentModeResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.paymentMode.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const paymentMode = await tx.paymentMode.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", paymentMode };
    });
  },

  /**
   * Seeds the five default Payment Modes for a brand-new company, run
   * inside tenant-bootstrap-service.ts's own COMPANY_BOOTSTRAPPED
   * transaction (see events/register-bootstrap-handler.ts) — mirrors
   * ledger-repository.ts's seedDefault()/ledger-group-repository.ts's
   * seedDefaults() shape.
   */
  async seedDefaults(companyId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.paymentMode.createMany({
      data: DEFAULT_PAYMENT_MODES.map((seed) => ({
        ...seed,
        companyId,
        isSystemDefined: true,
      })),
    });
  },
};
