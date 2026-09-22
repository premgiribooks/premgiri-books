import { Prisma, type CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertLedgersAreCashOrBank } from "@/lib/ledger-class";
import { assertPaymentModeMatchesLedger } from "@/lib/payment-mode-validation";
import { assertPermission } from "@/lib/permissions";
import { isRetryableTransactionError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { gstEngine } from "@/engines/gst/gst-engine";
import type { CalculateLineInput, DocumentGroupResult, SupplyType } from "@/engines/gst/types";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import type { LedgerBalanceResult } from "@/engines/voucher/types";
import type { VoucherEntryLineInput } from "@/engines/voucher/voucher-validation";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { CASH_IN_HAND_GROUP_NAME } from "@/modules/ledger-groups/constants/default-groups";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import {
  assertPurchaseLedgerMappingValid,
  isPurchaseLedgerMappingComplete,
} from "@/modules/company/utils/purchase-ledger-mapping";
import { goodsReceiptNoteService } from "@/modules/goods-receipt-notes/services/goods-receipt-note-service";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";
import { paymentModeService } from "@/modules/payment-modes/services/payment-mode-service";
import { productPurchasePriceHistoryService } from "@/modules/product-purchase-price-history/services/product-purchase-price-history-service";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";
import {
  purchaseInvoiceRepository,
  type PurchaseInvoiceHeaderPersistData,
  type PurchaseInvoiceLinePersistData,
  type PurchaseInvoicePaymentPersistData,
} from "@/modules/purchase-invoices/repositories/purchase-invoice-repository";
import {
  computeRoundOff,
  computeTaxableAmountPre,
  sumEffectiveTax,
  sumHeaderGrossTotals,
  toPaise,
} from "@/modules/purchase-invoices/utils/purchase-invoice-calculations";
import {
  createPurchaseInvoiceSchema,
  previewPurchaseInvoiceSchema,
  toUtcDate,
  updatePurchaseInvoiceSchema,
  type CreatePurchaseInvoiceInput,
  type PreviewPurchaseInvoiceInput,
  type PurchaseInvoiceLineInput,
  type PurchaseInvoicePaymentInput,
  type UpdatePurchaseInvoiceInput,
} from "@/modules/purchase-invoices/validation/purchase-invoice-schema";
import type {
  GoodsReceiptNotePrefill,
  ItemWisePurchaseAggregateRow,
  ItemWisePurchaseFilters,
  PartyWisePurchaseAggregateRow,
  PartyWisePurchaseFilters,
  PurchaseInvoiceDetail,
  PurchaseInvoiceFormOptions,
  PurchaseInvoiceLineComputation,
  PurchaseInvoiceListFilters,
  PurchaseInvoiceListRow,
  PurchaseInvoiceProductOption,
  PurchaseInvoicePreview,
  PurchaseInvoiceTotals,
  PurchaseInvoiceWarehouseOption,
} from "@/types/purchase-invoice";

// 44-purchase-invoice.md's Decisions section, taken literally (unlike
// sales-invoice-service.ts's own header comment, which explains why THAT
// module deliberately deviates from its spec's literal "generate at
// posting" step): `invoiceNumber` is nullable and assigned only inside
// postPurchaseInvoice, never at createDraft/updateDraft. Multiple DRAFT rows
// coexist under the same @@unique([companyId, financialYearId,
// invoiceNumber]) without collision because Postgres unique indexes treat
// NULL as distinct from NULL. `supplierInvoiceNumber` (required, unique per
// supplier) is what identifies a DRAFT row instead.

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Purchase invoice not found.";
const SUPPLIER_NOT_FOUND_MESSAGE = "Supplier not found.";
const SUPPLIER_INACTIVE_MESSAGE = "Selected supplier is inactive.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with purchase invoices.";
const NO_COMPANY_STATE_MESSAGE =
  "Set your company's GST state before creating a purchase invoice (Company > Edit Profile).";
const CANNOT_CHANGE_MESSAGE =
  "This purchase invoice can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This purchase invoice can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted purchase invoice can be cancelled.";
const PURCHASE_ORDER_NOT_FOUND_MESSAGE = "Purchase order not found.";
const GRN_NOT_FOUND_MESSAGE = "Goods receipt note not found.";
const GRN_NOT_AVAILABLE_MESSAGE = "This goods receipt note is not received, or is already invoiced by another purchase invoice.";
const GRN_SUPPLIER_MISMATCH_MESSAGE = "The linked goods receipt note's supplier does not match this invoice's supplier.";
const GRN_ORDER_MISMATCH_MESSAGE = "The linked purchase order does not match the goods receipt note's own linked order.";
const GRN_LINE_MISMATCH_MESSAGE =
  "Every invoice line must match one of the linked goods receipt note's own lines exactly (same product, warehouse, and quantity).";
const HSN_MISSING_MESSAGE_PREFIX = "HSN/SAC code is required for";
const OVERPAYMENT_MESSAGE = "Total payments cannot exceed the invoice's grand total.";

const QUANTITY_TOLERANCE = 1e-6;

const ZERO_TOTALS: PurchaseInvoiceTotals = {
  subtotal: 0,
  totalDiscount: 0,
  taxableAmount: 0,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  totalCess: 0,
  roundOff: 0,
  grandTotal: 0,
};

// Posting/cancellation both use Serializable + bounded retry per
// 44-purchase-invoice.md's Code Standards, matching the shared convention
// even though posting itself only ever produces IN stock lines (which the
// Inventory Engine alone wouldn't require Serializable for) — the
// per-supplier invoice-number uniqueness and six-ledger-mapping validation
// re-reads inside this same transaction are what the spec asks this
// isolation level to protect.
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "This purchase invoice's referenced data changed due to another request. Please try again.",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Unit-dependent, so enforced here (after the product/unit row loads) rather
// than as a static Zod bound — mirrors sales-invoice-service.ts's identical
// helper.
function assertQuantityPrecision(quantity: number, decimalPlaces: number): void {
  const factor = 10 ** decimalPlaces;
  if (Math.abs(quantity * factor - Math.round(quantity * factor)) >= 1e-6) {
    throw new AppError(
      decimalPlaces === 0
        ? "Quantity must be a whole number — the selected product's unit has 0 decimal places."
        : `Quantity can have at most ${decimalPlaces} decimal places — the selected product's unit's limit.`
    );
  }
}

interface BuiltLine {
  persist: PurchaseInvoiceLinePersistData;
  computation: Omit<PurchaseInvoiceLineComputation, "lineNumber">;
  calcInput: CalculateLineInput | null;
}

/**
 * Builds one line's persisted fields and display computation — mirrors
 * sales-invoice-service.ts's buildLine, minus the below-cost check (a
 * selling-side-only concept). `ratePercent`/`cessPercent` always come from
 * the product's own GstRate, never the client-supplied line values the
 * schema accepts defensively (44-purchase-invoice.md's Validation section:
 * "normally server-populated from the product's rate rather than
 * client-authored").
 */
function buildLine(
  input: PurchaseInvoiceLineInput,
  product: PurchaseInvoiceProductOption,
  supplyType: SupplyType,
  userId: string
): BuiltLine {
  assertQuantityPrecision(input.quantity, product.unitDecimalPlaces);

  const discountPercent = input.discountPercent ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const taxableAmountPre = computeTaxableAmountPre(input.quantity, input.rate, discountPercent, discountAmount);
  const isTaxedLine = taxableAmountPre > 0;

  const calcInput: CalculateLineInput | null = isTaxedLine
    ? {
        amount: taxableAmountPre,
        isInclusive: false,
        ratePercent: product.ratePercent,
        cessPercent: product.cessPercent,
        supplyType,
        isReverseCharge: false,
      }
    : null;

  const result = calcInput ? gstEngine.calculateLine(calcInput) : null;
  const computedCgst = result?.cgst ?? 0;
  const computedSgst = result?.sgst ?? 0;
  const computedIgst = result?.igst ?? 0;
  const computedCess = result?.cess ?? 0;
  const taxableAmount = result?.taxableAmount ?? 0;

  const isTaxOverridden = input.isTaxOverridden ?? false;
  const effectiveCgst = isTaxOverridden ? (input.overriddenCgst ?? 0) : computedCgst;
  const effectiveSgst = isTaxOverridden ? (input.overriddenSgst ?? 0) : computedSgst;
  const effectiveIgst = isTaxOverridden ? (input.overriddenIgst ?? 0) : computedIgst;
  const effectiveCess = isTaxOverridden ? (input.overriddenCess ?? 0) : computedCess;

  const totalAmountPaise =
    toPaise(taxableAmount) + toPaise(effectiveCgst) + toPaise(effectiveSgst) + toPaise(effectiveIgst) + toPaise(effectiveCess);
  const totalAmount = totalAmountPaise / 100;

  const persist: PurchaseInvoiceLinePersistData = {
    productId: product.id,
    warehouseId: input.warehouseId,
    quantity: input.quantity,
    rate: input.rate,
    discountPercent,
    discountAmount,
    ratePercent: product.ratePercent,
    cessPercent: product.cessPercent,
    taxableAmount,
    cgst: computedCgst,
    sgst: computedSgst,
    igst: computedIgst,
    cess: computedCess,
    totalAmount,
    isTaxOverridden,
    overriddenCgst: isTaxOverridden ? effectiveCgst : null,
    overriddenSgst: isTaxOverridden ? effectiveSgst : null,
    overriddenIgst: isTaxOverridden ? effectiveIgst : null,
    overriddenCess: isTaxOverridden ? effectiveCess : null,
    overrideReason: isTaxOverridden ? (input.overrideReason ?? null) : null,
    overriddenByUserId: isTaxOverridden ? userId : null,
  };

  const computation: Omit<PurchaseInvoiceLineComputation, "lineNumber"> = {
    taxableAmount,
    cgst: effectiveCgst,
    sgst: effectiveSgst,
    igst: effectiveIgst,
    cess: effectiveCess,
    totalAmount,
    isHsnMissing: gstEngine.isHsnRequired(isTaxedLine, product.hsnCode),
    isGstRateMissing: isTaxedLine && !product.hasGstRate,
  };

  return { persist, computation, calcInput };
}

interface BuiltPurchaseInvoice {
  lines: BuiltLine[];
  header: PurchaseInvoiceTotals;
  groups: DocumentGroupResult[];
}

/**
 * Composes every line via `buildLine`, then aggregates header totals TWICE —
 * mirrors sales-invoice-service.ts's buildSalesInvoice exactly.
 */
function buildPurchaseInvoice(
  lineInputs: readonly PurchaseInvoiceLineInput[],
  productsById: ReadonlyMap<string, PurchaseInvoiceProductOption>,
  supplyType: SupplyType,
  strict: boolean,
  userId: string
): BuiltPurchaseInvoice {
  if (lineInputs.length === 0) {
    return { lines: [], header: ZERO_TOTALS, groups: [] };
  }

  const lines = lineInputs.map((input) => {
    const product = productsById.get(input.productId);
    if (!product) {
      throw new AppError("One or more products were not found.");
    }
    return buildLine(input, product, supplyType, userId);
  });

  const grossTotals = sumHeaderGrossTotals(
    lineInputs.map((input) => ({
      quantity: input.quantity,
      rate: input.rate,
      discountPercent: input.discountPercent ?? 0,
      discountAmount: input.discountAmount ?? 0,
    }))
  );

  const taxedInputs = lines.map((line) => line.calcInput).filter((c): c is CalculateLineInput => c !== null);

  if (taxedInputs.length === 0) {
    if (strict) {
      throw new AppError("A purchase invoice cannot consist entirely of zero-value lines.");
    }
    return {
      lines,
      header: { ...ZERO_TOTALS, subtotal: grossTotals.subtotal, totalDiscount: grossTotals.totalDiscount },
      groups: [],
    };
  }

  const documentResult = gstEngine.calculateDocument(taxedInputs);
  const effectiveTaxTotals = sumEffectiveTax(lines.map((line) => line.computation));
  const exactTotalPaise =
    toPaise(documentResult.taxableAmount) +
    toPaise(effectiveTaxTotals.totalCgst) +
    toPaise(effectiveTaxTotals.totalSgst) +
    toPaise(effectiveTaxTotals.totalIgst) +
    toPaise(effectiveTaxTotals.totalCess);
  const { grandTotal, roundOff } = computeRoundOff(exactTotalPaise);

  return {
    lines,
    header: {
      subtotal: grossTotals.subtotal,
      totalDiscount: grossTotals.totalDiscount,
      taxableAmount: documentResult.taxableAmount,
      totalCgst: effectiveTaxTotals.totalCgst,
      totalSgst: effectiveTaxTotals.totalSgst,
      totalIgst: effectiveTaxTotals.totalIgst,
      totalCess: effectiveTaxTotals.totalCess,
      roundOff,
      grandTotal,
    },
    groups: documentResult.groups,
  };
}

async function loadProductsMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly PurchaseInvoiceLineInput[]
): Promise<Map<string, PurchaseInvoiceProductOption>> {
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];
  const products = await purchaseInvoiceRepository.findProductsForLines(client, companyId, productIds);
  return new Map(products.map((product) => [product.id, product]));
}

