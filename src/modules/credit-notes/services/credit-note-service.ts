import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getLedgerPaymentClassMap } from "@/lib/ledger-class";
import type { Page, PageParams } from "@/lib/pagination";
import { assertPaymentModeMatchesLedger } from "@/lib/payment-mode-validation";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { gstEngine } from "@/engines/gst/gst-engine";
import type { SupplyType } from "@/engines/gst/types";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import type { VoucherEntryLineInput } from "@/engines/voucher/voucher-validation";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { assertSalesLedgerMappingComplete, isSalesLedgerMappingComplete } from "@/modules/company/utils/sales-ledger-mapping";
import { customerService } from "@/modules/customers/services/customer-service";
import { paymentModeService } from "@/modules/payment-modes/services/payment-mode-service";
import {
  creditNoteRepository,
  type CreditNoteHeaderPersistData,
  type CreditNoteLinePersistData,
  type SalesInvoiceForCreditNote,
} from "@/modules/credit-notes/repositories/credit-note-repository";
import { sumCreditNoteHeaderTotals } from "@/modules/credit-notes/utils/credit-note-calculations";
import {
  createCreditNoteSchema,
  toUtcDate,
  updateCreditNoteSchema,
  type CreateCreditNoteInput,
  type CreditNoteLineInput,
  type UpdateCreditNoteInput,
} from "@/modules/credit-notes/validation/credit-note-schema";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import type {
  CreditNoteDetail,
  CreditNoteFormOptions,
  CreditNoteInvoiceOption,
  CreditNoteListFilters,
  CreditNoteListRow,
  CreditNoteTotals,
} from "@/types/credit-note";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;
type RefundMode = "LEDGER_ADJUSTMENT" | "CASH_REFUND";

const NOT_FOUND_MESSAGE = "Credit note not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with credit notes.";
const NO_COMPANY_STATE_MESSAGE = "Set your company's GST state before creating a credit note (Company > Edit Profile).";
const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found.";
const CUSTOMER_INACTIVE_MESSAGE = "Selected customer is inactive.";
const INVOICE_NOT_FOUND_MESSAGE = "Sales invoice not found.";
const INVOICE_NOT_POSTED_MESSAGE = "Only a posted sales invoice can be linked to a credit note.";
const INVOICE_WALK_IN_MESSAGE =
  "This invoice has no customer to link a credit note's customer to — use Cash Refund on a Sales Return instead.";
const INVOICE_CUSTOMER_MISMATCH_MESSAGE = "The linked sales invoice's customer does not match this credit note's customer.";
const CANNOT_CHANGE_MESSAGE =
  "This credit note can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This credit note can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted credit note can be cancelled.";
const REFUND_LEDGER_REQUIRED_MESSAGE = "Select a refund ledger for a cash refund.";
const REFUND_LEDGER_NOT_FOUND_MESSAGE = "Selected refund ledger not found.";
const REFUND_LEDGER_INACTIVE_MESSAGE = "Selected refund ledger is inactive and cannot be posted to.";
const REFUND_PAYMENT_MODE_REQUIRED_MESSAGE = "Select a payment mode for a cash refund.";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

async function resolveSupplyType(companyId: string, placeOfSupplyStateCode: string): Promise<SupplyType> {
  const companyStateCode = await creditNoteRepository.findCompanyStateCode(companyId);
  if (!companyStateCode) {
    throw new AppError(NO_COMPANY_STATE_MESSAGE);
  }
  return gstEngine.determineSupplyType(companyStateCode, placeOfSupplyStateCode);
}

async function verifyCustomer(
  client: PrismaClientOrTransaction,
  companyId: string,
  customerId: string
): Promise<{ id: string; ledgerId: string; name: string }> {
  const customer = await creditNoteRepository.findCustomerForCreditNote(client, companyId, customerId);
  if (!customer) {
    throw new AppError(CUSTOMER_NOT_FOUND_MESSAGE);
  }
  if (!customer.isActive) {
    throw new AppError(CUSTOMER_INACTIVE_MESSAGE);
  }
  return customer;
}

/**
 * Validates an (optional) linked Sales Invoice against CURRENT state
 * (40-credit-note.md's Business Rules, step 1): must exist, belong to this
 * company, be POSTED, carry a real customer (never WALK_IN), and match this
 * credit note's own `customerId`. Re-run both at draft-creation/update time
 * AND re-checked fresh at posting time.
 */
