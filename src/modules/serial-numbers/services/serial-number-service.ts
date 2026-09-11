import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { serialNumberRepository } from "@/modules/serial-numbers/repositories/serial-number-repository";
import {
  createSerialNumberSchema,
  type CreateSerialNumberInput,
} from "@/modules/serial-numbers/validation/serial-number-schema";
import type {
  ActivateSerialNumberResult,
  DeactivateSerialNumberResult,
  SerialNumberListFilters,
  SerialNumberOption,
  SerialNumberWithStatus,
  SerialStatus,
} from "@/types/serial-number";

const NOT_FOUND_MESSAGE = "Serial number not found.";

// Serials are product-master data, the identical placement reasoning as
// product-batches (50-batch-tracking.md's Security section, reused here per
// 51-serial-number-tracking.md's Security section) — gated on `masters`,
// not a dedicated permission module.
const MODULE = "masters";

function translateSerialValueConflict(error: unknown): never {
  if (isUniqueConstraintError(error, "serialValue")) {
    throw new AppError("A serial number with this value already exists for this product.");
  }
  throw error;
}

export const serialNumberService = {
  async listSerialNumbers(
    productId: string,
    filters: SerialNumberListFilters = {}
  ): Promise<SerialNumberWithStatus[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");
    return serialNumberRepository.findManyWithStatus(user.companyId, productId, filters);
  },

  // A serial belonging to a different company resolves identically to "not
  // found" — never distinguish "exists but isn't yours" (productService's
  // getProduct convention).
  async getSerialNumber(id: string): Promise<SerialNumberWithStatus | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const serial = await serialNumberRepository.findByIdWithStatus(id);
    if (!serial || serial.companyId !== user.companyId) {
      return null;
    }
    return serial;
  },

  async createSerialNumber(input: CreateSerialNumberInput): Promise<SerialNumberWithStatus> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "create");

    const data = createSerialNumberSchema.parse(input);
    try {
      return await serialNumberRepository.create(user.companyId, data);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translateSerialValueConflict(error);
    }
  },

  async activateSerialNumber(id: string): Promise<ActivateSerialNumberResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "edit");

    const result = await serialNumberRepository.setActive(id, user.companyId, true);
    if (result.status === "not_found") {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return result;
  },

  async deactivateSerialNumber(id: string): Promise<DeactivateSerialNumberResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "edit");

    const result = await serialNumberRepository.setActive(id, user.companyId, false);
    if (result.status === "not_found") {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return result;
  },

  /** Derived status only (51-serial-number-tracking.md's getSerialStatus) — reuses findByIdWithStatus's already-derived value rather than re-querying. */
  async getSerialStatus(id: string): Promise<SerialStatus> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const serial = await serialNumberRepository.findByIdWithStatus(id);
    if (!serial || serial.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return serial.status;
  },

  /** The `<SerialSelector>` component's data source — active, IN_STOCK serials only. */
  async listSerialOptions(productId: string, warehouseId?: string): Promise<SerialNumberOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");
    return serialNumberRepository.findOptionsForSelector(user.companyId, productId, warehouseId);
  },
};
