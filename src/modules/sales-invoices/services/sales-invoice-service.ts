import { Prisma, type CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertPermission } from "@/lib/permissions";
import { isRetryableTransactionError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { gstEngine } from "@/engines/gst/gst-engine";
import type { CalculateLineInput, DocumentGroupResult, SupplyType } from "@/engines/gst/types";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import { pricingEngine } from "@/engines/pricing/pricing-engine";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import type { VoucherEntryLineInput } from "@/engines/voucher/voucher-validation";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import {
  assertSalesLedgerMappingComplete,
  isSalesLedgerMappingComplete,
} from "@/modules/company/utils/sales-ledger-mapping";
import { customerService } from "@/modules/customers/services/customer-service";
import { deliveryChallanService } from "@/modules/delivery-challans/services/delivery-challan-service";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";
import {
  salesInvoiceRepository,
  type SalesInvoiceHeaderPersistData,
  type SalesInvoiceLinePersistData,
  type SalesInvoicePaymentPersistData,
} from "@/modules/sales-invoices/repositories/sales-invoice-repository";
import {
  computeRoundOff,
  computeTaxableAmountPre,
  sumEffectiveTax,
  sumHeaderGrossTotals,
  toPaise,
} from "@/modules/sales-invoices/utils/sales-invoice-calculations";
import {
  createSalesInvoiceSchema,
  previewSalesInvoiceSchema,
  toUtcDate,
  updateSalesInvoiceSchema,
  type CreateSalesInvoiceInput,
  type PreviewSalesInvoiceInput,
  type SalesInvoiceLineInput,
  type SalesInvoicePaymentInput,
  type UpdateSalesInvoiceInput,
} from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type {
  DeliveryChallanPrefill,
  ItemWiseSalesAggregateRow,
  ItemWiseSalesFilters,
  PartyWiseSalesAggregateRow,
  PartyWiseSalesFilters,
  ResolvedSalesInvoiceLinePrice,
  SalesInvoiceDetail,
  SalesInvoiceFormOptions,
  SalesInvoiceLineComputation,
  SalesInvoiceListFilters,
  SalesInvoiceListRow,
  SalesInvoiceProductOption,
  SalesInvoicePreview,
  SalesInvoiceTotals,
  SalesInvoiceWarehouseOption,
} from "@/types/sales-invoice";

// 38-sales-invoice.md's Posting section lists "Generate invoiceNumber" as
// step 5, inside the posting transaction. NOT implemented literally: the
// `invoiceNumber` column is non-nullable, so a DRAFT row needs a real value
// from the moment it's created — deviating here in favor of this chain's
// established convention (Quotation/Sales Order/Delivery Challan all number
// at DRAFT creation, not at posting) and the schema's own constraint.
// `createDraft` generates the number; `postSalesInvoice` never re-generates
// one. Recorded in progress-tracker.md.

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Sales invoice not found.";
const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found.";
const SALES_ORDER_NOT_FOUND_MESSAGE = "Sales order not found.";
const CUSTOMER_INACTIVE_MESSAGE = "Selected customer is inactive.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with sales invoices.";
const NO_COMPANY_STATE_MESSAGE =
  "Set your company's GST state before creating a sales invoice (Company > Edit Profile).";
const CANNOT_CHANGE_MESSAGE =
  "This sales invoice can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This sales invoice can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted sales invoice can be cancelled.";
const DELIVERY_CHALLAN_NOT_FOUND_MESSAGE = "Delivery challan not found.";
const DELIVERY_CHALLAN_NOT_AVAILABLE_MESSAGE =
  "This delivery challan is not dispatched, or is already invoiced by another sales invoice.";
const DELIVERY_CHALLAN_CUSTOMER_MISMATCH_MESSAGE =
  "The linked delivery challan's customer does not match this invoice's customer.";
const DELIVERY_CHALLAN_ORDER_MISMATCH_MESSAGE =
  "The linked sales order does not match the delivery challan's own linked order.";
const DELIVERY_CHALLAN_LINE_MISMATCH_MESSAGE =
  "Every invoice line must match one of the linked delivery challan's own lines exactly (same product and quantity).";
const HSN_MISSING_MESSAGE_PREFIX = "HSN/SAC code is required for";
const WALK_IN_FULL_PAYMENT_MESSAGE = "Walk-in sales require full payment.";
const OVERPAYMENT_MESSAGE = "Total payments cannot exceed the invoice's grand total.";

const QUANTITY_TOLERANCE = 1e-6;

const ZERO_TOTALS: SalesInvoiceTotals = {
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

// Posting always contains at least one OUT stock line (a Sales Invoice is
// never lineless) — Serializable + bounded retry, the Inventory Engine's own
// OUT-batch convention, shared here across the stock/voucher/challan writes.
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "This sales invoice's referenced data changed due to another request. Please try again.",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Unit-dependent, so enforced here (after the product/unit row loads) rather
// than as a static Zod bound — mirrors sales-order-service.ts's identical
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
  persist: SalesInvoiceLinePersistData;
  computation: Omit<SalesInvoiceLineComputation, "lineNumber">;
  calcInput: CalculateLineInput | null;
}

/**
 * Builds one line's persisted fields and display computation. Unlike
 * Quotation/Sales Order/Delivery Challan, `cgst`/`sgst`/`igst`/`cess` always
 * hold the SYSTEM-COMPUTED values (never overwritten) while
 * `overridden*`/`totalAmount` reflect the EFFECTIVE (used) values whenever
 * `isTaxOverridden` is set — the spec-33 forward-note, implemented literally
 * (38-sales-invoice.md's Data Model decision, this document's own audit
 * trail).
 */
function buildLine(
  input: SalesInvoiceLineInput,
  product: SalesInvoiceProductOption,
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

  const persist: SalesInvoiceLinePersistData = {
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

  const computation: Omit<SalesInvoiceLineComputation, "lineNumber"> = {
    taxableAmount,
    cgst: effectiveCgst,
    sgst: effectiveSgst,
    igst: effectiveIgst,
    cess: effectiveCess,
    totalAmount,
    isBelowCost: product.purchasePrice !== null && input.rate < product.purchasePrice,
    isHsnMissing: gstEngine.isHsnRequired(isTaxedLine, product.hsnCode),
    isGstRateMissing: isTaxedLine && !product.hasGstRate,
  };

  return { persist, computation, calcInput };
}

interface BuiltSalesInvoice {
  lines: BuiltLine[];
  header: SalesInvoiceTotals;
  groups: DocumentGroupResult[];
}

/**
 * Composes every line via `buildLine`, then aggregates header totals TWICE:
 * once via the GST Engine's calculateDocument (computed-only, for the
 * display `groups` breakdown) and once via this module's own
 * `sumEffectiveTax` (override-substituted, the totals actually posted) —
 * the two diverge whenever any line is tax-overridden, which
 * calculateDocument has no way to know about.
 */
function buildSalesInvoice(
  lineInputs: readonly SalesInvoiceLineInput[],
  productsById: ReadonlyMap<string, SalesInvoiceProductOption>,
  supplyType: SupplyType,
  strict: boolean,
  userId: string
): BuiltSalesInvoice {
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
      throw new AppError("A sales invoice cannot consist entirely of zero-value lines.");
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
  lineInputs: readonly SalesInvoiceLineInput[]
): Promise<Map<string, SalesInvoiceProductOption>> {
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];
  const products = await salesInvoiceRepository.findProductsForLines(client, companyId, productIds);
  return new Map(products.map((product) => [product.id, product]));
}

async function loadWarehousesMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly SalesInvoiceLineInput[]
): Promise<Map<string, SalesInvoiceWarehouseOption>> {
  const warehouseIds = [...new Set(lineInputs.map((line) => line.warehouseId))];
  const warehouses = await salesInvoiceRepository.findWarehousesForLines(client, companyId, warehouseIds);
  return new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
}