async function resolveInvoiceLink(
  client: PrismaClientOrTransaction,
  companyId: string,
  customerId: string,
  salesInvoiceId: string | undefined
): Promise<SalesInvoiceForCreditNote | null> {
  if (!salesInvoiceId) {
    return null;
  }
  const invoice = await creditNoteRepository.findSalesInvoiceForCreditNote(client, companyId, salesInvoiceId);
  if (!invoice) {
    throw new AppError(INVOICE_NOT_FOUND_MESSAGE);
  }
  if (invoice.status !== "POSTED") {
    throw new AppError(INVOICE_NOT_POSTED_MESSAGE);
  }
  if (invoice.customerMode === "WALK_IN" || !invoice.customerId) {
    throw new AppError(INVOICE_WALK_IN_MESSAGE);
  }
  if (invoice.customerId !== customerId) {
    throw new AppError(INVOICE_CUSTOMER_MISMATCH_MESSAGE);
  }
  return invoice;
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
  const ledger = await creditNoteRepository.findRefundLedgerForCreditNote(client, companyId, refundLedgerId);
  if (!ledger) {
    throw new AppError(REFUND_LEDGER_NOT_FOUND_MESSAGE);
  }
  if (!ledger.isActive) {
    throw new AppError(REFUND_LEDGER_INACTIVE_MESSAGE);
  }
}

/** Builds one line's persisted fields via the GST Engine — a Credit Note
 * line's `taxableAmount` is entered directly (not derived from qty x rate),
 * so `calculateLine` always runs with `isInclusive: false` (40-credit-note.md's
 * Posting step 2). */
function buildCreditNoteLine(input: CreditNoteLineInput, supplyType: SupplyType): CreditNoteLinePersistData {
  const result = gstEngine.calculateLine({
    amount: input.taxableAmount,
    isInclusive: false,
    ratePercent: input.ratePercent,
    cessPercent: input.cessPercent ?? 0,
    supplyType,
    isReverseCharge: false,
  });

  return {
    description: input.description,
    taxableAmount: result.taxableAmount,
    ratePercent: input.ratePercent,
    cessPercent: input.cessPercent ?? 0,
    cgst: result.cgst,
    sgst: result.sgst,
    igst: result.igst,
    cess: result.cess,
    totalAmount: result.totalAmount,
  };
}

function buildCreditNoteLines(lines: readonly CreditNoteLineInput[], supplyType: SupplyType): CreditNoteLinePersistData[] {
  return lines.map((line) => buildCreditNoteLine(line, supplyType));
}

interface CreditNoteHeaderFields {
  customerId: string;
  salesInvoiceId: string | null;
  noteDate: Date;
  placeOfSupplyStateCode: string;
  reason: string;
}

function buildHeaderPersistData(
  fields: CreditNoteHeaderFields,
  refundMode: RefundMode,
  refundLedgerId: string | null,
  paymentModeId: string | null,
  totals: CreditNoteTotals
): CreditNoteHeaderPersistData {
  return {
    customerId: fields.customerId,
    salesInvoiceId: fields.salesInvoiceId,
    noteDate: fields.noteDate,
    placeOfSupplyStateCode: fields.placeOfSupplyStateCode,
    refundMode,
    refundLedgerId: refundMode === "CASH_REFUND" ? refundLedgerId : null,
    paymentModeId: refundMode === "CASH_REFUND" ? paymentModeId : null,
    reason: fields.reason,
    ...totals,
  };
}

interface ResolvedCreditNoteInput {
  refundMode: RefundMode;
  lines: CreditNoteLinePersistData[];
  totals: CreditNoteTotals;
}

/**
 * The full create/update validation pipeline (40-credit-note.md's Business
 * Rules): the customer must exist and be active, an optional linked invoice
 * must be POSTED/non-WALK_IN/customer-matched, every line's tax is computed
 * fresh via the GST Engine from this note's own place of supply, and a cash
 * refund's ledger must be active.
 */
async function resolveCreditNoteInput(
  client: PrismaClientOrTransaction,
  companyId: string,
  data: CreateCreditNoteInput
): Promise<ResolvedCreditNoteInput> {
  await verifyCustomer(client, companyId, data.customerId);
  await resolveInvoiceLink(client, companyId, data.customerId, data.salesInvoiceId);

  const refundMode: RefundMode = data.refundMode ?? "LEDGER_ADJUSTMENT";
  assertRefundLedgerProvided(refundMode, data.refundLedgerId);
  assertRefundPaymentModeProvided(refundMode, data.paymentModeId);
  if (refundMode === "CASH_REFUND") {
    await assertRefundLedgerActive(client, companyId, data.refundLedgerId as string);
    await assertPaymentModeMatchesLedger(client, data.paymentModeId as string, data.refundLedgerId as string, companyId);
  }

  const supplyType = await resolveSupplyType(companyId, data.placeOfSupplyStateCode);
  const lines = buildCreditNoteLines(data.lines, supplyType);
  const totals = sumCreditNoteHeaderTotals(lines);

  return { refundMode, lines, totals };
}

