import { Prisma, type CompanySettings } from "@prisma/client";

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
import { assertPurchaseLedgerMappingValid, isPurchaseLedgerMappingComplete } from "@/modules/company/utils/purchase-ledger-mapping";
import { CASH_IN_HAND_GROUP_NAME } from "@/modules/ledger-groups/constants/default-groups";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";
import { paymentModeService } from "@/modules/payment-modes/services/payment-mode-service";
import {
  purchaseReturnRepository,
  type PurchaseInvoiceForReturn,
  type PurchaseInvoiceItemForReturn,
  type PurchaseReturnHeaderPersistData,
  type PurchaseReturnLinePersistData,
} from "@/modules/purchase-returns/repositories/purchase-return-repository";
import { prorateAmountPaise, sumPurchaseReturnHeaderTotals, toPaise } from "@/modules/purchase-returns/utils/purchase-return-calculations";
import {
  createPurchaseReturnSchema,
  toUtcDate,
  updatePurchaseReturnSchema,
  type CreatePurchaseReturnInput,
  type PurchaseReturnLineInput,
  type UpdatePurchaseReturnInput,
} from "@/modules/purchase-returns/validation/purchase-return-schema";
import type {
  PurchaseReturnDetail,
  PurchaseReturnFormOptions,
  PurchaseReturnListFilters,
  PurchaseReturnListRow,
  PurchaseReturnTotals,
  ReturnablePurchaseInvoiceDetail,
  ReturnablePurchaseInvoiceOption,
} from "@/types/purchase-return";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;
type RefundMode = "LEDGER_ADJUSTMENT" | "CASH_REFUND";

const NOT_FOUND_MESSAGE = "Purchase return not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with purchase returns.";
const INVOICE_NOT_FOUND_MESSAGE = "Purchase invoice not found.";
const INVOICE_NOT_POSTED_MESSAGE = "Only a posted purchase invoice can be returned against.";
const LINE_NOT_FOUND_MESSAGE =
  "One or more lines reference an item that does not belong to the selected purchase invoice.";
const RETURN_EXCEEDS_REMAINING_MESSAGE =
  "One or more lines exceed the remaining returnable quantity for that invoice line.";
const CANNOT_CHANGE_MESSAGE =
  "This purchase return can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This purchase return can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted purchase return can be cancelled.";
const REFUND_LEDGER_REQUIRED_MESSAGE = "Select a refund ledger for a cash refund.";
const REFUND_PAYMENT_MODE_REQUIRED_MESSAGE = "Select a payment mode for a cash refund.";
const REFUND_LEDGER_NOT_FOUND_MESSAGE = "Selected refund ledger not found.";
const REFUND_LEDGER_INVALID_MESSAGE_SUFFIX =
  "is not a Cash-in-Hand or bank-linked ledger and cannot be used for refund.";
const RETURN_DATE_BEFORE_INVOICE_MESSAGE = "Return date cannot be before the invoice date.";
const ZERO_VALUE_MESSAGE = "A purchase return cannot consist entirely of zero-value lines.";
const SUPPLIER_LEDGER_UNRESOLVED_MESSAGE = "The source invoice's supplier ledger could not be resolved.";
const INVOICE_REASSIGNMENT_MESSAGE =
  "Cannot change the invoice a return is linked to — cancel this draft and create a new return against the other invoice instead.";

const QUANTITY_TOLERANCE = 1e-6;