// Accepts the caller's client (plain `prisma` for the pre-transaction
// create/update path, `tx` inside postSalesInvoice) — a posting-time call
// through the global `prisma` singleton would read outside the Serializable
// transaction's own snapshot, letting a concurrent customer deactivation
// race past this check (security review finding).
async function verifyPermanentCustomer(
  client: PrismaClientOrTransaction,
  companyId: string,
  customerId: string
): Promise<void> {
  const customer = await salesInvoiceRepository.findCustomerForInvoice(client, companyId, customerId);
  if (!customer) {
    throw new AppError(CUSTOMER_NOT_FOUND_MESSAGE);
  }
  if (!customer.isActive) {
    throw new AppError(CUSTOMER_INACTIVE_MESSAGE);
  }
}

// Both linkages are optional cross-document references with NO compound
// (companyId, id) key at the schema level, and `deliveryChallanId` carries a
// global @unique constraint — a client-supplied id belonging to another
// company must be rejected explicitly here, not left to an FK that has no
// tenant awareness (security review finding: unvalidated cross-tenant
// salesOrderId/deliveryChallanId). Reuses the sibling services' own
// company-scoping (both already resolve a cross-company id to `null`,
// mirroring "not found," never leaking existence) rather than a new
// repository method.
async function verifySalesOrderLinkable(salesOrderId: string): Promise<void> {
  const salesOrder = await salesOrderService.getSalesOrder(salesOrderId);
  if (!salesOrder) {
    throw new AppError(SALES_ORDER_NOT_FOUND_MESSAGE);
  }
}

async function verifyDeliveryChallanLinkable(deliveryChallanId: string): Promise<void> {
  const challan = await deliveryChallanService.getDeliveryChallan(deliveryChallanId);
  if (!challan) {
    throw new AppError(DELIVERY_CHALLAN_NOT_FOUND_MESSAGE);
  }
  if (challan.status !== "DISPATCHED") {
    throw new AppError(DELIVERY_CHALLAN_NOT_AVAILABLE_MESSAGE);
  }
}