async function loadWarehousesMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly PurchaseInvoiceLineInput[]
): Promise<Map<string, PurchaseInvoiceWarehouseOption>> {
  const warehouseIds = [...new Set(lineInputs.map((line) => line.warehouseId))];
  const warehouses = await purchaseInvoiceRepository.findWarehousesForLines(client, companyId, warehouseIds);
  return new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
}

// Accepts the caller's client (plain `prisma` for the pre-transaction
// create/update path, `tx` inside postPurchaseInvoice) — mirrors
// sales-invoice-service.ts's verifyPermanentCustomer, same reasoning: a
// posting-time call through the global `prisma` singleton would read
// outside the Serializable transaction's own snapshot.
async function verifySupplier(client: PrismaClientOrTransaction, companyId: string, supplierId: string): Promise<{ id: string; ledgerId: string }> {
  const supplier = await purchaseInvoiceRepository.findSupplierForInvoice(client, companyId, supplierId);
  if (!supplier) {
    throw new AppError(SUPPLIER_NOT_FOUND_MESSAGE);
  }
  if (!supplier.isActive) {
    throw new AppError(SUPPLIER_INACTIVE_MESSAGE);
  }
  return { id: supplier.id, ledgerId: supplier.ledgerId };
}

// A client-supplied purchaseOrderId belonging to another company must be
// rejected explicitly here, not left to an FK with no tenant awareness —
// mirrors sales-invoice-service.ts's verifySalesOrderLinkable (security
// review finding on that module, applied here from the start). Accepts the
// caller's client (plain `prisma` for the pre-transaction create/update
// path, `tx` inside postPurchaseInvoice) — same reasoning as verifySupplier
// above: a posting-time read through the global `prisma` singleton would
// read outside the Serializable transaction's own snapshot (code review
// finding — purchaseOrderService.getPurchaseOrder gained this optional
// client parameter specifically for this caller).
async function verifyPurchaseOrderLinkable(client: PrismaClientOrTransaction, purchaseOrderId: string): Promise<void> {
  const purchaseOrder = await purchaseOrderService.getPurchaseOrder(purchaseOrderId, client);
  if (!purchaseOrder) {
    throw new AppError(PURCHASE_ORDER_NOT_FOUND_MESSAGE);
  }
}

