import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
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
import {
  debitNoteRepository,
  type DebitNoteHeaderPersistData,
  type DebitNoteLinePersistData,
} from "@/modules/debit-notes/repositories/debit-note-repository";
import { sumDebitNoteHeaderTotals } from "@/modules/debit-notes/utils/debit-note-calculations";
import {
  createDebitNoteSchema,
  toUtcDate,
  updateDebitNoteSchema,
  type CreateDebitNoteInput,
  type DebitNoteLineInput,
  type UpdateDebitNoteInput,
} from "@/modules/debit-notes/validation/debit-note-schema";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import type {
  DebitNoteDetail,
  DebitNoteFormOptions,
  DebitNoteInvoiceOption,
  DebitNoteListFilters,
  DebitNoteListRow,
  DebitNoteTotals,
} from "@/types/debit-note";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Debit note not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with debit notes.";
const NO_COMPANY_STATE_MESSAGE = "Set your company's GST state before creating a debit note (Company > Edit Profile).";
const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found.";
const CUSTOMER_INACTIVE_MESSAGE = "Selected customer is inactive.";
const INVOICE_NOT_FOUND_MESSAGE = "Sales invoice not found.";
const INVOICE_NOT_POSTED_MESSAGE = "Only a posted sales invoice can be linked to a debit note.";
const INVOICE_WALK_IN_MESSAGE =
  "This invoice has no customer to link a debit note's customer to.";