async function resolveSupplyType(companyId: string, placeOfSupplyStateCode: string): Promise<SupplyType> {
  const companyStateCode = await salesInvoiceRepository.findCompanyStateCode(companyId);
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
    customerMode: "PERMANENT" | "QUICK" | "WALK_IN";
    customerId?: string;
    quickCustomerName?: string;
    quickCustomerMobile?: string;
    quickCustomerGstin?: string;
    quickCustomerAddress?: string;
    invoiceDate: string;
    placeOfSupplyStateCode: string;
    narration?: string;
    salesOrderId?: string;
    deliveryChallanId?: string;
  },
  totals: SalesInvoiceTotals,
  amountPaid: number
): SalesInvoiceHeaderPersistData {
  return {
    customerMode: data.customerMode,
    customerId: data.customerId ?? null,
    quickCustomerName: data.quickCustomerName ?? null,
    quickCustomerMobile: data.quickCustomerMobile ?? null,
    quickCustomerGstin: data.quickCustomerGstin ?? null,
    quickCustomerAddress: data.quickCustomerAddress ?? null,
    invoiceDate: toUtcDate(data.invoiceDate),
    placeOfSupplyStateCode: data.placeOfSupplyStateCode,
    narration: data.narration ?? null,
    salesOrderId: data.salesOrderId ?? null,
    deliveryChallanId: data.deliveryChallanId ?? null,
    ...totals,
    amountPaid,
  };
}

function toPaymentPersistData(payments: readonly SalesInvoicePaymentInput[]): SalesInvoicePaymentPersistData[] {
  return payments.map((payment) => ({
    ledgerId: payment.ledgerId,
    amount: payment.amount,
    reference: payment.reference ?? null,
  }));
}

function sumPayments(payments: readonly { amount: number }[]): number {
  return payments.reduce((paise, payment) => paise + toPaise(payment.amount), 0) / 100;
}

/** `Σ payments <= grandTotal` for every mode; `=== grandTotal` exactly for
 * WALK_IN (no ledger exists to carry a walk-in balance) — checked against
 * the freshly recomputed `grandTotal`, never a stale draft total
 * (38-sales-invoice.md's Ledger Posting rule). */
function assertPaymentsWithinTotal(
  customerMode: "PERMANENT" | "QUICK" | "WALK_IN",
  paidTotal: number,
  grandTotal: number
): void {
  const paidPaise = toPaise(paidTotal);
  const grandTotalPaise = toPaise(grandTotal);
  if (customerMode === "WALK_IN") {
    if (paidPaise !== grandTotalPaise) {
      throw new AppError(WALK_IN_FULL_PAYMENT_MESSAGE);
    }
    return;
  }
  if (paidPaise > grandTotalPaise) {
    throw new AppError(OVERPAYMENT_MESSAGE);
  }
}

async function persistNewSalesInvoice(
  companyId: string,
  financialYearId: string,
  header: SalesInvoiceHeaderPersistData,
  lines: SalesInvoiceLinePersistData[],
  payments: SalesInvoicePaymentPersistData[],
  createdByUserId: string
): Promise<SalesInvoiceDetail> {
  // ensureSequence must run in its own short-lived statement BEFORE the
  // creation transaction opens — the Document Number Engine's documented
  // contract, sales-order-service.ts's persistNewSalesOrder precedent. See
  // this file's header comment for why numbering happens here (at DRAFT
  // creation), not at posting, despite the spec's literal step ordering.
  await documentNumberEngine.ensureSequence(companyId, financialYearId, "SALES_INVOICE");

  try {
    return await runInTransaction(async (tx) => {
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId,
        financialYearId,
        documentType: "SALES_INVOICE",
      });
      return salesInvoiceRepository.create(tx, companyId, financialYearId, header, lines, payments, generated, createdByUserId);
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // Narrowed to the specific violated column — `deliveryChallanId` is also
    // `@unique` (one invoice per challan), and a generic (unscoped) check
    // here would mis-report a double "Create Invoice" race against the same
    // challan as an invoice-number collision (code review finding).
    if (isUniqueConstraintError(error, "invoiceNumber")) {
      throw new AppError("A sales invoice with this number already exists for this financial year.");
    }
    if (isUniqueConstraintError(error, "deliveryChallanId")) {
      throw new AppError("This delivery challan already has a sales invoice linked to it.");
    }
    throw error;
  }
}

interface DeliveryChallanForInvoicing {
  id: string;
  companyId: string;
  customerId: string;
  salesOrderId: string | null;
  status: string;
  items: readonly { productId: string; quantity: number }[];
}

/**
 * Posting step 2 (only when `deliveryChallanId` is set): the challan's
 * customer/company/linked-order must agree with this invoice's own, its
 * status must still be `DISPATCHED`, and every invoice line's product+
 * quantity must match one of the challan's own lines exactly (one invoice
 * line per challan line — no splitting or partial invoicing in this phase).
 */