// Existence + status only — "not already linked to another invoice" is
// enforced by the `goodsReceiptNoteId` `@unique` constraint at persist time
// (translated to a friendly error in persistNewPurchaseInvoice/
// replaceItemsAndUpdate), mirrors sales-invoice-service.ts's
// verifyDeliveryChallanLinkable exactly. Same tx-client threading as
// verifyPurchaseOrderLinkable above, for the same reason.
async function verifyGoodsReceiptNoteLinkable(client: PrismaClientOrTransaction, goodsReceiptNoteId: string): Promise<void> {
  const grn = await goodsReceiptNoteService.getGoodsReceiptNote(goodsReceiptNoteId, client);
  if (!grn) {
    throw new AppError(GRN_NOT_FOUND_MESSAGE);
  }
  if (grn.status !== "RECEIVED") {
    throw new AppError(GRN_NOT_AVAILABLE_MESSAGE);
  }
}

async function resolveSupplyType(companyId: string, placeOfSupplyStateCode: string): Promise<SupplyType> {
  const companyStateCode = await purchaseInvoiceRepository.findCompanyStateCode(companyId);
  if (!companyStateCode) {
    throw new AppError(NO_COMPANY_STATE_MESSAGE);
  }
  return gstEngine.determineSupplyType(companyStateCode, placeOfSupplyStateCode);
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

function toHeaderPersistData(
  data: {
    supplierId: string;
    supplierInvoiceNumber: string;
    invoiceDate: string;
    placeOfSupplyStateCode: string;
    narration?: string;
    purchaseOrderId?: string;
    goodsReceiptNoteId?: string;
  },
  totals: PurchaseInvoiceTotals,
  amountPaid: number
): PurchaseInvoiceHeaderPersistData {
  return {
    supplierId: data.supplierId,
    supplierInvoiceNumber: data.supplierInvoiceNumber,
    invoiceDate: toUtcDate(data.invoiceDate),
    placeOfSupplyStateCode: data.placeOfSupplyStateCode,
    narration: data.narration ?? null,
    purchaseOrderId: data.purchaseOrderId ?? null,
    goodsReceiptNoteId: data.goodsReceiptNoteId ?? null,
    ...totals,
    amountPaid,
  };
}

function toPaymentPersistData(payments: readonly PurchaseInvoicePaymentInput[]): PurchaseInvoicePaymentPersistData[] {
  return payments.map((payment) => ({
    ledgerId: payment.ledgerId,
    paymentModeId: payment.paymentModeId,
    amount: payment.amount,
    reference: payment.reference ?? null,
  }));
}

/** 92-payment-mode-integration-purchase.md's Business Rules: every payment
 * line's `paymentModeId` must match its own `ledgerId`'s class, checked at
 * every write path (never only client-side) — mirrors
 * sales-invoice-service.ts's identical helper. Runs the checks in parallel —
 * each line's ledger/mode pair is independent. */
async function assertPaymentModesMatchLedgers(
  client: PrismaClientOrTransaction,
  companyId: string,
  payments: readonly { ledgerId: string; paymentModeId: string }[]
): Promise<void> {
  await Promise.all(
    payments.map((payment) => assertPaymentModeMatchesLedger(client, payment.paymentModeId, payment.ledgerId, companyId))
  );
}

function sumPayments(payments: readonly { amount: number }[]): number {
  return payments.reduce((paise, payment) => paise + toPaise(payment.amount), 0) / 100;
}

/** `Σ payments <= grandTotal`, checked against the freshly recomputed
 * `grandTotal`, never a stale draft total (44-purchase-invoice.md's Posting
 * step 3). No "must pay in full" edge case exists here — every Purchase
 * Invoice has a real Supplier Ledger to carry a remainder. */
function assertPaymentsWithinTotal(paidTotal: number, grandTotal: number): void {
  if (toPaise(paidTotal) > toPaise(grandTotal)) {
    throw new AppError(OVERPAYMENT_MESSAGE);
  }
}

async function persistNewPurchaseInvoice(
  companyId: string,
  financialYearId: string,
  header: PurchaseInvoiceHeaderPersistData,
  lines: PurchaseInvoiceLinePersistData[],
  payments: PurchaseInvoicePaymentPersistData[],
  createdByUserId: string
): Promise<PurchaseInvoiceDetail> {
  try {
    return await runInTransaction((tx) =>
      purchaseInvoiceRepository.create(tx, companyId, financialYearId, header, lines, payments, createdByUserId)
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error, "supplierInvoiceNumber")) {
      throw new AppError("A purchase invoice with this supplier invoice number already exists for this supplier.");
    }
    if (isUniqueConstraintError(error, "goodsReceiptNoteId")) {
      throw new AppError("This goods receipt note already has a purchase invoice linked to it.");
    }
    throw error;
  }
}

