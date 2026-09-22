import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import type { Page, PageParams } from "@/lib/pagination";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  paymentModeRepository,
  type PaymentModePersistData,
} from "@/modules/payment-modes/repositories/payment-mode-repository";
import {
  createPaymentModeSchema,
  updatePaymentModeSchema,
  type CreatePaymentModeInput,
  type UpdatePaymentModeInput,
} from "@/modules/payment-modes/validation/payment-mode-schema";
import type { PaymentMode, PaymentModeListFilters } from "@/types/payment-mode";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring every other
// master-data service in this codebase (unitService, ledgerService,
// bankAccountService, ledgerGroupService, …) — 86-payment-mode-master.md's
// own prose claims Bank Management gates status changes under "edit", which
// does not match bank-account-service.ts's actual LIFECYCLE_ACTION = "delete";
// recorded as a spec/code discrepancy in progress-tracker.md, resolved here
// in favor of the universal codebase convention.
const LIFECYCLE_ACTION = "delete";

export function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A payment mode with this name already exists in this company.");
  }
  throw error;
}

function toPersistData(data: CreatePaymentModeInput): PaymentModePersistData {
  return {
    name: data.name,
    ledgerClass: data.ledgerClass,
  };
}

export const paymentModeService = {
  async listPaymentModes(filters: PaymentModeListFilters = {}): Promise<PaymentMode[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");
    return paymentModeRepository.findMany(user.companyId, filters);
  },

  /** Infinite-scroll page for the Payment Modes list page. */
  async listPaymentModesPage(
    filters: PaymentModeListFilters,
    page: PageParams
  ): Promise<Page<PaymentMode>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");
    return paymentModeRepository.findManyPage(user.companyId, filters, page);
  },

  // A payment mode belonging to a different company must resolve
  // identically to "not found" — mirrors every other master-data service's
  // identical rule.
  async getPaymentMode(id: string): Promise<PaymentMode | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const paymentMode = await paymentModeRepository.findById(id);
    if (!paymentMode || paymentMode.companyId !== user.companyId) {
      return null;
    }
    return paymentMode;
  },

  /**
   * Active Payment Modes for the current company — the option-list read
   * specs 88-90's payment-line dropdowns will call.
   */
  async listActivePaymentModes(): Promise<PaymentMode[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");
    return paymentModeRepository.findActive(user.companyId);
  },

  async createPaymentMode(input: CreatePaymentModeInput): Promise<PaymentMode> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "create");

    const data = createPaymentModeSchema.parse(input);

    try {
      return await paymentModeRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updatePaymentMode(id: string, input: UpdatePaymentModeInput): Promise<PaymentMode> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "edit");

    const data = updatePaymentModeSchema.parse(input);

    try {
      const paymentMode = await paymentModeRepository.update(id, user.companyId, toPersistData(data));
      if (!paymentMode) {
        throw new AppError("Payment mode not found.");
      }
      return paymentMode;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activatePaymentMode(id: string): Promise<PaymentMode> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", LIFECYCLE_ACTION);

    const result = await paymentModeRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Payment mode not found.");
      case "ok":
        return result.paymentMode;
    }
  },

  async deactivatePaymentMode(id: string): Promise<PaymentMode> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", LIFECYCLE_ACTION);

    const result = await paymentModeRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Payment mode not found.");
      case "ok":
        return result.paymentMode;
    }
  },
};
