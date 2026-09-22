"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { customerService } from "@/modules/customers/services/customer-service";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/modules/customers/validation/customer-schema";
import type { ActionResult } from "@/types/api";
import type { CustomerListFilters, CustomerWithLedger } from "@/types/customer";

const LIST_PATH = "/masters/customers";

// Every customer write also touches its paired Ledger row, so the generic
// Ledgers screen is revalidated alongside the customer list (the
// bank-account-actions.ts convention).
const LEDGERS_PATH = "/accounting/ledgers";

/** Infinite-scroll "load more" for the Customers list — a pure read, so no
 * paths are revalidated. */
export async function loadMoreCustomersAction(
  filters: CustomerListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<CustomerWithLedger>>> {
  return runAction(() => customerService.listCustomersPage(filters, { skip, take }), []);
}

export async function createCustomerAction(
  input: CreateCustomerInput
): Promise<ActionResult<CustomerWithLedger>> {
  return runAction(() => customerService.createCustomer(input), [LIST_PATH, LEDGERS_PATH]);
}

export async function updateCustomerAction(
  id: string,
  input: UpdateCustomerInput
): Promise<ActionResult<CustomerWithLedger>> {
  return runAction(() => customerService.updateCustomer(id, input), [
    LIST_PATH,
    LEDGERS_PATH,
    `/masters/customers/${id}/edit`,
  ]);
}

export async function activateCustomerAction(
  id: string
): Promise<ActionResult<CustomerWithLedger>> {
  return runAction(() => customerService.activateCustomer(id), [LIST_PATH, LEDGERS_PATH]);
}

export async function deactivateCustomerAction(
  id: string
): Promise<ActionResult<CustomerWithLedger>> {
  return runAction(() => customerService.deactivateCustomer(id), [LIST_PATH, LEDGERS_PATH]);
}