interface GoodsReceiptNoteForInvoicing {
  id: string;
  companyId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  status: string;
  items: readonly { productId: string; warehouseId: string; quantity: number }[];
}

/**
 * Posting step 1 (only when `goodsReceiptNoteId` is set): the GRN's
 * supplier/company/linked-order must agree with this invoice's own, its
 * status must still be `RECEIVED`, and every invoice line must match exactly
 * one of the GRN's own lines as a 1:1 bijection on the `(productId,
 * warehouseId, quantity)` triple — matches a candidate at most once
 * (`splice`), so a GRN with duplicate-looking lines still resolves
 * deterministically rather than matching ambiguously.
 */
function assertGoodsReceiptNoteConsistent(
  grn: GoodsReceiptNoteForInvoicing,
  companyId: string,
  supplierId: string,
  purchaseOrderId: string | undefined,
  lines: readonly { productId: string; warehouseId: string; quantity: number }[]
): void {
  if (grn.companyId !== companyId) {
    throw new AppError(GRN_NOT_FOUND_MESSAGE);
  }
  if (grn.status !== "RECEIVED") {
    throw new AppError(GRN_NOT_AVAILABLE_MESSAGE);
  }
  if (grn.supplierId !== supplierId) {
    throw new AppError(GRN_SUPPLIER_MISMATCH_MESSAGE);
  }
  if (purchaseOrderId && grn.purchaseOrderId && purchaseOrderId !== grn.purchaseOrderId) {
    throw new AppError(GRN_ORDER_MISMATCH_MESSAGE);
  }
  if (lines.length !== grn.items.length) {
    throw new AppError(GRN_LINE_MISMATCH_MESSAGE);
  }
  const remainingGrnLines = grn.items.map((item) => ({ ...item }));
  for (const line of lines) {
    const matchIndex = remainingGrnLines.findIndex(
      (item) =>
        item.productId === line.productId &&
        item.warehouseId === line.warehouseId &&
        Math.abs(item.quantity - line.quantity) < QUANTITY_TOLERANCE
    );
    if (matchIndex === -1) {
      throw new AppError(GRN_LINE_MISMATCH_MESSAGE);
    }
    remainingGrnLines.splice(matchIndex, 1);
  }
}

/**
 * Payment ledgers restricted, server-side, to the Cash-in-Hand group or a
 * BankAccount-linked ledger (44-purchase-invoice.md's Ledger Posting rule) —
 * stricter than Sales Invoice's "any active company ledger". Delegates the
 * actual class check to the shared `assertLedgersAreCashOrBank` helper
 * (52-payment-voucher.md's Project Context: extracted from this exact
 * function so Payment Voucher's identical Cash/Bank restriction has one
 * implementation, not a third copy) — this wrapper only keeps this module's
 * own array-of-payments call shape and the empty-array short-circuit.
 */
async function assertPaymentLedgersValid(
  client: PrismaClientOrTransaction,
  companyId: string,
  payments: readonly { ledgerId: string }[]
): Promise<void> {
  if (payments.length === 0) {
    return;
  }
  await assertLedgersAreCashOrBank(
    client,
    companyId,
    payments.map((payment) => payment.ledgerId),
    "payment"
  );
}

interface VoucherEntriesInput {
  supplyType: SupplyType;
  totals: PurchaseInvoiceTotals;
  payments: readonly PurchaseInvoicePaymentPersistData[];
  supplierLedgerId: string;
  settings: CompanySettings;
}

/** 44-purchase-invoice.md's Ledger Posting section — the reversal of Sales
 * Invoice's. Balances by construction (same reasoning as that module's
 * identical proof), so any imbalance here indicates a bug in this
 * aggregation. */