// Posting re-validates returnable quantity against sibling POSTED returns
// inside the same transaction (45-purchase-return.md's Business Rules:
// "re-checked inside the posting transaction, the same race guard") — two
// concurrent posts against the same invoice line cannot both observe the
// same pre-posting returnable quantity and both succeed. Mirrors
// sales-return-service.ts's identical SERIALIZABLE_RETRY convention.
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "This purchase return's referenced data changed due to another request. Please try again.",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Unit-dependent, so enforced here (after the source invoice item's product/
// unit loads) rather than as a static Zod bound — mirrors
// purchase-invoice-service.ts's identical helper.
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
 * Unlike Sales Return's WALK_IN-forcing resolution, every Purchase Invoice
 * requires an existing, active Supplier (27-supplier-management.md) —
 * there is no "no ledger to credit" edge case on this side
 * (45-purchase-return.md's Data Model: "every Purchase Invoice references
 * an existing, active Supplier"). An omitted `refundMode` always defaults to
 * LEDGER_ADJUSTMENT.
 */
function resolveRefundMode(requested: RefundMode | undefined): RefundMode {
  return requested ?? "LEDGER_ADJUSTMENT";
}

function assertRefundLedgerProvided(refundMode: RefundMode, refundLedgerId: string | undefined): void {
  if (refundMode === "CASH_REFUND" && !refundLedgerId) {
    throw new AppError(REFUND_LEDGER_REQUIRED_MESSAGE);
  }
}

/** A payment mode is required whenever CASH_REFUND is explicitly chosen —
 * mirrors assertRefundLedgerProvided exactly (sales-return-service.ts's
 * identical helper). */
function assertRefundPaymentModeProvided(refundMode: RefundMode, paymentModeId: string | undefined): void {
  if (refundMode === "CASH_REFUND" && !paymentModeId) {
    throw new AppError(REFUND_PAYMENT_MODE_REQUIRED_MESSAGE);
  }
}

/**
 * Restricted, server-side, to an active, company-owned ledger that is
 * either under the seeded Cash-in-Hand ledger group or carries a
 * BankAccount detail row (45-purchase-return.md's Decisions: "like
 * 44-purchase-invoice.md's payment ledgers") — stricter than Sales Return's
 * own refund-ledger check (which only requires `isActive`), mirroring
 * purchase-invoice-service.ts's `assertPaymentLedgersValid` per-ledger logic
 * for a single ledger instead of an array. Kept local to this module rather
 * than sharing purchase-invoice-service.ts's private helper, to avoid
 * coupling this module's refund-ledger rule to that already-shipped,
 * independently-tested payment-validation code path.
 */
async function assertRefundLedgerValid(
  client: PrismaClientOrTransaction,
  companyId: string,
  refundLedgerId: string
): Promise<void> {
  const ledger = await purchaseReturnRepository.findRefundLedgerForReturn(client, companyId, refundLedgerId);
  if (!ledger || ledger.companyId !== companyId) {
    throw new AppError(REFUND_LEDGER_NOT_FOUND_MESSAGE);
  }
  if (!ledger.isActive) {
    throw new AppError(`Ledger "${ledger.name}" is inactive and cannot be used for refund.`);
  }
  const groups = await ledgerGroupRepository.findMany(companyId);
  const cashGroupIds = getGroupSubtreeIds(groups, [CASH_IN_HAND_GROUP_NAME]);
  const isCashInHand = cashGroupIds.has(ledger.ledgerGroupId);
  if (!isCashInHand && !ledger.hasBankAccount) {
    throw new AppError(`Ledger "${ledger.name}" ${REFUND_LEDGER_INVALID_MESSAGE_SUFFIX}`);
  }
}

function assertPositiveGrandTotal(totals: PurchaseReturnTotals): void {
  if (toPaise(totals.grandTotal) <= 0) {
    throw new AppError(ZERO_VALUE_MESSAGE);
  }
}

/**
 * Derives one return line's persisted fields directly from the source
 * PurchaseInvoiceItem's per-unit rate/tax x returned quantity
 * (45-purchase-return.md's Posting step) — no independent product/rate
 * entry, no re-derivation of supply type: `cgst`/`sgst`/`igst` are prorated
 * individually from whichever bucket the original invoice line actually
 * used (only one of {cgst,sgst} or {igst} is ever nonzero per line), so the
 * intra-/inter-state split is preserved without needing to know a
 * document-level supply type. Uses the invoice line's OVERRIDDEN tax values
 * when it was tax-overridden (spec 44's audit trail) instead of the
 * computed ones. Mirrors sales-return-service.ts's buildReturnLine exactly.
 */
function buildReturnLine(invoiceItem: PurchaseInvoiceItemForReturn, quantity: number): PurchaseReturnLinePersistData {
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
    purchaseInvoiceItemId: invoiceItem.id,
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
 * unit-precision + the returnable-quantity cap) and builds its persisted
 * fields — shared by create/update/post, since DRAFT returns never
 * contribute to the returnable sum (see the repository's
 * sumPostedReturnedQuantities doc comment), so this computation is identical
 * whether called fresh or re-run at posting time. */
async function buildReturnLines(
  client: PrismaClientOrTransaction,
  invoice: PurchaseInvoiceForReturn,
  lineInputs: readonly PurchaseReturnLineInput[]
): Promise<PurchaseReturnLinePersistData[]> {
  const itemsById = new Map(invoice.items.map((item) => [item.id, item]));
  const invoiceItemIds = lineInputs.map((line) => line.purchaseInvoiceItemId);
  const returnedById = await purchaseReturnRepository.sumPostedReturnedQuantities(client, invoiceItemIds);

  return lineInputs.map((input) => {
    const item = itemsById.get(input.purchaseInvoiceItemId);
    if (!item) {
      throw new AppError(LINE_NOT_FOUND_MESSAGE);
    }
    assertQuantityPrecision(input.quantity, item.unitDecimalPlaces);

    const alreadyReturned = returnedById.get(item.id) ?? 0;
    const returnable = item.quantity - alreadyReturned;
    if (input.quantity > returnable + QUANTITY_TOLERANCE) {
      throw new AppError(RETURN_EXCEEDS_REMAINING_MESSAGE);
    }

    return buildReturnLine(item, input.quantity);
  });
}

function buildHeaderPersistData(
  purchaseInvoiceId: string,
  returnDate: Date,
  refundMode: RefundMode,
  refundLedgerId: string | null,
  paymentModeId: string | null,
  reason: string | null,
  totals: PurchaseReturnTotals
): PurchaseReturnHeaderPersistData {
  return {
    purchaseInvoiceId,
    returnDate,
    refundMode,
    refundLedgerId: refundMode === "CASH_REFUND" ? refundLedgerId : null,
    paymentModeId: refundMode === "CASH_REFUND" ? paymentModeId : null,
    reason,
    ...totals,
  };
}

interface ResolvedPurchaseReturnInput {
  invoice: PurchaseInvoiceForReturn;
  refundMode: RefundMode;
  lines: PurchaseReturnLinePersistData[];
  totals: PurchaseReturnTotals;
}

/**
 * The full create/update validation pipeline (45-purchase-return.md's
 * Business Rules): the source invoice must be POSTED and company-owned, the
 * return date may not precede the invoice date, refund mode resolves to
 * LEDGER_ADJUSTMENT by default (with its ledger re-verified valid when
 * CASH_REFUND), every line is capped at its currently-remaining returnable
 * quantity, and the header can never total to zero.
 */
async function resolvePurchaseReturnInput(
  companyId: string,
  data: CreatePurchaseReturnInput
): Promise<ResolvedPurchaseReturnInput> {
  const invoice = await purchaseReturnRepository.findPurchaseInvoiceForReturn(prisma, companyId, data.purchaseInvoiceId);
  if (!invoice) {
    throw new AppError(INVOICE_NOT_FOUND_MESSAGE);
  }
  if (invoice.status !== "POSTED") {
    throw new AppError(INVOICE_NOT_POSTED_MESSAGE);
  }
  if (toUtcDate(data.returnDate).getTime() < invoice.invoiceDate.getTime()) {
    throw new AppError(RETURN_DATE_BEFORE_INVOICE_MESSAGE);
  }

  const refundMode = resolveRefundMode(data.refundMode);
  assertRefundLedgerProvided(refundMode, data.refundLedgerId);
  assertRefundPaymentModeProvided(refundMode, data.paymentModeId);
  if (refundMode === "CASH_REFUND") {
    await assertRefundLedgerValid(prisma, companyId, data.refundLedgerId as string);
    await assertPaymentModeMatchesLedger(prisma, data.paymentModeId as string, data.refundLedgerId as string, companyId);
  }

  const lines = await buildReturnLines(prisma, invoice, data.lines);
  const totals = sumPurchaseReturnHeaderTotals(lines);
  assertPositiveGrandTotal(totals);

  return { invoice, refundMode, lines, totals };
}

interface VoucherEntriesInput {
  totals: PurchaseReturnTotals;
  settings: CompanySettings;
  refundMode: RefundMode;
  refundLedgerId: string | null;
  supplierLedgerId: string | null;
}

/** 45-purchase-return.md's Ledger Posting section — Credit the purchase/tax
 * ledgers for the returned amounts (reversing the invoice's own Debit side),
 * Debit the supplier's ledger or the refund ledger for `grandTotal`.
 * Balances by construction (Sigma credits === grandTotal === the single
 * debit entry). Mirrors sales-return-service.ts's buildVoucherEntries with
 * the direction reversed. */
function buildVoucherEntries(input: VoucherEntriesInput): VoucherEntryLineInput[] {
  const entries: VoucherEntryLineInput[] = [];
  const { totals, settings } = input;

  if (totals.taxableAmount > 0) {
    entries.push({ ledgerId: settings.purchaseLedgerId as string, entryType: "CREDIT", amount: totals.taxableAmount });
  }
  if (totals.totalCgst > 0) {
    entries.push({ ledgerId: settings.inputCgstLedgerId as string, entryType: "CREDIT", amount: totals.totalCgst });
  }
  if (totals.totalSgst > 0) {
    entries.push({ ledgerId: settings.inputSgstLedgerId as string, entryType: "CREDIT", amount: totals.totalSgst });
  }
  if (totals.totalIgst > 0) {
    entries.push({ ledgerId: settings.inputIgstLedgerId as string, entryType: "CREDIT", amount: totals.totalIgst });
  }
  if (totals.totalCess > 0) {
    entries.push({ ledgerId: settings.inputCessLedgerId as string, entryType: "CREDIT", amount: totals.totalCess });
  }

  const debitLedgerId = input.refundMode === "CASH_REFUND" ? input.refundLedgerId : input.supplierLedgerId;
  entries.push({ ledgerId: debitLedgerId as string, entryType: "DEBIT", amount: totals.grandTotal });

  return entries;
}

export const purchaseReturnService = {
  async listPurchaseReturns(filters: PurchaseReturnListFilters = {}): Promise<PurchaseReturnListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return purchaseReturnRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /**
   * The same read as `listPurchaseReturns`, gated on `reports`/`view`
   * instead of `purchase`/`view` — 69-purchase-reports.md's Purchase Return
   * Summary calls this one, mirroring sales-return-service.ts's own
   * `listSalesReturnsForReport` precedent. Still goes through this service
   * (Invariant 5) — no new repository method.
   */
  async listPurchaseReturnsForReport(filters: PurchaseReturnListFilters = {}): Promise<PurchaseReturnListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return purchaseReturnRepository.findMany(user.companyId, financialYear.id, filters);
  },

  async getPurchaseReturn(id: string): Promise<PurchaseReturnDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const purchaseReturn = await purchaseReturnRepository.findById(id);
    if (!purchaseReturn || purchaseReturn.companyId !== user.companyId) {
      return null;
    }
    return purchaseReturn;
  },

  async listPurchaseReturnFormOptions(): Promise<PurchaseReturnFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const [refundLedgers, ledgerClassById, paymentModes, settings] = await Promise.all([
      purchaseReturnRepository.findSelectableRefundLedgers(user.companyId),
      getLedgerPaymentClassMap(user.companyId),
      paymentModeService.listActivePaymentModes(),
      companySettingsService.getSettings(user.companyId),
    ]);

    return {
      refundLedgers: refundLedgers.map((ledger) => ({ ...ledger, ledgerClass: ledgerClassById.get(ledger.id) ?? "NEITHER" })),
      paymentModes: paymentModes.map((mode) => ({ id: mode.id, name: mode.name, ledgerClass: mode.ledgerClass })),
      isLedgerMappingComplete: isPurchaseLedgerMappingComplete(settings),
    };
  },

  /** The "New Purchase Return" invoice picker's search results. */
  async listReturnableInvoices(search?: string): Promise<ReturnablePurchaseInvoiceOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return purchaseReturnRepository.findPostedInvoicesForPicker(user.companyId, financialYear.id, search);
  },

  /** `getReturnableQuantities` (45-purchase-return.md's Service/Repository
   * section) — the lookup the create form reads from once a POSTED invoice
   * is picked: every line's remaining returnable quantity, capped correctly
   * across prior POSTED returns. Returns null when the invoice doesn't
   * exist, isn't POSTED, or belongs to another company. */
  async getReturnableInvoice(purchaseInvoiceId: string): Promise<ReturnablePurchaseInvoiceDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const invoice = await purchaseReturnRepository.findPurchaseInvoiceForReturn(prisma, user.companyId, purchaseInvoiceId);
    if (!invoice || invoice.status !== "POSTED") {
      return null;
    }

    const itemIds = invoice.items.map((item) => item.id);
    const returnedById = await purchaseReturnRepository.sumPostedReturnedQuantities(prisma, itemIds);

    return {
      purchaseInvoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplierName,
      lines: invoice.items.map((item) => {
        const returnedQuantity = returnedById.get(item.id) ?? 0;
        return {
          purchaseInvoiceItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouseName,
          unitSymbol: item.unitSymbol,
          unitDecimalPlaces: item.unitDecimalPlaces,
          originalQuantity: item.quantity,
          returnedQuantity,
          returnableQuantity: Math.max(0, item.quantity - returnedQuantity),
        };
      }),
    };
  },

  async createDraft(input: CreatePurchaseReturnInput): Promise<PurchaseReturnDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "create");

    const financialYear = await requireFinancialYear();
    const data = createPurchaseReturnSchema.parse(input);
    const resolved = await resolvePurchaseReturnInput(user.companyId, data);

    const header = buildHeaderPersistData(
      data.purchaseInvoiceId,
      toUtcDate(data.returnDate),
      resolved.refundMode,
      data.refundLedgerId ?? null,
      data.paymentModeId ?? null,
      data.reason ?? null,
      resolved.totals
    );

    return runInTransaction((tx) =>
      purchaseReturnRepository.create(tx, user.companyId, financialYear.id, header, resolved.lines, user.id)
    );
  },

  // Only reachable while DRAFT (45-purchase-return.md: "Editable while
  // DRAFT") — checked before AND, atomically, inside the write transaction,
  // the purchase-invoice-service.ts double-check pattern. Never generates
  // returnNumber (only postPurchaseReturn does).
  async updateDraft(id: string, input: UpdatePurchaseReturnInput): Promise<PurchaseReturnDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    const existing = await purchaseReturnRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updatePurchaseReturnSchema.parse(input);
    if (data.purchaseInvoiceId !== existing.purchaseInvoiceId) {
      throw new AppError(INVOICE_REASSIGNMENT_MESSAGE);
    }
    const resolved = await resolvePurchaseReturnInput(user.companyId, data);

    const header = buildHeaderPersistData(
      data.purchaseInvoiceId,
      toUtcDate(data.returnDate),
      resolved.refundMode,
      data.refundLedgerId ?? null,
      data.paymentModeId ?? null,
      data.reason ?? null,
      resolved.totals
    );

    const updated = await runInTransaction((tx) =>
      purchaseReturnRepository.replaceItemsAndUpdate(tx, id, user.companyId, ["DRAFT"], header, resolved.lines)
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * The orchestration this module exists for (45-purchase-return.md's
   * Posting section): one Serializable transaction that re-validates every
   * business rule against CURRENT state, recomputes each line's
   * taxable/tax amounts fresh from the source invoice item (never trusting
   * stale draft totals), records the OUT stock movement (Inventory Engine —
   * goods leaving our warehouse back to the supplier, the reversed
   * direction from Sales Return's IN), posts the balanced reversing voucher
   * (Voucher Engine), and flips this return to POSTED — atomically. Gated
   * on "approve" unconditionally, mirroring Sales Return's Post gate.
   */
  async postPurchaseReturn(id: string): Promise<PurchaseReturnDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "approve");

    const existing = await purchaseReturnRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    // Both this return's own numbering AND the reversing voucher's own
    // numbering must be reserved before the transaction opens (the Document
    // Number Engine's / Voucher Engine's shared two-step contract).
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_RETURN");
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_RETURN_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await purchaseReturnRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_POST_MESSAGE);
      }

      const settingsOrNull = await companySettingsService.getSettings(user.companyId);
      // All six mappings (five new + the shared Round Off) validated
      // unconditionally, reusing spec 44's Option-B matrix rather than
      // re-deriving it (45-purchase-return.md's Code Standards). The cast
      // below is required because assertion functions cannot be `async` in
      // TypeScript — mirrors purchase-invoice-service.ts's identical cast
      // immediately after this same shared assertion call.
      await assertPurchaseLedgerMappingValid(tx, user.companyId, settingsOrNull);
      const settings = settingsOrNull as CompanySettings;

      // Step 1: re-verify the source invoice is still POSTED and company-owned.
      const invoice = await purchaseReturnRepository.findPurchaseInvoiceForReturn(tx, user.companyId, current.purchaseInvoiceId);
      if (!invoice) {
        throw new AppError(INVOICE_NOT_FOUND_MESSAGE);
      }
      if (invoice.status !== "POSTED") {
        throw new AppError(INVOICE_NOT_POSTED_MESSAGE);
      }

      // Re-verify the refund ledger is still valid, and its payment mode
      // still matches, when CASH_REFUND.
      if (current.refundMode === "CASH_REFUND") {
        await assertRefundLedgerValid(tx, user.companyId, current.refundLedgerId as string);
        await assertPaymentModeMatchesLedger(tx, current.paymentModeId as string, current.refundLedgerId as string, user.companyId);
      }

      // Step 2 + 3: re-check line/header consistency and recompute fresh.
      const lineInputs: PurchaseReturnLineInput[] = current.items.map((item) => ({
        purchaseInvoiceItemId: item.purchaseInvoiceItem.id,
        quantity: item.quantity,
      }));
      const lines = await buildReturnLines(tx, invoice, lineInputs);
      const totals = sumPurchaseReturnHeaderTotals(lines);
      assertPositiveGrandTotal(totals);

      // Step 4: generate returnNumber — the first time this row receives one.
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId: user.companyId,
        financialYearId: current.financialYearId,
        documentType: "PURCHASE_RETURN",
      });

      // Step 5: stock-out, one OUT/PURCHASE_RETURN line per returned item —
      // goods physically leave our warehouse back to the supplier.
      const itemsById = new Map(invoice.items.map((item) => [item.id, item]));
      const stockLines = lines.map((line) => {
        const invoiceItem = itemsById.get(line.purchaseInvoiceItemId);
        if (!invoiceItem) {
          throw new AppError(LINE_NOT_FOUND_MESSAGE);
        }
        return {
          productId: invoiceItem.productId,
          warehouseId: invoiceItem.warehouseId,
          transactionType: "PURCHASE_RETURN" as const,
          direction: "OUT" as const,
          quantity: line.quantity,
          transactionDate: toDateInputValue(current.returnDate),
          referenceType: "PURCHASE_RETURN",
          referenceId: current.id,
        };
      });
      await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

      // Step 6: balanced reversing voucher.
      let supplierLedgerId: string | null = null;
      if (current.refundMode === "LEDGER_ADJUSTMENT") {
        supplierLedgerId = await purchaseReturnRepository.findSupplierLedgerId(tx, user.companyId, invoice.supplierId);
        if (!supplierLedgerId) {
          throw new AppError(SUPPLIER_LEDGER_UNRESOLVED_MESSAGE);
        }
      }

      const entries = buildVoucherEntries({
        totals,
        settings,
        refundMode: current.refundMode,
        refundLedgerId: current.refundLedgerId,
        supplierLedgerId,
      });
      const voucher = await voucherEngine.postVoucher(
        user.companyId,
        {
          financialYearId: current.financialYearId,
          voucherType: "PURCHASE_RETURN",
          voucherDate: toDateInputValue(current.returnDate),
          narration: current.reason ?? undefined,
          referenceType: "PURCHASE_RETURN",
          referenceId: current.id,
          createdByUserId: user.id,
          entries,
        },
        tx
      );

      // Step 7: persist final totals, returnNumber, voucherId, POSTED status.
      const header = buildHeaderPersistData(
        current.purchaseInvoiceId,
        current.returnDate,
        current.refundMode,
        current.refundLedgerId,
        current.paymentModeId,
        current.reason,
        totals
      );
      const posted = await purchaseReturnRepository.replaceItemsAndPost(tx, id, user.companyId, header, lines, generated, voucher.id);
      if (!posted) {
        throw new AppError(CANNOT_POST_MESSAGE);
      }
      return posted;
    }, SERIALIZABLE_RETRY);
  },

  /**
   * `POSTED -> CANCELLED` only — mirrors reversal (Voucher Engine) and
   * reversed stock (Inventory Engine, direction IN — undoing the earlier
   * OUT), atomically, matching purchase-invoice-service.ts's own
   * cancellation shape. Gated on "approve" for the same reason Purchase
   * Invoice's cancellation is.
   */
  async cancelPurchaseReturn(id: string): Promise<PurchaseReturnDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "approve");

    const existing = await purchaseReturnRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED" || !existing.voucherId) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_RETURN_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await purchaseReturnRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED" || !current.voucherId) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      await voucherEngine.cancelVoucher(user.companyId, current.voucherId, tx);

      const stockLines = current.items.map((item) => ({
        productId: item.purchaseInvoiceItem.productId,
        warehouseId: item.purchaseInvoiceItem.warehouseId,
        transactionType: "PURCHASE_RETURN" as const,
        direction: "IN" as const,
        quantity: item.quantity,
        transactionDate: toDateInputValue(current.returnDate),
        referenceType: "PURCHASE_RETURN",
        referenceId: current.id,
      }));
      await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

      const count = await purchaseReturnRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await purchaseReturnRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    });
  },
};