const INVOICE_CUSTOMER_MISMATCH_MESSAGE = "The linked sales invoice's customer does not match this debit note's customer.";
const CANNOT_CHANGE_MESSAGE =
  "This debit note can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This debit note can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted debit note can be cancelled.";

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
  const companyStateCode = await debitNoteRepository.findCompanyStateCode(companyId);
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
  const customer = await debitNoteRepository.findCustomerForDebitNote(client, companyId, customerId);
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
 * (41-debit-note.md's Business Rules): must exist, belong to this company,
 * be POSTED, carry a real customer (never WALK_IN), and match this debit
 * note's own `customerId`. Re-run both at draft-creation/update time AND
 * re-checked fresh at posting time.
 */
async function resolveInvoiceLink(
  client: PrismaClientOrTransaction,
  companyId: string,
  customerId: string,
  salesInvoiceId: string | undefined
) {
  if (!salesInvoiceId) {
    return null;
  }
  const invoice = await debitNoteRepository.findSalesInvoiceForDebitNote(client, companyId, salesInvoiceId);
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

/** Builds one line's persisted fields via the GST Engine — a Debit Note
 * line's `taxableAmount` is entered directly (not derived from qty x rate),
 * so `calculateLine` always runs with `isInclusive: false` (41-debit-note.md's
 * Posting step). */
function buildDebitNoteLine(input: DebitNoteLineInput, supplyType: SupplyType): DebitNoteLinePersistData {
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

function buildDebitNoteLines(lines: readonly DebitNoteLineInput[], supplyType: SupplyType): DebitNoteLinePersistData[] {
  return lines.map((line) => buildDebitNoteLine(line, supplyType));
}

interface DebitNoteHeaderFields {
  customerId: string;
  salesInvoiceId: string | null;
  noteDate: Date;
  placeOfSupplyStateCode: string;
  reason: string;
}

function buildHeaderPersistData(fields: DebitNoteHeaderFields, totals: DebitNoteTotals): DebitNoteHeaderPersistData {
  return {
    customerId: fields.customerId,
    salesInvoiceId: fields.salesInvoiceId,
    noteDate: fields.noteDate,
    placeOfSupplyStateCode: fields.placeOfSupplyStateCode,
    reason: fields.reason,
    ...totals,
  };
}

interface ResolvedDebitNoteInput {
  lines: DebitNoteLinePersistData[];
  totals: DebitNoteTotals;
}

/**
 * The full create/update validation pipeline (41-debit-note.md's Business
 * Rules): the customer must exist and be active, an optional linked invoice
 * must be POSTED/non-WALK_IN/customer-matched, every line's tax is computed
 * fresh via the GST Engine from this note's own place of supply.
 */
async function resolveDebitNoteInput(
  client: PrismaClientOrTransaction,
  companyId: string,
  data: CreateDebitNoteInput
): Promise<ResolvedDebitNoteInput> {
  await verifyCustomer(client, companyId, data.customerId);
  await resolveInvoiceLink(client, companyId, data.customerId, data.salesInvoiceId);

  const supplyType = await resolveSupplyType(companyId, data.placeOfSupplyStateCode);
  const lines = buildDebitNoteLines(data.lines, supplyType);
  const totals = sumDebitNoteHeaderTotals(lines);

  return { lines, totals };
}

interface VoucherEntriesInput {
  totals: DebitNoteTotals;
  settings: {
    salesLedgerId: string | null;
    outputCgstLedgerId: string | null;
    outputSgstLedgerId: string | null;
    outputIgstLedgerId: string | null;
    outputCessLedgerId: string | null;
  };
  customerLedgerId: string;
}

/** 41-debit-note.md's Ledger Posting section — the reversal of Credit
 * Note's: Debit the customer's Ledger for `grandTotal`, Credit the
 * sales/tax ledgers for the adjustment amounts. Balances by construction. */
function buildVoucherEntries(input: VoucherEntriesInput): VoucherEntryLineInput[] {
  const entries: VoucherEntryLineInput[] = [];
  const { totals, settings } = input;

  entries.push({ ledgerId: input.customerLedgerId, entryType: "DEBIT", amount: totals.grandTotal });

  if (totals.taxableAmount > 0) {
    entries.push({ ledgerId: settings.salesLedgerId as string, entryType: "CREDIT", amount: totals.taxableAmount });
  }
  if (totals.totalCgst > 0) {
    entries.push({ ledgerId: settings.outputCgstLedgerId as string, entryType: "CREDIT", amount: totals.totalCgst });
  }
  if (totals.totalSgst > 0) {
    entries.push({ ledgerId: settings.outputSgstLedgerId as string, entryType: "CREDIT", amount: totals.totalSgst });
  }
  if (totals.totalIgst > 0) {
    entries.push({ ledgerId: settings.outputIgstLedgerId as string, entryType: "CREDIT", amount: totals.totalIgst });
  }
  if (totals.totalCess > 0) {
    entries.push({ ledgerId: settings.outputCessLedgerId as string, entryType: "CREDIT", amount: totals.totalCess });
  }

  return entries;
}

export const debitNoteService = {
  async listDebitNotes(filters: DebitNoteListFilters = {}): Promise<DebitNoteListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return debitNoteRepository.findMany(user.companyId, financialYear.id, filters);
  },

  async getDebitNote(id: string): Promise<DebitNoteDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const debitNote = await debitNoteRepository.findById(id);
    if (!debitNote || debitNote.companyId !== user.companyId) {
      return null;
    }
    return debitNote;
  },

  async listDebitNoteFormOptions(): Promise<DebitNoteFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();

    const [customers, invoices, gstRates, settings] = await Promise.all([
      customerService.listSelectableCustomers(),
      financialYear ? debitNoteRepository.findPostedInvoicesForPicker(user.companyId, financialYear.id) : Promise.resolve<DebitNoteInvoiceOption[]>([]),
      gstRateService.listSelectableGstRates(),
      companySettingsService.getSettings(user.companyId),
    ]);

    return {
      customers: customers.map((customer) => ({ id: customer.id, name: customer.ledger.name })),
      invoices,
      gstRates: gstRates.map((rate) => ({ id: rate.id, name: rate.name, ratePercent: rate.ratePercent, cessPercent: rate.cessPercent })),
      isLedgerMappingComplete: isSalesLedgerMappingComplete(settings),
    };
  },

  async createDraft(input: CreateDebitNoteInput): Promise<DebitNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const financialYear = await requireFinancialYear();
    const data = createDebitNoteSchema.parse(input);
    const resolved = await resolveDebitNoteInput(prisma, user.companyId, data);
    const header = buildHeaderPersistData(
      {
        customerId: data.customerId,
        salesInvoiceId: data.salesInvoiceId ?? null,
        noteDate: toUtcDate(data.noteDate),
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        reason: data.reason,
      },
      resolved.totals
    );

    return runInTransaction((tx) => debitNoteRepository.create(tx, user.companyId, financialYear.id, header, resolved.lines, user.id));
  },

  // Only reachable while DRAFT (41-debit-note.md: "Editable while DRAFT")
  // — checked before AND, atomically, inside the write transaction. Never
  // generates noteNumber (only postDebitNote does).
  async updateDraft(id: string, input: UpdateDebitNoteInput): Promise<DebitNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const existing = await debitNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateDebitNoteSchema.parse(input);
    const resolved = await resolveDebitNoteInput(prisma, user.companyId, data);
    const header = buildHeaderPersistData(
      {
        customerId: data.customerId,
        salesInvoiceId: data.salesInvoiceId ?? null,
        noteDate: toUtcDate(data.noteDate),
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        reason: data.reason,
      },
      resolved.totals
    );

    const updated = await runInTransaction((tx) =>
      debitNoteRepository.replaceItemsAndUpdate(tx, id, user.companyId, ["DRAFT"], header, resolved.lines)
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * The orchestration this module exists for (41-debit-note.md's Posting
   * section): one transaction that re-validates every business rule against
   * CURRENT state, recomputes each line's tax fresh via the GST Engine,
   * posts the balanced voucher (Voucher Engine) with the ledger direction
   * reversed from Credit Note, and flips this note to POSTED — atomically.
   * **No Inventory Engine call ever** (a Debit Note never moves stock).
   */
  async postDebitNote(id: string): Promise<DebitNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");

    const existing = await debitNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "DEBIT_NOTE");
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "DEBIT_NOTE_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await debitNoteRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_POST_MESSAGE);
      }

      const settings = await companySettingsService.getSettings(user.companyId);
      assertSalesLedgerMappingComplete(settings);

      const customer = await verifyCustomer(tx, user.companyId, current.customerId);

      // Re-verify the (optional) linked invoice against CURRENT state.
      await resolveInvoiceLink(tx, user.companyId, current.customerId, current.salesInvoiceId ?? undefined);

      // Recompute every line's tax fresh via the GST Engine.
      const supplyType = await resolveSupplyType(user.companyId, current.placeOfSupplyStateCode);
      const lineInputs: DebitNoteLineInput[] = current.items.map((item) => ({
        description: item.description,
        taxableAmount: item.taxableAmount,
        ratePercent: item.ratePercent,
        cessPercent: item.cessPercent,
      }));
      const lines = buildDebitNoteLines(lineInputs, supplyType);
      const totals = sumDebitNoteHeaderTotals(lines);

      // Generate noteNumber — the first time this row receives one.
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId: user.companyId,
        financialYearId: current.financialYearId,
        documentType: "DEBIT_NOTE",
      });

      // Balanced voucher, ledger direction reversed from Credit Note. No
      // Inventory Engine call.
      const entries = buildVoucherEntries({
        totals,
        settings,
        customerLedgerId: customer.ledgerId,
      });
      const voucher = await voucherEngine.postVoucher(
        user.companyId,
        {
          financialYearId: current.financialYearId,
          voucherType: "DEBIT_NOTE",
          voucherDate: toDateInputValue(current.noteDate),
          narration: current.reason,
          referenceType: "DEBIT_NOTE",
          referenceId: current.id,
          createdByUserId: user.id,
          entries,
        },
        tx
      );

      // Persist final totals, noteNumber, voucherId, POSTED status.
      const header = buildHeaderPersistData(
        {
          customerId: current.customerId,
          salesInvoiceId: current.salesInvoiceId,
          noteDate: current.noteDate,
          placeOfSupplyStateCode: current.placeOfSupplyStateCode,
          reason: current.reason,
        },
        totals
      );
      const posted = await debitNoteRepository.replaceItemsAndPost(tx, id, user.companyId, header, lines, generated, voucher.id);
      if (!posted) {
        throw new AppError(CANNOT_POST_MESSAGE);
      }
      return posted;
    });
  },

  /**
   * `POSTED -> CANCELLED` only — mirrors reversal (Voucher Engine), no
   * stock involved (matching 41-debit-note.md's Business Rules).
   */
  async cancelDebitNote(id: string): Promise<DebitNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");

    const existing = await debitNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED" || !existing.voucherId) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "DEBIT_NOTE_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await debitNoteRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED" || !current.voucherId) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      await voucherEngine.cancelVoucher(user.companyId, current.voucherId, tx);

      const count = await debitNoteRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await debitNoteRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    });
  },
};