function buildVoucherEntries(input: VoucherEntriesInput): VoucherEntryLineInput[] {
  const entries: VoucherEntryLineInput[] = [];
  const { totals, settings } = input;

  if (totals.taxableAmount > 0) {
    entries.push({ ledgerId: settings.purchaseLedgerId as string, entryType: "DEBIT", amount: totals.taxableAmount });
  }
  if (input.supplyType === "INTRA_STATE") {
    if (totals.totalCgst > 0) {
      entries.push({ ledgerId: settings.inputCgstLedgerId as string, entryType: "DEBIT", amount: totals.totalCgst });
    }
    if (totals.totalSgst > 0) {
      entries.push({ ledgerId: settings.inputSgstLedgerId as string, entryType: "DEBIT", amount: totals.totalSgst });
    }
  } else if (totals.totalIgst > 0) {
    entries.push({ ledgerId: settings.inputIgstLedgerId as string, entryType: "DEBIT", amount: totals.totalIgst });
  }
  if (totals.totalCess > 0) {
    entries.push({ ledgerId: settings.inputCessLedgerId as string, entryType: "DEBIT", amount: totals.totalCess });
  }

  for (const payment of input.payments) {
    entries.push({ ledgerId: payment.ledgerId, entryType: "CREDIT", amount: payment.amount });
  }

  const paidTotal = sumPayments(input.payments);
  const remainderPaise = toPaise(totals.grandTotal) - toPaise(paidTotal);
  if (remainderPaise > 0) {
    // Guaranteed non-negative by assertPaymentsWithinTotal.
    entries.push({ ledgerId: input.supplierLedgerId, entryType: "CREDIT", amount: remainderPaise / 100 });
  }

  if (totals.roundOff !== 0) {
    entries.push({
      ledgerId: settings.roundOffLedgerId as string,
      entryType: totals.roundOff < 0 ? "CREDIT" : "DEBIT",
      amount: Math.abs(totals.roundOff),
    });
  }

  return entries;
}

