"use server";

import { runAction } from "@/lib/run-action";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";
import type {
  CreateSalesInvoiceInput,
  PreviewSalesInvoiceInput,
  UpdateSalesInvoiceInput,
} from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type { LedgerBalanceResult } from "@/engines/voucher/types";
import type { ActionResult } from "@/types/api";
import type {
  DeliveryChallanPrefill,
  ResolvedSalesInvoiceLinePrice,
  SalesInvoiceDetail,
  SalesInvoicePreview,
} from "@/types/sales-invoice";

const LIST_PATH = "/sales/invoices";
const CHALLAN_LIST_PATH = "/sales/challans";
const ORDER_LIST_PATH = "/sales/orders";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export async function createDraftAction(input: CreateSalesInvoiceInput): Promise<ActionResult<SalesInvoiceDetail>> {
  return runAction(() => salesInvoiceService.createDraft(input), [LIST_PATH]);
}

export async function updateDraftAction(
  id: string,
  input: UpdateSalesInvoiceInput
): Promise<ActionResult<SalesInvoiceDetail>> {
  return runAction(() => salesInvoiceService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

// Posting can advance a linked Delivery Challan (DISPATCHED -> INVOICED) or
// leave a linked Sales Order's own displayed state stale — revalidate both
// list paths alongside this invoice's own.
export async function postSalesInvoiceAction(id: string): Promise<ActionResult<SalesInvoiceDetail>> {
  return runAction(() => salesInvoiceService.postSalesInvoice(id), [
    LIST_PATH,
    detailPath(id),
    CHALLAN_LIST_PATH,
    ORDER_LIST_PATH,
  ]);
}

export async function cancelSalesInvoiceAction(id: string): Promise<ActionResult<SalesInvoiceDetail>> {
  return runAction(() => salesInvoiceService.cancelSalesInvoice(id), [
    LIST_PATH,
    detailPath(id),
    CHALLAN_LIST_PATH,
    ORDER_LIST_PATH,
  ]);
}

// Read-only — no revalidation. Backs "New Sales Invoice"'s
// `?deliveryChallanId=` pre-fill.
export async function getDeliveryChallanPrefillAction(
  deliveryChallanId: string
): Promise<ActionResult<DeliveryChallanPrefill | null>> {
  return runAction(() => salesInvoiceService.getDeliveryChallanPrefill(deliveryChallanId), []);
}

// Read-only — no revalidation. Mirrors sales-order-actions.ts's
// resolveSalesOrderLinePriceAction.
export async function resolveLinePriceAction(input: {
  productId: string;
  quantity: number;
  customerId?: string;
  asOfDate?: string;
}): Promise<ActionResult<ResolvedSalesInvoiceLinePrice>> {
  return runAction(() => salesInvoiceService.resolveLinePrice(input), []);
}

// Read-only — no revalidation. Mirrors sales-order-actions.ts's
// previewSalesOrderAction.
export async function previewSalesInvoiceAction(
  input: PreviewSalesInvoiceInput
): Promise<ActionResult<SalesInvoicePreview>> {
  return runAction(() => salesInvoiceService.previewSalesInvoice(input), []);
}

// Read-only — no revalidation. Backs the Create/Edit form's inline
// outstanding-balance display for the selected Customer/payment ledger.
export async function getLedgerOutstandingBalanceAction(
  ledgerId: string
): Promise<ActionResult<LedgerBalanceResult>> {
  return runAction(() => salesInvoiceService.getLedgerOutstandingBalance(ledgerId), []);
}
