"use server";

import { runAction } from "@/lib/run-action";
import { purchaseReturnService } from "@/modules/purchase-returns/services/purchase-return-service";
import type { CreatePurchaseReturnInput, UpdatePurchaseReturnInput } from "@/modules/purchase-returns/validation/purchase-return-schema";
import type { ActionResult } from "@/types/api";
import type { PurchaseReturnDetail, ReturnablePurchaseInvoiceDetail, ReturnablePurchaseInvoiceOption } from "@/types/purchase-return";

const LIST_PATH = "/purchase/returns";
const INVOICE_LIST_PATH = "/purchase/invoices";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export async function createPurchaseReturnDraftAction(
  input: CreatePurchaseReturnInput
): Promise<ActionResult<PurchaseReturnDetail>> {
  return runAction(() => purchaseReturnService.createDraft(input), [LIST_PATH]);
}

export async function updatePurchaseReturnDraftAction(
  id: string,
  input: UpdatePurchaseReturnInput
): Promise<ActionResult<PurchaseReturnDetail>> {
  return runAction(() => purchaseReturnService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

// Posting decreases the source invoice's own returnable-quantity display —
// revalidate the invoice list alongside this return's own paths.
export async function postPurchaseReturnAction(id: string): Promise<ActionResult<PurchaseReturnDetail>> {
  return runAction(() => purchaseReturnService.postPurchaseReturn(id), [LIST_PATH, detailPath(id), INVOICE_LIST_PATH]);
}

export async function cancelPurchaseReturnAction(id: string): Promise<ActionResult<PurchaseReturnDetail>> {
  return runAction(() => purchaseReturnService.cancelPurchaseReturn(id), [LIST_PATH, detailPath(id), INVOICE_LIST_PATH]);
}

// Read-only — no revalidation. Backs "New Purchase Return"'s invoice picker.
export async function listReturnablePurchaseInvoicesAction(search?: string): Promise<ActionResult<ReturnablePurchaseInvoiceOption[]>> {
  return runAction(() => purchaseReturnService.listReturnableInvoices(search), []);
}

// Read-only — no revalidation. Backs "New Purchase Return"'s line editor
// once an invoice is picked.
export async function getReturnablePurchaseInvoiceAction(
  purchaseInvoiceId: string
): Promise<ActionResult<ReturnablePurchaseInvoiceDetail | null>> {
  return runAction(() => purchaseReturnService.getReturnableInvoice(purchaseInvoiceId), []);
}
