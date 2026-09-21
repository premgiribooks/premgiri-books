import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getLedgerPaymentClassMap } from "@/lib/ledger-class";
import { assertPaymentModeMatchesLedger } from "@/lib/payment-mode-validation";
import { assertPermission } from "@/lib/permissions";
import { isRetryableTransactionError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import type { VoucherEntryLineInput } from "@/engines/voucher/voucher-validation";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { assertSalesLedgerMappingComplete, isSalesLedgerMappingComplete } from "@/modules/company/utils/sales-ledger-mapping";
import { paymentModeService } from "@/modules/payment-modes/services/payment-mode-service";
import {
  salesReturnRepository,
  type SalesInvoiceForReturn,
  type SalesInvoiceItemForReturn,
  type SalesReturnHeaderPersistData,
  type SalesReturnLinePersistData,
} from "@/modules/sales-returns/repositories/sales-return-repository";
import { prorateAmountPaise, sumSalesReturnHeaderTotals, toPaise } from "@/modules/sales-returns/utils/sales-return-calculations";
import {
  createSalesReturnSchema,
  toUtcDate,
  updateSalesReturnSchema,
  type CreateSalesReturnInput,
  type SalesReturnLineInput,
  type UpdateSalesReturnInput,
} from "@/modules/sales-returns/validation/sales-return-schema";
import type {
  ReturnableInvoiceDetail,
  ReturnableInvoiceOption,
  SalesReturnDetail,
  SalesReturnFormOptions,
  SalesReturnListFilters,
  SalesReturnListRow,
  SalesReturnTotals,
} from "@/types/sales-return";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;
type RefundMode = "LEDGER_ADJUSTMENT" | "CASH_REFUND";

const NOT_FOUND_MESSAGE = "Sales return not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with sales returns.";
const INVOICE_NOT_FOUND_MESSAGE = "Sales invoice not found.";
const INVOICE_NOT_POSTED_MESSAGE = "Only a posted sales invoice can be returned against.";
const LINE_NOT_FOUND_MESSAGE =
  "One or more lines reference an item that does not belong to the selected sales invoice.";
const RETURN_EXCEEDS_REMAINING_MESSAGE =
  "One or more lines exceed the remaining returnable quantity for that invoice line.";
const WAREHOUSE_NOT_FOUND_MESSAGE = "One or more warehouses were not found.";
const WAREHOUSE_INACTIVE_MESSAGE = "One or more warehouses are inactive and cannot receive a return.";
const CANNOT_CHANGE_MESSAGE =
  "This sales return can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This sales return can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted sales return can be cancelled.";
const REFUND_LEDGER_REQUIRED_MESSAGE = "Select a refund ledger for a cash refund.";
const REFUND_LEDGER_NOT_FOUND_MESSAGE = "Selected refund ledger not found.";
const REFUND_LEDGER_INACTIVE_MESSAGE = "Selected refund ledger is inactive and cannot be posted to.";
const REFUND_PAYMENT_MODE_REQUIRED_MESSAGE = "Select a payment mode for a cash refund.";
const WALK_IN_FORCED_CASH_REFUND_MESSAGE =
  "This return's source invoice has no customer ledger — refund mode must be Cash Refund.";
const RETURN_DATE_BEFORE_INVOICE_MESSAGE = "Return date cannot be before the invoice date.";
const ZERO_VALUE_MESSAGE = "A sales return cannot consist entirely of zero-value lines.";
const CUSTOMER_LEDGER_UNRESOLVED_MESSAGE = "The source invoice's customer ledger could not be resolved.";

const QUANTITY_TOLERANCE = 1e-6;

// Posting re-validates returnable quantity against sibling POSTED returns
// inside the same transaction (39-sales-return.md's Business Rules:
// "Concurrency safety, made explicit") — two concurrent posts against the
// same invoice line cannot both observe the same pre-posting returnable
// quantity and both succeed. Mirrors delivery-challan-service.ts's own
// SERIALIZABLE_RETRY, spec 32's SERIALIZABLE_RETRY convention.
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "This sales return's referenced data changed due to another request. Please try again.",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Unit-dependent, so enforced here (after the source invoice item's product/
// unit loads) rather than as a static Zod bound — mirrors
// sales-invoice-service.ts's identical helper.
function assertQuantityPrecision(quantity: number, decimalPlaces: number): void {
  const factor = 10 ** decimalPlaces;
  if (Math.abs(quantity * factor - Math.round(quantity * factor)) >= 1e-6) {
    throw new AppError(
      decimalPlaces === 0
        ? "Quantity must be a whole number — the returned product's unit has 0 decimal places."
        : `Quantity can have at most ${decimalPlaces} decimal places — the returned product's unit's limit.`
    );
  }
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

/**
 * Resolution order for a WALK_IN-sourced (or never-converted QUICK-sourced)
 * return: the schema's own default is a plain LEDGER_ADJUSTMENT fallback,
 * not aware of the source invoice's mode — when the invoice has no customer
 * ledger to credit, this forces CASH_REFUND regardless of the Prisma
 * default, but an EXPLICIT LEDGER_ADJUSTMENT submitted for such a return is
 * rejected outright, never silently overridden (39-sales-return.md's
 * Decisions). Generalized to "the invoice has no `customerId`" rather than
 * the literal WALK_IN enum value, since a QUICK invoice that was never
 * auto-converted at posting time (fully paid, no unpaid balance) carries the
 * exact same constraint — no ledger exists to carry a balance either way.
 */
function resolveRefundMode(requested: RefundMode | undefined, invoiceHasCustomerLedger: boolean): RefundMode {
  if (!invoiceHasCustomerLedger) {
    if (requested === "LEDGER_ADJUSTMENT") {
      throw new AppError(WALK_IN_FORCED_CASH_REFUND_MESSAGE);
    }
    return "CASH_REFUND";
  }
  return requested ?? "LEDGER_ADJUSTMENT";
}

function assertRefundLedgerProvided(refundMode: RefundMode, refundLedgerId: string | undefined): void {
  if (refundMode === "CASH_REFUND" && !refundLedgerId) {
    throw new AppError(REFUND_LEDGER_REQUIRED_MESSAGE);
  }
}

function assertRefundPaymentModeProvided(refundMode: RefundMode, paymentModeId: string | undefined): void {
  if (refundMode === "CASH_REFUND" && !paymentModeId) {
    throw new AppError(REFUND_PAYMENT_MODE_REQUIRED_MESSAGE);
  }
}

async function assertRefundLedgerActive(
  client: PrismaClientOrTransaction,
  companyId: string,
  refundLedgerId: string
): Promise<void> {
  const ledger = await salesReturnRepository.findRefundLedgerForReturn(client, companyId, refundLedgerId);
  if (!ledger) {
    throw new AppError(REFUND_LEDGER_NOT_FOUND_MESSAGE);
  }
  if (!ledger.isActive) {
    throw new AppError(REFUND_LEDGER_INACTIVE_MESSAGE);
  }
}

function assertPositiveGrandTotal(totals: SalesReturnTotals): void {
  if (toPaise(totals.grandTotal) <= 0) {
    throw new AppError(ZERO_VALUE_MESSAGE);
  }
}

/**
 * Derives one return line's persisted fields directly from the source
 * SalesInvoiceItem's per-unit rate/tax x returned quantity
 * (39-sales-return.md's Posting step 3) — no independent product/rate entry,
 * no re-derivation of supply type: `cgst`/`sgst`/`igst` are prorated
 * individually from whichever bucket the original invoice line actually
 * used (only one of {cgst,sgst} or {igst} is ever nonzero per line), so the
 * intra-/inter-state split is preserved without needing to know a document-
 * level supply type. Uses the invoice line's OVERRIDDEN tax values when it
 * was tax-overridden (spec 38's audit trail) instead of the computed ones.
 */
function buildReturnLine(
  invoiceItem: SalesInvoiceItemForReturn,
  quantity: number,
  warehouseId: string
): SalesReturnLinePersistData {
  const taxableAmountPaise = prorateAmountPaise(invoiceItem.taxableAmount, invoiceItem.quantity, quantity);
  const sourceTax = invoiceItem.isTaxOverridden
    ? {
        cgst: invoiceItem.overriddenCgst ?? 0,
        sgst: invoiceItem.overriddenSgst ?? 0,
        igst: invoiceItem.overriddenIgst ?? 0,
        cess: invoiceItem.overriddenCess ?? 0,
      }
    : { cgst: invoiceItem.cgst, sgst: invoiceItem.sgst, igst: invoiceItem.igst, cess: invoiceItem.cess };

  const cgstPaise = prorateAmountPaise(sourceTax.cgst, invoiceItem.quantity, quantity);
  const sgstPaise = prorateAmountPaise(sourceTax.sgst, invoiceItem.quantity, quantity);
  const igstPaise = prorateAmountPaise(sourceTax.igst, invoiceItem.quantity, quantity);
  const cessPaise = prorateAmountPaise(sourceTax.cess, invoiceItem.quantity, quantity);
  const totalAmountPaise = taxableAmountPaise + cgstPaise + sgstPaise + igstPaise + cessPaise;

  return {
    salesInvoiceItemId: invoiceItem.id,
    warehouseId,
    quantity,
    taxableAmount: taxableAmountPaise / 100,
    cgst: cgstPaise / 100,
    sgst: sgstPaise / 100,
    igst: igstPaise / 100,
    cess: cessPaise / 100,
    totalAmount: totalAmountPaise / 100,
  };
}

/** Validates every line against the source invoice (item ownership +
 * unit-precision + the returnable-quantity cap), against its own explicit
 * warehouse picker (exists, active — mirrors purchase-invoice-service.ts's
 * identical incoming-goods warehouse check), and builds its persisted
 * fields — shared by create/update/post, since DRAFT returns never
 * contribute to the returnable sum (see the repository's
 * sumPostedReturnedQuantities doc comment), so this computation is identical
 * whether called fresh or re-run at posting time. */
async function buildReturnLines(
  client: PrismaClientOrTransaction,
  invoice: SalesInvoiceForReturn,
  lineInputs: readonly SalesReturnLineInput[]
): Promise<SalesReturnLinePersistData[]> {
  const itemsById = new Map(invoice.items.map((item) => [item.id, item]));
  const invoiceItemIds = lineInputs.map((line) => line.salesInvoiceItemId);
  const returnedById = await salesReturnRepository.sumPostedReturnedQuantities(client, invoiceItemIds);

  const warehouseIds = [...new Set(lineInputs.map((line) => line.warehouseId))];
  const warehouses = await salesReturnRepository.findWarehousesForLines(client, invoice.companyId, warehouseIds);
  const warehousesById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

  return lineInputs.map((input) => {
    const item = itemsById.get(input.salesInvoiceItemId);
    if (!item) {
      throw new AppError(LINE_NOT_FOUND_MESSAGE);
    }
    assertQuantityPrecision(input.quantity, item.unitDecimalPlaces);

    const alreadyReturned = returnedById.get(item.id) ?? 0;
    const returnable = item.quantity - alreadyReturned;
    if (input.quantity > returnable + QUANTITY_TOLERANCE) {
      throw new AppError(RETURN_EXCEEDS_REMAINING_MESSAGE);
    }

    const warehouse = warehousesById.get(input.warehouseId);
    if (!warehouse) {
      throw new AppError(WAREHOUSE_NOT_FOUND_MESSAGE);
    }
    if (!warehouse.isActive) {
      throw new AppError(WAREHOUSE_INACTIVE_MESSAGE);
    }

    return buildReturnLine(item, input.quantity, input.warehouseId);
  });
}

function buildHeaderPersistData(
  salesInvoiceId: string,
  returnDate: Date,
  refundMode: RefundMode,
  refundLedgerId: string | null,
  paymentModeId: string | null,
  reason: string | null,
  totals: SalesReturnTotals
): SalesReturnHeaderPersistData {
  return {
    salesInvoiceId,
    returnDate,
    refundMode,
    refundLedgerId: refundMode === "CASH_REFUND" ? refundLedgerId : null,
    paymentModeId: refundMode === "CASH_REFUND" ? paymentModeId : null,
    reason,
    ...totals,
  };
}

interface ResolvedSalesReturnInput {
  invoice: SalesInvoiceForReturn;
  refundMode: RefundMode;
  lines: SalesReturnLinePersistData[];
  totals: SalesReturnTotals;
}

/**
 * The full create/update validation pipeline (39-sales-return.md's Business
 * Rules): the source invoice must be POSTED and company-owned, the return
 * date may not precede the invoice date, refund mode resolves per the
 * WALK_IN-forcing rule above (with its ledger re-verified active when
 * CASH_REFUND), every line is capped at its currently-remaining returnable
 * quantity, and the header can never total to zero.
 */
async function resolveSalesReturnInput(
  companyId: string,
  data: CreateSalesReturnInput
): Promise<ResolvedSalesReturnInput> {
  const invoice = await salesReturnRepository.findSalesInvoiceForReturn(prisma, companyId, data.salesInvoiceId);
  if (!invoice) {
    throw new AppError(INVOICE_NOT_FOUND_MESSAGE);
  }
  if (invoice.status !== "POSTED") {
    throw new AppError(INVOICE_NOT_POSTED_MESSAGE);
  }
  if (toUtcDate(data.returnDate).getTime() < invoice.invoiceDate.getTime()) {
    throw new AppError(RETURN_DATE_BEFORE_INVOICE_MESSAGE);
  }

  const refundMode = resolveRefundMode(data.refundMode, invoice.customerId !== null);
  assertRefundLedgerProvided(refundMode, data.refundLedgerId);
  assertRefundPaymentModeProvided(refundMode, data.paymentModeId);
  if (refundMode === "CASH_REFUND") {
    await assertRefundLedgerActive(prisma, companyId, data.refundLedgerId as string);
    await assertPaymentModeMatchesLedger(prisma, data.paymentModeId as string, data.refundLedgerId as string, companyId);
  }

  const lines = await buildReturnLines(prisma, invoice, data.lines);
  const totals = sumSalesReturnHeaderTotals(lines);
  assertPositiveGrandTotal(totals);

  return { invoice, refundMode, lines, totals };
}

interface VoucherEntriesInput {
  totals: SalesReturnTotals;
  settings: { salesLedgerId: string | null; outputCgstLedgerId: string | null; outputSgstLedgerId: string | null; outputIgstLedgerId: string | null; outputCessLedgerId: string | null };
  refundMode: RefundMode;
  refundLedgerId: string | null;
  customerLedgerId: string | null;
}

/** 39-sales-return.md's Ledger Posting section — Debit the sales/tax ledgers
 * for the returned amounts (reversing the invoice's own Credit side), Credit
 * the customer's ledger or the refund ledger for `grandTotal`. Balances by
 * construction (Sigma debits === grandTotal === the single credit entry). */
function buildVoucherEntries(input: VoucherEntriesInput): VoucherEntryLineInput[] {
  const entries: VoucherEntryLineInput[] = [];
  const { totals, settings } = input;

  if (totals.taxableAmount > 0) {
    entries.push({ ledgerId: settings.salesLedgerId as string, entryType: "DEBIT", amount: totals.taxableAmount });
  }
  if (totals.totalCgst > 0) {
    entries.push({ ledgerId: settings.outputCgstLedgerId as string, entryType: "DEBIT", amount: totals.totalCgst });
  }
  if (totals.totalSgst > 0) {
    entries.push({ ledgerId: settings.outputSgstLedgerId as string, entryType: "DEBIT", amount: totals.totalSgst });
  }
  if (totals.totalIgst > 0) {
    entries.push({ ledgerId: settings.outputIgstLedgerId as string, entryType: "DEBIT", amount: totals.totalIgst });
  }
  if (totals.totalCess > 0) {
    entries.push({ ledgerId: settings.outputCessLedgerId as string, entryType: "DEBIT", amount: totals.totalCess });
  }

  const creditLedgerId = input.refundMode === "CASH_REFUND" ? input.refundLedgerId : input.customerLedgerId;
  entries.push({ ledgerId: creditLedgerId as string, entryType: "CREDIT", amount: totals.grandTotal });

  return entries;
}

export const salesReturnService = {
  async listSalesReturns(filters: SalesReturnListFilters = {}): Promise<SalesReturnListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return salesReturnRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /**
   * The same read as `listSalesReturns`, gated on `reports`/`view` instead
   * of `sales`/`view` — 68-sales-reports.md's Sales Return Summary calls
   * this one, not `listSalesReturns`, so the seeded Accountant role
   * (`reports:view`, no `sales:view` — see `DEFAULT_ROLE_PERMISSIONS`) can
   * view it without also needing Sales module access. Mirrors
   * sales-invoice-service.ts's own `listSalesInvoicesForReport` precedent.
   * Still goes through this service (Invariant 5) — no new repository
   * method.
   */
  async listSalesReturnsForReport(filters: SalesReturnListFilters = {}): Promise<SalesReturnListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return salesReturnRepository.findMany(user.companyId, financialYear.id, filters);
  },

  async getSalesReturn(id: string): Promise<SalesReturnDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const salesReturn = await salesReturnRepository.findById(id);
    if (!salesReturn || salesReturn.companyId !== user.companyId) {
      return null;
    }
    return salesReturn;
  },

  async listSalesReturnFormOptions(): Promise<SalesReturnFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const [refundLedgers, ledgerClassById, paymentModes, settings, warehouses] = await Promise.all([
      salesReturnRepository.findSelectableRefundLedgers(user.companyId),
      getLedgerPaymentClassMap(user.companyId),
      paymentModeService.listActivePaymentModes(),
      companySettingsService.getSettings(user.companyId),
      salesReturnRepository.findSelectableWarehouses(user.companyId),
    ]);

    return {
      refundLedgers: refundLedgers.map((ledger) => ({ ...ledger, ledgerClass: ledgerClassById.get(ledger.id) ?? "NEITHER" })),
      paymentModes: paymentModes.map((mode) => ({ id: mode.id, name: mode.name, ledgerClass: mode.ledgerClass })),
      warehouses,
      isLedgerMappingComplete: isSalesLedgerMappingComplete(settings),
    };
  },

  /** The "New Sales Return" invoice picker's search results. */
  async listReturnableInvoices(search?: string): Promise<ReturnableInvoiceOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return salesReturnRepository.findPostedInvoicesForPicker(user.companyId, financialYear.id, search);
  },

  /** `getReturnableQuantities` (39-sales-return.md's Service/Repository
   * section) — the lookup the create form reads from once a POSTED invoice
   * is picked: every line's remaining returnable quantity, capped correctly
   * across prior POSTED returns. Returns null when the invoice doesn't
   * exist, isn't POSTED, or belongs to another company. */
  async getReturnableInvoice(salesInvoiceId: string): Promise<ReturnableInvoiceDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const invoice = await salesReturnRepository.findSalesInvoiceForReturn(prisma, user.companyId, salesInvoiceId);
    if (!invoice || invoice.status !== "POSTED") {
      return null;
    }

    const itemIds = invoice.items.map((item) => item.id);
    const returnedById = await salesReturnRepository.sumPostedReturnedQuantities(prisma, itemIds);

    return {
      salesInvoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      customerMode: invoice.customerMode as ReturnableInvoiceDetail["customerMode"],
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      lines: invoice.items.map((item) => {
        const returnedQuantity = returnedById.get(item.id) ?? 0;
        return {
          salesInvoiceItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          unitSymbol: item.unitSymbol,
          unitDecimalPlaces: item.unitDecimalPlaces,
          originalQuantity: item.quantity,
          returnedQuantity,
          returnableQuantity: Math.max(0, item.quantity - returnedQuantity),
        };
      }),
    };
  },

  async createDraft(input: CreateSalesReturnInput): Promise<SalesReturnDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const financialYear = await requireFinancialYear();
    const data = createSalesReturnSchema.parse(input);
    const resolved = await resolveSalesReturnInput(user.companyId, data);

    const header = buildHeaderPersistData(
      data.salesInvoiceId,
      toUtcDate(data.returnDate),
      resolved.refundMode,
      data.refundLedgerId ?? null,
      data.paymentModeId ?? null,
      data.reason ?? null,
      resolved.totals
    );

    return runInTransaction((tx) => salesReturnRepository.create(tx, user.companyId, financialYear.id, header, resolved.lines, user.id));
  },

  // Only reachable while DRAFT (39-sales-return.md: "Editable while
  // DRAFT") — checked before AND, atomically, inside the write transaction,
  // the sales-invoice-service.ts double-check pattern. Never generates
  // returnNumber (only postSalesReturn does).
  async updateDraft(id: string, input: UpdateSalesReturnInput): Promise<SalesReturnDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const existing = await salesReturnRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateSalesReturnSchema.parse(input);
    const resolved = await resolveSalesReturnInput(user.companyId, data);

    const header = buildHeaderPersistData(
      data.salesInvoiceId,
      toUtcDate(data.returnDate),
      resolved.refundMode,
      data.refundLedgerId ?? null,
      data.paymentModeId ?? null,
      data.reason ?? null,
      resolved.totals
    );

    const updated = await runInTransaction((tx) =>
      salesReturnRepository.replaceItemsAndUpdate(tx, id, user.companyId, ["DRAFT"], header, resolved.lines)
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * The orchestration this module exists for (39-sales-return.md's Posting
   * section): one Serializable transaction that re-validates every business
   * rule against CURRENT state, recomputes each line's taxable/tax amounts
   * fresh from the source invoice item (never trusting stale draft totals),
   * records the IN stock movement (Inventory Engine), posts the balanced
   * reversing voucher (Voucher Engine), and flips this return to POSTED —
   * atomically. Gated on "approve" unconditionally (not "create"): a return
   * decreases recognized revenue, treated as always requiring approval,
   * unlike Sales Invoice's below-cost-only escalation.
   */
  async postSalesReturn(id: string): Promise<SalesReturnDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");

    const existing = await salesReturnRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    // Both this return's own numbering AND the reversing voucher's own
    // numbering must be reserved before the transaction opens (the Document
    // Number Engine's / Voucher Engine's shared two-step contract).
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "SALES_RETURN");
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "SALES_RETURN_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await salesReturnRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_POST_MESSAGE);
      }

      const settings = await companySettingsService.getSettings(user.companyId);
      assertSalesLedgerMappingComplete(settings);

      // Step 1: re-verify the source invoice is still POSTED and company-owned.
      const invoice = await salesReturnRepository.findSalesInvoiceForReturn(tx, user.companyId, current.salesInvoiceId);
      if (!invoice) {
        throw new AppError(INVOICE_NOT_FOUND_MESSAGE);
      }
      if (invoice.status !== "POSTED") {
        throw new AppError(INVOICE_NOT_POSTED_MESSAGE);
      }

      // Re-verify the refund ledger is still active, and its payment mode
      // still matches, when CASH_REFUND.
      if (current.refundMode === "CASH_REFUND") {
        await assertRefundLedgerActive(tx, user.companyId, current.refundLedgerId as string);
        await assertPaymentModeMatchesLedger(tx, current.paymentModeId as string, current.refundLedgerId as string, user.companyId);
      }

      // Step 2 + 3: re-check line/header consistency and recompute fresh.
      const lineInputs: SalesReturnLineInput[] = current.items.map((item) => ({
        salesInvoiceItemId: item.salesInvoiceItem.id,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
      }));
      const lines = await buildReturnLines(tx, invoice, lineInputs);
      const totals = sumSalesReturnHeaderTotals(lines);
      assertPositiveGrandTotal(totals);

      // Step 4: generate returnNumber — the first time this row receives one.
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId: user.companyId,
        financialYearId: current.financialYearId,
        documentType: "SALES_RETURN",
      });

      // Step 5: stock-in, one IN/SALES_RETURN line per returned item — into
      // THIS return's own explicit warehouse (added per explicit user
      // request, 2026-09-20), not wherever the original sale drew from.
      const itemsById = new Map(invoice.items.map((item) => [item.id, item]));
      const stockLines = lines.map((line) => {
        const invoiceItem = itemsById.get(line.salesInvoiceItemId);
        if (!invoiceItem) {
          throw new AppError(LINE_NOT_FOUND_MESSAGE);
        }
        return {
          productId: invoiceItem.productId,
          warehouseId: line.warehouseId,
          transactionType: "SALES_RETURN" as const,
          direction: "IN" as const,
          quantity: line.quantity,
          transactionDate: toDateInputValue(current.returnDate),
          referenceType: "SALES_RETURN",
          referenceId: current.id,
        };
      });
      await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

      // Step 6: balanced reversing voucher.
      let customerLedgerId: string | null = null;
      if (current.refundMode === "LEDGER_ADJUSTMENT") {
        customerLedgerId = invoice.customerId
          ? await salesReturnRepository.findCustomerLedgerId(tx, user.companyId, invoice.customerId)
          : null;
        if (!customerLedgerId) {
          throw new AppError(CUSTOMER_LEDGER_UNRESOLVED_MESSAGE);
        }
      }

      const entries = buildVoucherEntries({
        totals,
        settings,
        refundMode: current.refundMode,
        refundLedgerId: current.refundLedgerId,
        customerLedgerId,
      });
      const voucher = await voucherEngine.postVoucher(
        user.companyId,
        {
          financialYearId: current.financialYearId,
          voucherType: "SALES_RETURN",
          voucherDate: toDateInputValue(current.returnDate),
          narration: current.reason ?? undefined,
          referenceType: "SALES_RETURN",
          referenceId: current.id,
          createdByUserId: user.id,
          entries,
        },
        tx
      );

      // Step 7: persist final totals, returnNumber, voucherId, POSTED status.
      const header = buildHeaderPersistData(
        current.salesInvoiceId,
        current.returnDate,
        current.refundMode,
        current.refundLedgerId,
        current.paymentModeId,
        current.reason,
        totals
      );
      const posted = await salesReturnRepository.replaceItemsAndPost(tx, id, user.companyId, header, lines, generated, voucher.id);
      if (!posted) {
        throw new AppError(CANNOT_POST_MESSAGE);
      }
      return posted;
    }, SERIALIZABLE_RETRY);
  },

  /**
   * `POSTED -> CANCELLED` only — mirrors reversal (Voucher Engine) and
   * reversed stock (Inventory Engine, direction OUT — undoing the earlier
   * IN), atomically, matching 38-sales-invoice.md's own cancellation shape.
   * Gated on "approve" for the same reason Sales Invoice's cancellation is.
   */
  async cancelSalesReturn(id: string): Promise<SalesReturnDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");

    const existing = await salesReturnRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED" || !existing.voucherId) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "SALES_RETURN_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await salesReturnRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED" || !current.voucherId) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      await voucherEngine.cancelVoucher(user.companyId, current.voucherId, tx);

      const stockLines = current.items.map((item) => ({
        productId: item.salesInvoiceItem.productId,
        warehouseId: item.warehouseId,
        transactionType: "SALES_RETURN" as const,
        direction: "OUT" as const,
        quantity: item.quantity,
        transactionDate: toDateInputValue(current.returnDate),
        referenceType: "SALES_RETURN",
        referenceId: current.id,
      }));
      await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

      const count = await salesReturnRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await salesReturnRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    });
  },
};
