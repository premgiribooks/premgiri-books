"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";
import type {
  CreatePurchaseInvoiceInput,
  PreviewPurchaseInvoiceInput,
  UpdatePurchaseInvoiceInput,
} from "@/modules/purchase-invoices/validation/purchase-invoice-schema";
import type { LedgerBalanceResult } from "@/engines/voucher/types";
import type { ActionResult } from "@/types/api";
import type {
  GoodsReceiptNotePrefill,
  PurchaseInvoiceDetail,
  PurchaseInvoiceListFilters,
  PurchaseInvoiceListRow,
  PurchaseInvoicePreview,
} from "@/types/purchase-invoice";

const LIST_PATH = "/purchase/invoices";
const RECEIPT_LIST_PATH = "/purchase/receipts";
const ORDER_LIST_PATH = "/purchase/orders";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Purchase Invoices list — a pure
 * read, so no paths are revalidated. */
export async function loadMorePurchaseInvoicesAction(
  filters: PurchaseInvoiceListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<PurchaseInvoiceListRow>>> {
  return runAction(() => purchaseInvoiceService.listPurchaseInvoicesPage(filters, { skip, take }), []);
}

export async function createDraftAction(input: CreatePurchaseInvoiceInput): Promise<ActionResult<PurchaseInvoiceDetail>> {
  return runAction(() => purchaseInvoiceService.createDraft(input), [LIST_PATH]);
}

export async function updateDraftAction(
  id: string,
  input: UpdatePurchaseInvoiceInput
): Promise<ActionResult<PurchaseInvoiceDetail>> {
  return runAction(() => purchaseInvoiceService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

// Posting can advance a linked Goods Receipt Note (RECEIVED -> INVOICED) —
// revalidate its list path alongside this invoice's own.
export async function postPurchaseInvoiceAction(id: string): Promise<ActionResult<PurchaseInvoiceDetail>> {
  return runAction(() => purchaseInvoiceService.postPurchaseInvoice(id), [
    LIST_PATH,
    detailPath(id),
    RECEIPT_LIST_PATH,
    ORDER_LIST_PATH,
  ]);
}

export async function cancelPurchaseInvoiceAction(id: string): Promise<ActionResult<PurchaseInvoiceDetail>> {
  return runAction(() => purchaseInvoiceService.cancelPurchaseInvoice(id), [
    LIST_PATH,
    detailPath(id),
    RECEIPT_LIST_PATH,
    ORDER_LIST_PATH,
  ]);
}

// Read-only — no revalidation. Backs "New Purchase Invoice"'s
// `?goodsReceiptNoteId=` pre-fill.
export async function getGoodsReceiptNotePrefillAction(
  goodsReceiptNoteId: string
): Promise<ActionResult<GoodsReceiptNotePrefill | null>> {
  return runAction(() => purchaseInvoiceService.getGoodsReceiptNotePrefill(goodsReceiptNoteId), []);
}

// Read-only — no revalidation. Mirrors sales-invoice-actions.ts's
// previewSalesInvoiceAction.
export async function previewPurchaseInvoiceAction(
  input: PreviewPurchaseInvoiceInput
): Promise<ActionResult<PurchaseInvoicePreview>> {
  return runAction(() => purchaseInvoiceService.previewPurchaseInvoice(input), []);
}

// Read-only — no revalidation. Backs the Create/Edit form's inline
// outstanding-balance display for the selected Supplier/payment ledger.
export async function getLedgerOutstandingBalanceAction(
  ledgerId: string
): Promise<ActionResult<LedgerBalanceResult>> {
  return runAction(() => purchaseInvoiceService.getLedgerOutstandingBalance(ledgerId), []);
}