export const purchaseInvoiceService = {
  async listPurchaseInvoices(filters: PurchaseInvoiceListFilters = {}): Promise<PurchaseInvoiceListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return purchaseInvoiceRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /**
   * The same read as `listPurchaseInvoices`, gated on `reports`/`view`
   * instead of `purchase`/`view` — 69-purchase-reports.md's Purchase
   * Register calls this one, not `listPurchaseInvoices`, mirroring
   * sales-invoice-service.ts's own `listSalesInvoicesForReport` precedent so
   * the seeded Accountant role can view it without also needing Purchase
   * module access. Still goes through this service (Invariant 5) — no new
   * repository method.
   */
  async listPurchaseInvoicesForReport(filters: PurchaseInvoiceListFilters = {}): Promise<PurchaseInvoiceListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return purchaseInvoiceRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /**
   * 69-purchase-reports.md's Item-wise Purchase Report — the entry point
   * Purchase Reports calls; cross-module reads go through this service
   * method, never `purchase-invoice-repository.ts` directly (Invariant 5).
   * Gated on `reports`/`view`, not `purchase`/`view` — mirrors
   * sales-invoice-service.ts's `getItemWiseSalesReport`. Scoped to the
   * active financial year only, matching every other method in this module.
   */
  async getItemWisePurchaseReport(filters: ItemWisePurchaseFilters): Promise<ItemWisePurchaseAggregateRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return purchaseInvoiceRepository.aggregateItemWisePurchases(user.companyId, financialYear.id, filters);
  },

  /** 69-purchase-reports.md's Party-wise Purchase Summary — mirrors
   * getItemWisePurchaseReport's own permission/financial-year posture
   * exactly. Also the method Supplier Reports (`72-supplier-reports.md`)
   * calls for its own Supplier Purchase Summary view. */
  async getPartyWisePurchaseReport(filters: PartyWisePurchaseFilters): Promise<PartyWisePurchaseAggregateRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return purchaseInvoiceRepository.aggregatePartyWisePurchases(user.companyId, financialYear.id, filters);
  },

  async getPurchaseInvoice(id: string): Promise<PurchaseInvoiceDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const invoice = await purchaseInvoiceRepository.findById(id);
    if (!invoice || invoice.companyId !== user.companyId) {
      return null;
    }
    return invoice;
  },

  /**
   * The Create/Edit form's inline "outstanding balance" display, called
   * whenever the user selects a Supplier or a payment ledger — a thin
   * pass-through to `voucherQueries.getLedgerBalance` (already
   * company-scoped: it throws for a ledger id belonging to another
   * company). Gated on `purchase`/`view` **and** `accounting`/`view` —
   * mirrors sales-invoice-service.ts's identical fix: a plain
   * `purchase`/`view` check alone would let any Purchase-scoped role read
   * the real-time balance of an arbitrary ledger id in the company, not
   * just this form's own Supplier/payment-ledger candidates, contradicting
   * this codebase's posture that a ledger's financial balance is
   * Accounting-only data. Costs nothing in practice: this form's own
   * payment-ledger options already come from a query gated on
   * `accounting`/`view`. Found and fixed per security review (HIGH —
   * object-level authorization gap on the new ledgerId-scoped Server
   * Action).
   */
  async getLedgerOutstandingBalance(ledgerId: string): Promise<LedgerBalanceResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");
    await assertPermission(user, "accounting", "view");
    return voucherQueries.getLedgerBalance(user.companyId, ledgerId);
  },

  async listPurchaseInvoiceFormOptions(): Promise<PurchaseInvoiceFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await requireFinancialYear();

    const [suppliers, products, warehouses, groups, paymentLedgerCandidates, paymentModes, companyStateCode, settings, preview] =
      await Promise.all([
        prisma.supplier.findMany({
          where: { companyId: user.companyId, isActive: true },
          select: { id: true, isActive: true, creditDays: true, ledgerId: true, ledger: { select: { name: true } } },
          orderBy: { ledger: { name: "asc" } },
        }),
        purchaseInvoiceRepository.findInvoiceableProducts(user.companyId),
        purchaseInvoiceRepository.findSelectableWarehouses(user.companyId),
        ledgerGroupRepository.findMany(user.companyId),
        purchaseInvoiceRepository.findActiveLedgersForPaymentPicker(user.companyId),
        paymentModeService.listActivePaymentModes(),
        purchaseInvoiceRepository.findCompanyStateCode(user.companyId),
        companySettingsService.getSettings(user.companyId),
        documentNumberEngine.previewNextNumber({
          companyId: user.companyId,
          financialYearId: financialYear.id,
          documentType: "PURCHASE_INVOICE",
        }),
      ]);

    const cashGroupIds = getGroupSubtreeIds(groups, [CASH_IN_HAND_GROUP_NAME]);
    const paymentLedgers = paymentLedgerCandidates
      .filter((ledger) => cashGroupIds.has(ledger.ledgerGroupId) || ledger.hasBankAccount)
      .map((ledger) => ({
        id: ledger.id,
        name: ledger.name,
        groupName: ledger.ledgerGroupName,
        // Every candidate here already passed the Cash-in-Hand-or-bank-linked
        // filter above, so this is always CASH or BANK, never NEITHER — still
        // computed via the same classification the filter itself uses, not
        // re-derived ad hoc (92-payment-mode-integration-purchase.md).
        ledgerClass: cashGroupIds.has(ledger.ledgerGroupId) ? ("CASH" as const) : ("BANK" as const),
      }));

    return {
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.ledger.name,
        isActive: supplier.isActive,
        creditDays: supplier.creditDays,
        ledgerId: supplier.ledgerId,
      })),
      products,
      warehouses,
      paymentLedgers,
      paymentModes: paymentModes.map((mode) => ({ id: mode.id, name: mode.name, ledgerClass: mode.ledgerClass })),
      companyStateCode,
      nextInvoiceNumber: preview.formatted,
      isLedgerMappingComplete: isPurchaseLedgerMappingComplete(settings),
    };
  },

  /** Read-only prefill lookup for "New Purchase Invoice" reached via
   * `?goodsReceiptNoteId=` — mirrors sales-invoice-service.ts's
   * getDeliveryChallanPrefill. Returns null when the GRN doesn't exist,
   * isn't RECEIVED, or belongs to another company. */
  async getGoodsReceiptNotePrefill(goodsReceiptNoteId: string): Promise<GoodsReceiptNotePrefill | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const grn = await goodsReceiptNoteService.getGoodsReceiptNote(goodsReceiptNoteId);
    if (!grn || grn.status !== "RECEIVED") {
      return null;
    }

    const productIds = [...new Set(grn.items.map((item) => item.productId))];
    const products = await purchaseInvoiceRepository.findProductsForLines(prisma, user.companyId, productIds);
    const productsById = new Map(products.map((product) => [product.id, product]));

    return {
      goodsReceiptNoteId: grn.id,
      grnNumber: grn.grnNumber,
      supplierId: grn.supplierId,
      purchaseOrderId: grn.purchaseOrderId,
      lines: grn.items.map((item) => {
        const product = productsById.get(item.productId);
        return {
          productId: item.productId,
          productName: item.product.name,
          productCode: item.product.productCode,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouse.name,
          quantity: item.quantity,
          unitSymbol: product?.unitSymbol ?? "",
          unitDecimalPlaces: product?.unitDecimalPlaces ?? 4,
        };
      }),
    };
  },

  /** The live-editing preview — mirrors salesInvoiceService.previewSalesInvoice. */
  async previewPurchaseInvoice(input: PreviewPurchaseInvoiceInput): Promise<PurchaseInvoicePreview> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const data = previewPurchaseInvoiceSchema.parse(input);
    if (data.lines.length === 0) {
      return { lines: [], totals: ZERO_TOTALS, groups: [] };
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildPurchaseInvoice(data.lines, productsById, supplyType, false, user.id);

    return {
      lines: built.lines.map((line, index) => ({ lineNumber: index + 1, ...line.computation })),
      totals: built.header,
      groups: built.groups,
    };
  },

  async createDraft(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoiceDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "create");

    const financialYear = await requireFinancialYear();
    const data = createPurchaseInvoiceSchema.parse(input);

    await verifySupplier(prisma, user.companyId, data.supplierId);
    if (data.purchaseOrderId) {
      await verifyPurchaseOrderLinkable(prisma, data.purchaseOrderId);
    }
    if (data.goodsReceiptNoteId) {
      await verifyGoodsReceiptNoteLinkable(prisma, data.goodsReceiptNoteId);
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const warehousesById = await loadWarehousesMap(prisma, user.companyId, data.lines);
    for (const line of data.lines) {
      if (!warehousesById.get(line.warehouseId)) {
        throw new AppError("One or more warehouses were not found.");
      }
    }
    const built = buildPurchaseInvoice(data.lines, productsById, supplyType, true, user.id);
    const amountPaid = sumPayments(data.payments ?? []);
    assertPaymentsWithinTotal(amountPaid, built.header.grandTotal);
    if (data.payments && data.payments.length > 0) {
      await assertPaymentLedgersValid(prisma, user.companyId, data.payments);
      await assertPaymentModesMatchLedgers(prisma, user.companyId, data.payments);
    }

    return persistNewPurchaseInvoice(
      user.companyId,
      financialYear.id,
      toHeaderPersistData(data, built.header, amountPaid),
      built.lines.map((line) => line.persist),
      toPaymentPersistData(data.payments ?? []),
      user.id
    );
  },

  // Only reachable while DRAFT (44-purchase-invoice.md: "no Edit after
  // posting") — checked before AND, atomically, inside the write
  // transaction, the sales-invoice-service.ts double-check pattern. Never
  // touches invoiceNumber (still null at this point).
  async updateDraft(id: string, input: UpdatePurchaseInvoiceInput): Promise<PurchaseInvoiceDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    const existing = await purchaseInvoiceRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updatePurchaseInvoiceSchema.parse(input);
    await verifySupplier(prisma, user.companyId, data.supplierId);
    if (data.purchaseOrderId) {
      await verifyPurchaseOrderLinkable(prisma, data.purchaseOrderId);
    }
    if (data.goodsReceiptNoteId) {
      await verifyGoodsReceiptNoteLinkable(prisma, data.goodsReceiptNoteId);
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const warehousesById = await loadWarehousesMap(prisma, user.companyId, data.lines);
    for (const line of data.lines) {
      if (!warehousesById.get(line.warehouseId)) {
        throw new AppError("One or more warehouses were not found.");
      }
    }
    const built = buildPurchaseInvoice(data.lines, productsById, supplyType, true, user.id);
    const amountPaid = sumPayments(data.payments ?? []);
    assertPaymentsWithinTotal(amountPaid, built.header.grandTotal);
    if (data.payments && data.payments.length > 0) {
      await assertPaymentLedgersValid(prisma, user.companyId, data.payments);
      await assertPaymentModesMatchLedgers(prisma, user.companyId, data.payments);
    }

    let updated;
    try {
      updated = await runInTransaction((tx) =>
        purchaseInvoiceRepository.replaceItemsAndUpdate(
          tx,
          id,
          user.companyId,
          ["DRAFT"],
          toHeaderPersistData(data, built.header, amountPaid),
          built.lines.map((line) => line.persist),
          toPaymentPersistData(data.payments ?? [])
        )
      );
    } catch (error) {
      if (isUniqueConstraintError(error, "supplierInvoiceNumber")) {
        throw new AppError("A purchase invoice with this supplier invoice number already exists for this supplier.");
      }
      if (isUniqueConstraintError(error, "goodsReceiptNoteId")) {
        throw new AppError("This goods receipt note already has a purchase invoice linked to it.");
      }
      throw error;
    }
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * The orchestration this whole module exists for
   * (44-purchase-invoice.md's Posting section): one Serializable
   * transaction that re-validates every business rule against CURRENT
   * state, recomputes GST fresh, records the IN stock movement (Inventory
   * Engine), posts the balanced voucher (Voucher Engine), marks a linked
   * Goods Receipt Note invoiced, generates the first real `invoiceNumber`,
   * and flips this invoice to POSTED — atomically. Mirrors
   * sales-invoice-service.ts's postSalesInvoice, direction reversed, minus
   * the Quick Customer conversion step (no equivalent here).
   */
  async postPurchaseInvoice(id: string): Promise<PurchaseInvoiceDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "create");

    const existing = await purchaseInvoiceRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    // Both the invoice's own numbering (assigned for the first time here)
    // and the posting voucher's numbering must be reserved before this
    // transaction opens (documentNumberEngine's/voucherEngine.postVoucher's
    // tx? contract, spec 34/31).
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_INVOICE");
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_VOUCHER");

    return runInTransaction(
      async (tx) => {
        const current = await purchaseInvoiceRepository.findById(id, tx);
        if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
          throw new AppError(CANNOT_POST_MESSAGE);
        }

        const settingsOrNull = await companySettingsService.getSettings(user.companyId);
        await assertPurchaseLedgerMappingValid(tx, user.companyId, settingsOrNull);
        const settings = settingsOrNull as CompanySettings;

        const supplier = await verifySupplier(tx, user.companyId, current.supplierId);
        // Re-verified at posting, not just draft save — mirrors
        // sales-invoice-service.ts's identical posture for its own linked
        // Sales Order.
        if (current.purchaseOrderId) {
          await verifyPurchaseOrderLinkable(tx, current.purchaseOrderId);
        }

        const supplyType = await resolveSupplyType(user.companyId, current.placeOfSupplyStateCode);
        const lineInputs: PurchaseInvoiceLineInput[] = current.items.map((item) => ({
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          rate: item.rate,
          discountPercent: item.discountPercent || undefined,
          discountAmount: item.discountAmount || undefined,
          ratePercent: item.ratePercent,
          cessPercent: item.cessPercent,
          isTaxOverridden: item.isTaxOverridden,
          overriddenCgst: item.overriddenCgst ?? undefined,
          overriddenSgst: item.overriddenSgst ?? undefined,
          overriddenIgst: item.overriddenIgst ?? undefined,
          overriddenCess: item.overriddenCess ?? undefined,
          overrideReason: item.overrideReason ?? undefined,
        }));
        const productsById = await loadProductsMap(tx, user.companyId, lineInputs);
        const warehousesById = await loadWarehousesMap(tx, user.companyId, lineInputs);
        for (const line of lineInputs) {
          const warehouse = warehousesById.get(line.warehouseId);
          if (!warehouse || !warehouse.isActive) {
            throw new AppError("One or more warehouses are inactive and cannot receive stock.");
          }
        }

        // Step 2: recompute from CURRENT lines — never trust stale draft totals.
        const built = buildPurchaseInvoice(lineInputs, productsById, supplyType, true, user.id);

        // Tax-override approve-gate and HSN hard-block (Business Rules:
        // enforced at posting, not just a warning) — mirrors Sales
        // Invoice's below-cost gate, applied here to overrides instead.
        if (built.lines.some((line) => line.persist.isTaxOverridden)) {
          await assertPermission(user, "purchase", "approve");
        }
        for (const line of built.lines) {
          if (line.computation.isHsnMissing) {
            const product = productsById.get(line.persist.productId);
            throw new AppError(`${HSN_MISSING_MESSAGE_PREFIX} ${product?.name ?? "one or more lines"}.`);
          }
        }

        // Step 1: Goods Receipt Note identity/line consistency.
        if (current.goodsReceiptNoteId) {
          const grn = await goodsReceiptNoteService.getGoodsReceiptNote(current.goodsReceiptNoteId, tx);
          if (!grn) {
            throw new AppError(GRN_NOT_FOUND_MESSAGE);
          }
          assertGoodsReceiptNoteConsistent(
            grn,
            user.companyId,
            current.supplierId,
            current.purchaseOrderId ?? undefined,
            lineInputs.map((line) => ({ productId: line.productId, warehouseId: line.warehouseId, quantity: line.quantity }))
          );
        }

        const paymentsPersist: PurchaseInvoicePaymentPersistData[] = current.payments.map((payment) => ({
          ledgerId: payment.ledgerId,
          paymentModeId: payment.paymentModeId,
          amount: payment.amount,
          reference: payment.reference ?? null,
        }));
        const paidTotal = sumPayments(paymentsPersist);

        // Step 3: payments re-validated against the freshly recomputed total.
        assertPaymentsWithinTotal(paidTotal, built.header.grandTotal);
        if (paymentsPersist.length > 0) {
          await assertPaymentLedgersValid(tx, user.companyId, paymentsPersist);
          await assertPaymentModesMatchLedgers(tx, user.companyId, paymentsPersist);
        }

        // Step 4: generate invoiceNumber — the first time this row
        // receives a real number (see this file's header comment).
        const generated = await documentNumberEngine.generateNumber(tx, {
          companyId: user.companyId,
          financialYearId: current.financialYearId,
          documentType: "PURCHASE_INVOICE",
        });

        // Step 5: stock-in, one IN/PURCHASE line per invoice line.
        const stockLines = built.lines.map((line) => ({
          productId: line.persist.productId,
          warehouseId: line.persist.warehouseId,
          transactionType: "PURCHASE" as const,
          direction: "IN" as const,
          quantity: line.persist.quantity,
          transactionDate: toDateInputValue(current.invoiceDate),
          referenceType: "PURCHASE_INVOICE",
          referenceId: current.id,
        }));
        await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

        // Step 6: balanced voucher.
        const entries = buildVoucherEntries({
          supplyType,
          totals: built.header,
          payments: paymentsPersist,
          supplierLedgerId: supplier.ledgerId,
          settings: settings as CompanySettings,
        });
        const voucher = await voucherEngine.postVoucher(
          user.companyId,
          {
            financialYearId: current.financialYearId,
            voucherType: "PURCHASE",
            voucherDate: toDateInputValue(current.invoiceDate),
            narration: current.narration ?? undefined,
            referenceType: "PURCHASE_INVOICE",
            referenceId: current.id,
            createdByUserId: user.id,
            entries,
          },
          tx
        );

        // Step 7: mark a linked GRN invoiced — safe now that step 1 already
        // confirmed the identity/line match.
        if (current.goodsReceiptNoteId) {
          await goodsReceiptNoteService.markInvoiced(current.goodsReceiptNoteId, tx);
        }

        // Step 8: persist final totals, invoiceNumber, voucherId, and
        // POSTED status atomically.
        const posted = await purchaseInvoiceRepository.replaceItemsAndPost(
          tx,
          id,
          user.companyId,
          generated.formatted,
          toHeaderPersistData(
            {
              supplierId: current.supplierId,
              supplierInvoiceNumber: current.supplierInvoiceNumber,
              invoiceDate: toDateInputValue(current.invoiceDate),
              placeOfSupplyStateCode: current.placeOfSupplyStateCode,
              narration: current.narration ?? undefined,
              purchaseOrderId: current.purchaseOrderId ?? undefined,
              goodsReceiptNoteId: current.goodsReceiptNoteId ?? undefined,
            },
            built.header,
            paidTotal
          ),
          built.lines.map((line) => line.persist),
          paymentsPersist,
          voucher.id
        );
        if (!posted) {
          throw new AppError(CANNOT_POST_MESSAGE);
        }

        // Step 9: Latest Purchase Cost write-back + history
        // (95-purchase-price-sync.md). Net-of-discount effective unit cost
        // per line (taxableAmount / quantity); last line wins per product,
        // resolved inside the shared service, on this same `tx`.
        await productPurchasePriceHistoryService.syncFromPurchaseDocument(tx, user.companyId, {
          lines: built.lines.map((line, index) => ({
            productId: line.persist.productId,
            lineNumber: index + 1,
            netUnitCost: line.persist.quantity > 0 ? line.persist.taxableAmount / line.persist.quantity : 0,
          })),
          sourceDocumentType: "PURCHASE_INVOICE",
          sourceDocumentId: current.id,
          sourceDocumentNumber: generated.formatted,
          sourceDocumentDate: current.invoiceDate,
          changedByUserId: user.id,
        });

        return posted;
      },
      SERIALIZABLE_RETRY
    );
  },

  /**
   * `POSTED -> CANCELLED` only — mirrors reversal (Voucher Engine) and
   * reversed stock (Inventory Engine, direction OUT, undoing the earlier
   * IN), atomically, on the SAME transaction client (44-purchase-invoice.md's
   * Cancellation section) — if either half fails, both roll back together.
   * Gated on "approve" (not just "edit"): reversing a POSTED invoice's real
   * financial/stock entries is a stronger action than a routine edit,
   * mirroring Sales Invoice's identical posture. A linked GRN's `INVOICED`
   * status is not auto-reverted (documented gap, same as Sales Invoice's
   * identical decision for Delivery Challan).
   */
  async cancelPurchaseInvoice(id: string): Promise<PurchaseInvoiceDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "approve");

    const existing = await purchaseInvoiceRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED" || !existing.voucherId) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    // The reversal voucher's own numbering must be reserved before this
    // transaction opens (voucherEngine.cancelVoucher's tx? contract).
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await purchaseInvoiceRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED" || !current.voucherId) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      await voucherEngine.cancelVoucher(user.companyId, current.voucherId, tx);

      const stockLines = current.items.map((item) => ({
        productId: item.productId,
        warehouseId: item.warehouseId,
        transactionType: "PURCHASE" as const,
        direction: "OUT" as const,
        quantity: item.quantity,
        transactionDate: toDateInputValue(current.invoiceDate),
        referenceType: "PURCHASE_INVOICE",
        referenceId: current.id,
      }));
      await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

      const count = await purchaseInvoiceRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await purchaseInvoiceRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    }, SERIALIZABLE_RETRY);
  },
};
