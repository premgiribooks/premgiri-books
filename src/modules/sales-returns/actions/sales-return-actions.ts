"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { salesReturnService } from "@/modules/sales-returns/services/sales-return-service";
import type { CreateSalesReturnInput, UpdateSalesReturnInput } from "@/modules/sales-returns/validation/sales-return-schema";
import type { ActionResult } from "@/types/api";
import type {
  ReturnableInvoiceDetail,
  ReturnableInvoiceOption,
  SalesReturnDetail,
  SalesReturnListFilters,
  SalesReturnListRow,
} from "@/types/sales-return";

const LIST_PATH = "/sales/returns";
const INVOICE_LIST_PATH = "/sales/invoices";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Sales Returns list — a pure read, so
 * no paths are revalidated. */
export async function loadMoreSalesReturnsAction(
  filters: SalesReturnListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<SalesReturnListRow>>> {
  return runAction(() => salesReturnService.listSalesReturnsPage(filters, { skip, take }), []);
}

export async function createSalesReturnDraftAction(input: CreateSalesReturnInput): Promise<ActionResult<SalesReturnDetail>> {
  return runAction(() => salesReturnService.createDraft(input), [LIST_PATH]);
}

export async function updateSalesReturnDraftAction(
  id: string,
  input: UpdateSalesReturnInput
): Promise<ActionResult<SalesReturnDetail>> {
  return runAction(() => salesReturnService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

// Posting decreases the source invoice's own returnable-quantity display —
// revalidate the invoice list alongside this return's own paths.
export async function postSalesReturnAction(id: string): Promise<ActionResult<SalesReturnDetail>> {
  return runAction(() => salesReturnService.postSalesReturn(id), [LIST_PATH, detailPath(id), INVOICE_LIST_PATH]);
}

export async function cancelSalesReturnAction(id: string): Promise<ActionResult<SalesReturnDetail>> {
  return runAction(() => salesReturnService.cancelSalesReturn(id), [LIST_PATH, detailPath(id), INVOICE_LIST_PATH]);
}

// Read-only — no revalidation. Backs "New Sales Return"'s invoice picker.
export async function listReturnableInvoicesAction(search?: string): Promise<ActionResult<ReturnableInvoiceOption[]>> {
  return runAction(() => salesReturnService.listReturnableInvoices(search), []);
}

// Read-only — no revalidation. Backs "New Sales Return"'s line editor once
// an invoice is picked.
export async function getReturnableInvoiceAction(
  salesInvoiceId: string
): Promise<ActionResult<ReturnableInvoiceDetail | null>> {
  return runAction(() => salesReturnService.getReturnableInvoice(salesInvoiceId), []);
}