interface VoucherEntriesInput {
  totals: CreditNoteTotals;
  settings: {
    salesLedgerId: string | null;
    outputCgstLedgerId: string | null;
    outputSgstLedgerId: string | null;
    outputIgstLedgerId: string | null;
    outputCessLedgerId: string | null;
  };
  refundMode: RefundMode;
  refundLedgerId: string | null;
  customerLedgerId: string | null;
}

/** 40-credit-note.md's Ledger Posting section — Debit the sales/tax ledgers
 * for the adjustment amounts, Credit the customer's ledger or the refund
 * ledger for `grandTotal`. Balances by construction. */
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

export const creditNoteService = {
  async listCreditNotes(filters: CreditNoteListFilters = {}): Promise<CreditNoteListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return creditNoteRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /** Infinite-scroll page for the Credit Notes list page. */
  async listCreditNotesPage(filters: CreditNoteListFilters, page: PageParams): Promise<Page<CreditNoteListRow>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return { items: [], hasMore: false };
    }
    return creditNoteRepository.findManyPage(user.companyId, financialYear.id, filters, page);
  },

  async getCreditNote(id: string): Promise<CreditNoteDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const creditNote = await creditNoteRepository.findById(id);
    if (!creditNote || creditNote.companyId !== user.companyId) {
      return null;
    }
    return creditNote;
  },

  async listCreditNoteFormOptions(): Promise<CreditNoteFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();

    const [customers, invoices, refundLedgers, ledgerClassById, paymentModes, gstRates, settings] = await Promise.all([
      customerService.listSelectableCustomers(),
      financialYear ? creditNoteRepository.findPostedInvoicesForPicker(user.companyId, financialYear.id) : Promise.resolve<CreditNoteInvoiceOption[]>([]),
      creditNoteRepository.findSelectableRefundLedgers(user.companyId),
      getLedgerPaymentClassMap(user.companyId),
      paymentModeService.listActivePaymentModes(),
      gstRateService.listSelectableGstRates(),
      companySettingsService.getSettings(user.companyId),
    ]);

    return {
      customers: customers.map((customer) => ({ id: customer.id, name: customer.ledger.name })),
      invoices,
      refundLedgers: refundLedgers.map((ledger) => ({ ...ledger, ledgerClass: ledgerClassById.get(ledger.id) ?? "NEITHER" })),
      paymentModes: paymentModes.map((mode) => ({ id: mode.id, name: mode.name, ledgerClass: mode.ledgerClass })),
      gstRates: gstRates.map((rate) => ({ id: rate.id, name: rate.name, ratePercent: rate.ratePercent, cessPercent: rate.cessPercent })),
      isLedgerMappingComplete: isSalesLedgerMappingComplete(settings),
    };
  },

  async createDraft(input: CreateCreditNoteInput): Promise<CreditNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const financialYear = await requireFinancialYear();
    const data = createCreditNoteSchema.parse(input);
    const resolved = await resolveCreditNoteInput(prisma, user.companyId, data);
    const header = buildHeaderPersistData(
      {
        customerId: data.customerId,
        salesInvoiceId: data.salesInvoiceId ?? null,
        noteDate: toUtcDate(data.noteDate),
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        reason: data.reason,
      },
      resolved.refundMode,
      data.refundLedgerId ?? null,
      data.paymentModeId ?? null,
      resolved.totals
    );

    return runInTransaction((tx) => creditNoteRepository.create(tx, user.companyId, financialYear.id, header, resolved.lines, user.id));
  },

  // Only reachable while DRAFT (40-credit-note.md: "Editable while DRAFT")
  // — checked before AND, atomically, inside the write transaction. Never
  // generates noteNumber (only postCreditNote does).
  async updateDraft(id: string, input: UpdateCreditNoteInput): Promise<CreditNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const existing = await creditNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateCreditNoteSchema.parse(input);
    const resolved = await resolveCreditNoteInput(prisma, user.companyId, data);
    const header = buildHeaderPersistData(
      {
        customerId: data.customerId,
        salesInvoiceId: data.salesInvoiceId ?? null,
        noteDate: toUtcDate(data.noteDate),
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        reason: data.reason,
      },
      resolved.refundMode,
      data.refundLedgerId ?? null,
      data.paymentModeId ?? null,
      resolved.totals
    );

    const updated = await runInTransaction((tx) =>
      creditNoteRepository.replaceItemsAndUpdate(tx, id, user.companyId, ["DRAFT"], header, resolved.lines)
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * The orchestration this module exists for (40-credit-note.md's Posting
   * section): one transaction that re-validates every business rule against
   * CURRENT state, recomputes each line's tax fresh via the GST Engine,
   * posts the balanced voucher (Voucher Engine), and flips this note to
   * POSTED — atomically. **No Inventory Engine call ever** (a Credit Note
   * never moves stock).
   */
  async postCreditNote(id: string): Promise<CreditNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");

    const existing = await creditNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "CREDIT_NOTE");
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "CREDIT_NOTE_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await creditNoteRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_POST_MESSAGE);
      }

      const settings = await companySettingsService.getSettings(user.companyId);
      assertSalesLedgerMappingComplete(settings);

      const customer = await verifyCustomer(tx, user.companyId, current.customerId);

      // Step 1: re-verify the (optional) linked invoice against CURRENT state.
      await resolveInvoiceLink(tx, user.companyId, current.customerId, current.salesInvoiceId ?? undefined);

      if (current.refundMode === "CASH_REFUND") {
        await assertRefundLedgerActive(tx, user.companyId, current.refundLedgerId as string);
        await assertPaymentModeMatchesLedger(tx, current.paymentModeId as string, current.refundLedgerId as string, user.companyId);
      }

      // Step 2: recompute every line's tax fresh via the GST Engine.
      const supplyType = await resolveSupplyType(user.companyId, current.placeOfSupplyStateCode);
      const lineInputs: CreditNoteLineInput[] = current.items.map((item) => ({
        description: item.description,
        taxableAmount: item.taxableAmount,
        ratePercent: item.ratePercent,
        cessPercent: item.cessPercent,
      }));
      const lines = buildCreditNoteLines(lineInputs, supplyType);
      const totals = sumCreditNoteHeaderTotals(lines);

      // Step 3: generate noteNumber — the first time this row receives one.
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId: user.companyId,
        financialYearId: current.financialYearId,
        documentType: "CREDIT_NOTE",
      });

      // Step 4: balanced voucher. No Inventory Engine call.
      const creditLedgerId = current.refundMode === "LEDGER_ADJUSTMENT" ? customer.ledgerId : null;
      const entries = buildVoucherEntries({
        totals,
        settings,
        refundMode: current.refundMode,
        refundLedgerId: current.refundLedgerId,
        customerLedgerId: creditLedgerId,
      });
      const voucher = await voucherEngine.postVoucher(
        user.companyId,
        {
          financialYearId: current.financialYearId,
          voucherType: "CREDIT_NOTE",
          voucherDate: toDateInputValue(current.noteDate),
          narration: current.reason,
          referenceType: "CREDIT_NOTE",
          referenceId: current.id,
          createdByUserId: user.id,
          entries,
        },
        tx
      );

      // Step 5: persist final totals, noteNumber, voucherId, POSTED status.
      const header = buildHeaderPersistData(
        {
          customerId: current.customerId,
          salesInvoiceId: current.salesInvoiceId,
          noteDate: current.noteDate,
          placeOfSupplyStateCode: current.placeOfSupplyStateCode,
          reason: current.reason,
        },
        current.refundMode,
        current.refundLedgerId,
        current.paymentModeId,
        totals
      );
      const posted = await creditNoteRepository.replaceItemsAndPost(tx, id, user.companyId, header, lines, generated, voucher.id);
      if (!posted) {
        throw new AppError(CANNOT_POST_MESSAGE);
      }
      return posted;
    });
  },

  /**
   * `POSTED -> CANCELLED` only — mirrors reversal (Voucher Engine), no
   * stock involved (matching 40-credit-note.md's Business Rules).
   */
  async cancelCreditNote(id: string): Promise<CreditNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");

    const existing = await creditNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED" || !existing.voucherId) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "CREDIT_NOTE_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await creditNoteRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED" || !current.voucherId) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      await voucherEngine.cancelVoucher(user.companyId, current.voucherId, tx);

      const count = await creditNoteRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await creditNoteRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    });
  },
};