function assertDeliveryChallanConsistent(
  challan: DeliveryChallanForInvoicing,
  companyId: string,
  resolvedCustomerId: string | null,
  salesOrderId: string | undefined,
  lines: readonly { productId: string; quantity: number }[]
): void {
  if (challan.companyId !== companyId) {
    throw new AppError(DELIVERY_CHALLAN_NOT_FOUND_MESSAGE);
  }
  if (challan.status !== "DISPATCHED") {
    throw new AppError(DELIVERY_CHALLAN_NOT_AVAILABLE_MESSAGE);
  }
  if (challan.customerId !== resolvedCustomerId) {
    throw new AppError(DELIVERY_CHALLAN_CUSTOMER_MISMATCH_MESSAGE);
  }
  if (salesOrderId && challan.salesOrderId && salesOrderId !== challan.salesOrderId) {
    throw new AppError(DELIVERY_CHALLAN_ORDER_MISMATCH_MESSAGE);
  }
  if (lines.length !== challan.items.length) {
    throw new AppError(DELIVERY_CHALLAN_LINE_MISMATCH_MESSAGE);
  }
  const remainingChallanLines = challan.items.map((item) => ({ ...item }));
  for (const line of lines) {
    const matchIndex = remainingChallanLines.findIndex(
      (item) => item.productId === line.productId && Math.abs(item.quantity - line.quantity) < QUANTITY_TOLERANCE
    );
    if (matchIndex === -1) {
      throw new AppError(DELIVERY_CHALLAN_LINE_MISMATCH_MESSAGE);
    }
    remainingChallanLines.splice(matchIndex, 1);
  }
}

interface VoucherEntriesInput {
  supplyType: SupplyType;
  totals: SalesInvoiceTotals;
  payments: readonly SalesInvoicePaymentPersistData[];
  customerLedgerId: string | null;
  settings: CompanySettings;
}

/** 38-sales-invoice.md's Ledger Posting section — balances by construction
 * (see that section's own proof), so any imbalance here indicates a bug in
 * this aggregation, not a data problem `postVoucher`'s own balance check
 * should paper over. */
function buildVoucherEntries(input: VoucherEntriesInput): VoucherEntryLineInput[] {
  const entries: VoucherEntryLineInput[] = [];
  const { totals, settings } = input;

  if (totals.taxableAmount > 0) {
    entries.push({ ledgerId: settings.salesLedgerId as string, entryType: "CREDIT", amount: totals.taxableAmount });
  }
  if (input.supplyType === "INTRA_STATE") {
    if (totals.totalCgst > 0) {
      entries.push({ ledgerId: settings.outputCgstLedgerId as string, entryType: "CREDIT", amount: totals.totalCgst });
    }
    if (totals.totalSgst > 0) {
      entries.push({ ledgerId: settings.outputSgstLedgerId as string, entryType: "CREDIT", amount: totals.totalSgst });
    }
  } else if (totals.totalIgst > 0) {
    entries.push({ ledgerId: settings.outputIgstLedgerId as string, entryType: "CREDIT", amount: totals.totalIgst });
  }
  if (totals.totalCess > 0) {
    entries.push({ ledgerId: settings.outputCessLedgerId as string, entryType: "CREDIT", amount: totals.totalCess });
  }

  for (const payment of input.payments) {
    entries.push({ ledgerId: payment.ledgerId, entryType: "DEBIT", amount: payment.amount });
  }

  const paidTotal = sumPayments(input.payments);
  const remainderPaise = toPaise(totals.grandTotal) - toPaise(paidTotal);
  if (remainderPaise > 0) {
    // Only PERMANENT/converted-QUICK invoices can reach here with a
    // remainder — WALK_IN's exact-payment rule (assertPaymentsWithinTotal)
    // guarantees remainderPaise === 0 for that mode.
    entries.push({ ledgerId: input.customerLedgerId as string, entryType: "DEBIT", amount: remainderPaise / 100 });
  }

  if (totals.roundOff !== 0) {
    entries.push({
      ledgerId: settings.roundOffLedgerId as string,
      entryType: totals.roundOff < 0 ? "DEBIT" : "CREDIT",
      amount: Math.abs(totals.roundOff),
    });
  }

  return entries;
}

/**
 * Converts a QUICK invoice's captured fields into a real Customer+Ledger,
 * inside the CALLER's posting transaction (38-sales-invoice.md's Business
 * Rules — the conversion must commit or roll back atomically with the rest
 * of posting). Resolves the Sundry Debtors group the same way
 * customer-service.ts's own comment documents: when exactly one applies, no
 * picker is needed; otherwise this spec doesn't build one (out of scope —
 * convert manually via Customer Management), a deliberate simplification
 * recorded in progress-tracker.md.
 */
async function convertQuickCustomer(
  tx: Prisma.TransactionClient,
  data: {
    quickCustomerName?: string;
    quickCustomerMobile?: string;
    quickCustomerGstin?: string;
    quickCustomerAddress?: string;
  }
): Promise<{ customerId: string; ledgerId: string }> {
  const groups = await customerService.listSelectableLedgerGroupsForSale();
  if (groups.length !== 1) {
    throw new AppError(
      groups.length === 0
        ? "No active Sundry Debtors ledger group is available to convert this Quick Customer. Set one up first."
        : "Multiple Sundry Debtors ledger groups exist — convert this Quick Customer manually via Customer Management."
    );
  }

  const created = await customerService.createCustomerFromSale(
    {
      displayName: data.quickCustomerName ?? "",
      ledgerGroupId: groups[0].id,
      customerType: "RETAIL",
      mobileNumber: data.quickCustomerMobile,
      gstin: data.quickCustomerGstin,
      addressLine1: data.quickCustomerAddress,
      openingBalance: 0,
      openingBalanceType: "DEBIT",
    },
    tx
  );

  return { customerId: created.id, ledgerId: created.ledger.id };
}

export const salesInvoiceService = {
  async listSalesInvoices(filters: SalesInvoiceListFilters = {}): Promise<SalesInvoiceListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return salesInvoiceRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /**
   * The same read as `listSalesInvoices`, gated on `reports`/`view` instead
   * of `sales`/`view` — 68-sales-reports.md's Sales Register calls this one,
   * not `listSalesInvoices`, so the seeded Accountant role (`reports:view`,
   * no `sales:view` — see `DEFAULT_ROLE_PERMISSIONS`) can view it without
   * also needing Sales module access. Mirrors gst-register-service.ts's own
   * `listPartyOptions` precedent of avoiding a mismatched permission
   * dependency rather than reusing a same-shaped method gated on the wrong
   * module. Still goes through this service (Invariant 5), calling the same
   * `salesInvoiceRepository.findMany` `listSalesInvoices` does — no new
   * repository method.
   */
  async listSalesInvoicesForReport(filters: SalesInvoiceListFilters = {}): Promise<SalesInvoiceListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return salesInvoiceRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /**
   * 68-sales-reports.md's Item-wise Sales Report — the entry point Sales
   * Reports (and, per that spec, Customer Reports' own future Customer
   * Sales Summary — 71-customer-reports.md) calls; cross-module reads go
   * through this service method, never `sales-invoice-repository.ts`
   * directly (Invariant 5). Gated on `reports`/`view`, not `sales`/`view` —
   * see `listSalesInvoicesForReport`'s own note on why. Scoped to the
   * active financial year only, matching every other method in this module
   * (this module has no caller-selectable financial year anywhere else).
   */
  async getItemWiseSalesReport(filters: ItemWiseSalesFilters): Promise<ItemWiseSalesAggregateRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return salesInvoiceRepository.aggregateItemWiseSales(user.companyId, financialYear.id, filters);
  },

  /** 68-sales-reports.md's Party-wise Sales Summary — mirrors
   * getItemWiseSalesReport's own permission/financial-year posture exactly. */
  async getPartyWiseSalesReport(filters: PartyWiseSalesFilters): Promise<PartyWiseSalesAggregateRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return salesInvoiceRepository.aggregatePartyWiseSales(user.companyId, financialYear.id, filters);
  },

  async getSalesInvoice(id: string): Promise<SalesInvoiceDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const invoice = await salesInvoiceRepository.findById(id);
    if (!invoice || invoice.companyId !== user.companyId) {
      return null;
    }
    return invoice;
  },

  async listSalesInvoiceFormOptions(): Promise<SalesInvoiceFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await requireFinancialYear();

    const [customers, products, warehouses, paymentLedgers, companyStateCode, settings, preview] = await Promise.all([
      customerService.listSelectableCustomers(),
      salesInvoiceRepository.findInvoiceableProducts(user.companyId),
      salesInvoiceRepository.findSelectableWarehouses(user.companyId),
      ledgerService.listSelectableLedgers(),
      salesInvoiceRepository.findCompanyStateCode(user.companyId),
      companySettingsService.getSettings(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "SALES_INVOICE",
      }),
    ]);

    return {
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.ledger.name,
        isActive: customer.isActive,
        creditLimit: customer.creditLimit,
      })),
      products,
      warehouses,
      paymentLedgers: paymentLedgers.map((ledger) => ({
        id: ledger.id,
        name: ledger.name,
        groupName: ledger.ledgerGroup.name,
      })),
      companyStateCode,
      nextInvoiceNumber: preview.formatted,
      isLedgerMappingComplete: isSalesLedgerMappingComplete(settings),
    };
  },

  /** Read-only prefill lookup for "New Sales Invoice" reached via
   * `?deliveryChallanId=` — mirrors delivery-challan-service.ts's
   * getSalesOrderPrefill. Returns null when the challan doesn't exist, isn't
   * DISPATCHED, or belongs to another company. */
  async getDeliveryChallanPrefill(deliveryChallanId: string): Promise<DeliveryChallanPrefill | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const challan = await deliveryChallanService.getDeliveryChallan(deliveryChallanId);
    if (!challan || challan.status !== "DISPATCHED") {
      return null;
    }

    const productIds = [...new Set(challan.items.map((item) => item.productId))];
    const products = await salesInvoiceRepository.findProductsForLines(prisma, user.companyId, productIds);
    const productsById = new Map(products.map((product) => [product.id, product]));

    return {
      deliveryChallanId: challan.id,
      challanNumber: challan.challanNumber,
      customerId: challan.customerId,
      salesOrderId: challan.salesOrderId,
      lines: challan.items.map((item) => {
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

  /** Read-only pass-through to the Pricing Engine — mirrors
   * salesOrderService.resolveLinePrice. */
  async resolveLinePrice(input: {
    productId: string;
    quantity: number;
    customerId?: string;
    asOfDate?: string;
  }): Promise<ResolvedSalesInvoiceLinePrice> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const result = await pricingEngine.resolvePrice({
      companyId: user.companyId,
      productId: input.productId,
      quantity: input.quantity,
      customerId: input.customerId,
      asOfDate: input.asOfDate ? toUtcDate(input.asOfDate) : undefined,
    });

    return {
      price: result.price,
      source: result.source,
      isBelowCost: result.isBelowCost,
      purchaseCost: result.purchaseCost,
    };
  },

  /** The live-editing preview — mirrors salesOrderService.previewSalesOrder. */
  async previewSalesInvoice(input: PreviewSalesInvoiceInput): Promise<SalesInvoicePreview> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const data = previewSalesInvoiceSchema.parse(input);
    if (data.lines.length === 0) {
      return { lines: [], totals: ZERO_TOTALS, groups: [] };
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildSalesInvoice(data.lines, productsById, supplyType, false, user.id);

    return {
      lines: built.lines.map((line, index) => ({ lineNumber: index + 1, ...line.computation })),
      totals: built.header,
      groups: built.groups,
    };
  },

  async createDraft(input: CreateSalesInvoiceInput): Promise<SalesInvoiceDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const financialYear = await requireFinancialYear();
    const data = createSalesInvoiceSchema.parse(input);

    if (data.customerMode === "PERMANENT") {
      await verifyPermanentCustomer(prisma, user.companyId, data.customerId as string);
    }
    if (data.salesOrderId) {
      await verifySalesOrderLinkable(data.salesOrderId);
    }
    if (data.deliveryChallanId) {
      await verifyDeliveryChallanLinkable(data.deliveryChallanId);
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const warehousesById = await loadWarehousesMap(prisma, user.companyId, data.lines);
    for (const line of data.lines) {
      if (!warehousesById.get(line.warehouseId)) {
        throw new AppError("One or more warehouses were not found.");
      }
    }
    const built = buildSalesInvoice(data.lines, productsById, supplyType, true, user.id);
    const amountPaid = sumPayments(data.payments ?? []);
    assertPaymentsWithinTotal(data.customerMode, amountPaid, built.header.grandTotal);

    return persistNewSalesInvoice(
      user.companyId,
      financialYear.id,
      toHeaderPersistData(data, built.header, amountPaid),
      built.lines.map((line) => line.persist),
      toPaymentPersistData(data.payments ?? []),
      user.id
    );
  },

  // Only reachable while DRAFT (38-sales-invoice.md: "no Edit after
  // posting") — checked before AND, atomically, inside the write
  // transaction, the sales-order-service.ts double-check pattern. Never
  // regenerates invoiceNumber.
  async updateDraft(id: string, input: UpdateSalesInvoiceInput): Promise<SalesInvoiceDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const existing = await salesInvoiceRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateSalesInvoiceSchema.parse(input);
    if (data.customerMode === "PERMANENT") {
      await verifyPermanentCustomer(prisma, user.companyId, data.customerId as string);
    }
    if (data.salesOrderId) {
      await verifySalesOrderLinkable(data.salesOrderId);
    }
    if (data.deliveryChallanId) {
      await verifyDeliveryChallanLinkable(data.deliveryChallanId);
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const warehousesById = await loadWarehousesMap(prisma, user.companyId, data.lines);
    for (const line of data.lines) {
      if (!warehousesById.get(line.warehouseId)) {
        throw new AppError("One or more warehouses were not found.");
      }
    }
    const built = buildSalesInvoice(data.lines, productsById, supplyType, true, user.id);
    const amountPaid = sumPayments(data.payments ?? []);
    assertPaymentsWithinTotal(data.customerMode, amountPaid, built.header.grandTotal);

    const updated = await runInTransaction((tx) =>
      salesInvoiceRepository.replaceItemsAndUpdate(
        tx,
        id,
        user.companyId,
        ["DRAFT"],
        toHeaderPersistData(data, built.header, amountPaid),
        built.lines.map((line) => line.persist),
        toPaymentPersistData(data.payments ?? [])
      )
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * The orchestration this whole module exists for (38-sales-invoice.md's
   * Posting section): one Serializable transaction that re-validates every
   * business rule against CURRENT state, recomputes GST fresh, converts a
   * Quick Customer if needed, records the OUT stock movement (Inventory
   * Engine), posts the balanced voucher (Voucher Engine), marks a linked
   * Delivery Challan invoiced, and flips this invoice to POSTED — atomically.
   *
   * This invoice's own state (lines, payments, header) is re-read and
   * recomputed INSIDE the transaction from `current`, never from a
   * pre-transaction snapshot — a stale outer read combined with a
   * concurrent `updateDraft` between that read and this transaction opening
   * would otherwise post against out-of-date lines, defeating the "never
   * trust stale draft totals" rule this method exists to enforce. Cross-
   * module reads (the linked Sales Order/Delivery Challan, the customer's
   * active status via `verifyPermanentCustomer`, company settings) go
   * through `tx` where the target repository accepts one; the Sales Order/
   * Delivery Challan services themselves don't accept a `tx` parameter, so
   * those two specific reads run outside this transaction's own snapshot —
   * safe in practice because `deliveryChallanService.markInvoiced`'s write
   * is itself atomically guarded (`WHERE status = 'DISPATCHED'`), so a
   * genuine race there aborts the whole transaction rather than corrupting
   * state, but it is not a Serializable-isolation guarantee (code review
   * finding — flagged here rather than silently overclaimed). The only
   * pre-transaction work is the cheap not-found/status fail-fast and
   * reserving the reversal-voucher-free posting voucher's sequence
   * (`ensureSequence` must run before the transaction opens, spec
   * 31's contract).
   */
  async postSalesInvoice(id: string): Promise<SalesInvoiceDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const existing = await salesInvoiceRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    // The posting voucher's own numbering must be reserved before this
    // transaction opens (voucherEngine.postVoucher's tx? contract, spec 31).
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "SALES_VOUCHER");

    return runInTransaction(
      async (tx) => {
        const current = await salesInvoiceRepository.findById(id, tx);
        if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
          throw new AppError(CANNOT_POST_MESSAGE);
        }

        const settings = await companySettingsService.getSettings(user.companyId);
        assertSalesLedgerMappingComplete(settings);

        if (current.customerMode === "PERMANENT") {
          await verifyPermanentCustomer(tx, user.companyId, current.customerId as string);
        }
        // Re-verified at posting, not just draft save — a linked Sales
        // Order must still belong to this company regardless of whether a
        // Delivery Challan is also linked (the challan-consistency check
        // below only cross-checks salesOrderId AGREEMENT when both are
        // present; it never independently re-validates a challan-less
        // salesOrderId's ownership — security review finding).
        if (current.salesOrderId) {
          await verifySalesOrderLinkable(current.salesOrderId);
        }

        const supplyType = await resolveSupplyType(user.companyId, current.placeOfSupplyStateCode);
        const lineInputs: SalesInvoiceLineInput[] = current.items.map((item) => ({
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          rate: item.rate,
          discountPercent: item.discountPercent || undefined,
          discountAmount: item.discountAmount || undefined,
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
            throw new AppError("One or more warehouses are inactive and cannot be invoiced from.");
          }
        }

        // Step 3: recompute from CURRENT lines — never trust stale draft totals.
        const built = buildSalesInvoice(lineInputs, productsById, supplyType, true, user.id);

        // Below-cost approve-gate and HSN hard-block (Business Rules:
        // enforced at posting, not just a warning).
        if (built.lines.some((line) => line.computation.isBelowCost)) {
          await assertPermission(user, "sales", "approve");
        }
        for (const line of built.lines) {
          if (line.computation.isHsnMissing) {
            const product = productsById.get(line.persist.productId);
            throw new AppError(`${HSN_MISSING_MESSAGE_PREFIX} ${product?.name ?? "one or more lines"}.`);
          }
        }

        const paymentsPersist: SalesInvoicePaymentPersistData[] = current.payments.map((payment) => ({
          ledgerId: payment.ledgerId,
          amount: payment.amount,
          reference: payment.reference ?? null,
        }));
        const paidTotal = sumPayments(paymentsPersist);
        const leavesUnpaidBalance = toPaise(built.header.grandTotal) - toPaise(paidTotal) > 0;

        // Quick Customer conversion — first sub-step (Business Rules),
        // inside this same transaction, auto-triggered whenever posting
        // would otherwise leave an unpaid balance (a QUICK invoice has no
        // ledger to carry a balance until converted). Skipped if a prior
        // (committed) attempt already set customerId — defensive; under
        // full atomicity a failed attempt rolls back customerId too, so
        // this guard is normally unreachable in the success path, but cheap
        // to keep per this spec's own explicit "a retry does not create a
        // second Customer" requirement.
        let resolvedCustomerId = current.customerId;
        let resolvedCustomerMode = current.customerMode;
        let resolvedCustomerLedgerId: string | null = null;

        if (current.customerMode === "QUICK" && !current.customerId && leavesUnpaidBalance) {
          const converted = await convertQuickCustomer(tx, {
            quickCustomerName: current.quickCustomerName ?? undefined,
            quickCustomerMobile: current.quickCustomerMobile ?? undefined,
            quickCustomerGstin: current.quickCustomerGstin ?? undefined,
            quickCustomerAddress: current.quickCustomerAddress ?? undefined,
          });
          resolvedCustomerId = converted.customerId;
          resolvedCustomerLedgerId = converted.ledgerId;
          resolvedCustomerMode = "PERMANENT";
        }

        if (resolvedCustomerId && !resolvedCustomerLedgerId) {
          const customer = await salesInvoiceRepository.findCustomerForInvoice(tx, user.companyId, resolvedCustomerId);
          if (!customer) {
            throw new AppError(CUSTOMER_NOT_FOUND_MESSAGE);
          }
          resolvedCustomerLedgerId = customer.ledgerId;
        }

        // Step 2: Delivery Challan identity/line consistency.
        if (current.deliveryChallanId) {
          const challan = await deliveryChallanService.getDeliveryChallan(current.deliveryChallanId);
          if (!challan) {
            throw new AppError(DELIVERY_CHALLAN_NOT_FOUND_MESSAGE);
          }
          assertDeliveryChallanConsistent(
            challan,
            user.companyId,
            resolvedCustomerId,
            current.salesOrderId ?? undefined,
            lineInputs.map((line) => ({ productId: line.productId, quantity: line.quantity }))
          );
        }

        // Step 4: payments re-validated against the freshly recomputed total.
        assertPaymentsWithinTotal(resolvedCustomerMode, paidTotal, built.header.grandTotal);

        // Step 6: stock-out, one OUT/SALES line per invoice line.
        const stockLines = built.lines.map((line) => ({
          productId: line.persist.productId,
          warehouseId: line.persist.warehouseId,
          transactionType: "SALES" as const,
          direction: "OUT" as const,
          quantity: line.persist.quantity,
          transactionDate: toDateInputValue(current.invoiceDate),
          referenceType: "SALES_INVOICE",
          referenceId: current.id,
        }));
        await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

        // Step 7: balanced voucher.
        const entries = buildVoucherEntries({
          supplyType,
          totals: built.header,
          payments: paymentsPersist,
          customerLedgerId: resolvedCustomerLedgerId,
          settings,
        });
        const voucher = await voucherEngine.postVoucher(
          user.companyId,
          {
            financialYearId: current.financialYearId,
            voucherType: "SALES",
            voucherDate: toDateInputValue(current.invoiceDate),
            narration: current.narration ?? undefined,
            referenceType: "SALES_INVOICE",
            referenceId: current.id,
            createdByUserId: user.id,
            entries,
          },
          tx
        );

        // Step 8: mark a linked challan invoiced — safe now that step 2
        // already confirmed the identity/line match.
        if (current.deliveryChallanId) {
          await deliveryChallanService.markInvoiced(current.deliveryChallanId, tx);
        }

        // Step 10 (combined with step 3's recompute): persist final totals,
        // resolved customer, voucherId, and POSTED status atomically.
        const posted = await salesInvoiceRepository.replaceItemsAndPost(
          tx,
          id,
          user.companyId,
          toHeaderPersistData(
            {
              customerMode: resolvedCustomerMode,
              customerId: resolvedCustomerId ?? undefined,
              quickCustomerName: current.quickCustomerName ?? undefined,
              quickCustomerMobile: current.quickCustomerMobile ?? undefined,
              quickCustomerGstin: current.quickCustomerGstin ?? undefined,
              quickCustomerAddress: current.quickCustomerAddress ?? undefined,
              invoiceDate: toDateInputValue(current.invoiceDate),
              placeOfSupplyStateCode: current.placeOfSupplyStateCode,
              narration: current.narration ?? undefined,
              salesOrderId: current.salesOrderId ?? undefined,
              deliveryChallanId: current.deliveryChallanId ?? undefined,
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
        return posted;
      },
      SERIALIZABLE_RETRY
    );
  },

  /**
   * `POSTED -> CANCELLED` only — mirrors reversal (Voucher Engine) and
   * reversed stock (Inventory Engine, direction IN — NOT a SALES_RETURN,
   * since this undoes a mistaken posting rather than a customer return),
   * atomically. Gated on "approve" (not just "edit"): reversing a POSTED
   * invoice's real financial/stock entries is a stronger action than a
   * routine edit, mirroring Sales Order's own escalation for reversing a
   * CONFIRMED commitment.
   */
  async cancelSalesInvoice(id: string): Promise<SalesInvoiceDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");

    const existing = await salesInvoiceRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED" || !existing.voucherId) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    // The reversal voucher's own numbering must be reserved before this
    // transaction opens (voucherEngine.cancelVoucher's tx? contract).
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "SALES_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await salesInvoiceRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED" || !current.voucherId) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      await voucherEngine.cancelVoucher(user.companyId, current.voucherId, tx);

      const stockLines = current.items.map((item) => ({
        productId: item.productId,
        warehouseId: item.warehouseId,
        transactionType: "SALES" as const,
        direction: "IN" as const,
        quantity: item.quantity,
        transactionDate: toDateInputValue(current.invoiceDate),
        referenceType: "SALES_INVOICE",
        referenceId: current.id,
      }));
      await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

      const count = await salesInvoiceRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await salesInvoiceRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    });
  },
};
