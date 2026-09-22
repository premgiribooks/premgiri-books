import type { CompanySettings, Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertPermission } from "@/lib/permissions";
import type { Page, PageParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { gstEngine } from "@/engines/gst/gst-engine";
import type { SupplyType } from "@/engines/gst/types";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import type { VoucherEntryLineInput } from "@/engines/voucher/voucher-validation";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { assertPurchaseLedgerMappingValid, isPurchaseLedgerMappingComplete } from "@/modules/company/utils/purchase-ledger-mapping";
import {
  purchaseCreditNoteRepository,
  type PurchaseCreditNoteHeaderPersistData,
  type PurchaseCreditNoteLinePersistData,
  type PurchaseInvoiceForPurchaseCreditNote,
} from "@/modules/purchase-credit-notes/repositories/purchase-credit-note-repository";
import { sumPurchaseCreditNoteHeaderTotals } from "@/modules/purchase-credit-notes/utils/purchase-credit-note-calculations";
import {
  createPurchaseCreditNoteSchema,
  toUtcDate,
  updatePurchaseCreditNoteSchema,
  type CreatePurchaseCreditNoteInput,
  type PurchaseCreditNoteLineInput,
  type UpdatePurchaseCreditNoteInput,
} from "@/modules/purchase-credit-notes/validation/purchase-credit-note-schema";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import type {
  PurchaseCreditNoteDetail,
  PurchaseCreditNoteFormOptions,
  PurchaseCreditNoteInvoiceOption,
  PurchaseCreditNoteListFilters,
  PurchaseCreditNoteListRow,
  PurchaseCreditNoteTotals,
} from "@/types/purchase-credit-note";

// Mirrors src/modules/credit-notes/services/credit-note-service.ts's file
// header, reversed to the purchase side (an ad hoc plan, no context/feature-
// specs number assigned): this
// is a pure financial adjustment reducing a supplier's payable, with NO
// stock movement and NO cash-refund path (simpler than Sales Credit Note —
// only ever a ledger adjustment).

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Purchase credit note not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with purchase credit notes.";
const NO_COMPANY_STATE_MESSAGE = "Set your company's GST state before creating a purchase credit note (Company > Edit Profile).";
const SUPPLIER_NOT_FOUND_MESSAGE = "Supplier not found.";
const SUPPLIER_INACTIVE_MESSAGE = "Selected supplier is inactive.";
const INVOICE_NOT_FOUND_MESSAGE = "Purchase invoice not found.";
const INVOICE_NOT_POSTED_MESSAGE = "Only a posted purchase invoice can be linked to a purchase credit note.";
const INVOICE_SUPPLIER_MISMATCH_MESSAGE = "The linked purchase invoice's supplier does not match this credit note's supplier.";
const CANNOT_CHANGE_MESSAGE =
  "This purchase credit note can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This purchase credit note can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted purchase credit note can be cancelled.";

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
  const companyStateCode = await purchaseCreditNoteRepository.findCompanyStateCode(companyId);
  if (!companyStateCode) {
    throw new AppError(NO_COMPANY_STATE_MESSAGE);
  }
  return gstEngine.determineSupplyType(companyStateCode, placeOfSupplyStateCode);
}

async function verifySupplier(
  client: PrismaClientOrTransaction,
  companyId: string,
  supplierId: string
): Promise<{ id: string; ledgerId: string; name: string }> {
  const supplier = await purchaseCreditNoteRepository.findSupplierForPurchaseCreditNote(client, companyId, supplierId);
  if (!supplier) {
    throw new AppError(SUPPLIER_NOT_FOUND_MESSAGE);
  }
  if (!supplier.isActive) {
    throw new AppError(SUPPLIER_INACTIVE_MESSAGE);
  }
  return supplier;
}

/**
 * Validates an (optional) linked Purchase Invoice against CURRENT state —
 * mirrors credit-note-service.ts's resolveInvoiceLink: must exist, belong to
 * this company, be POSTED, and match this credit note's own `supplierId`.
 * Re-run both at draft-creation/update time AND re-checked fresh at posting
 * time. The link is context/audit-trail only — no write-back to
 * PurchaseInvoice ever happens.
 */
async function resolveInvoiceLink(
  client: PrismaClientOrTransaction,
  companyId: string,
  supplierId: string,
  purchaseInvoiceId: string | undefined
): Promise<PurchaseInvoiceForPurchaseCreditNote | null> {
  if (!purchaseInvoiceId) {
    return null;
  }
  const invoice = await purchaseCreditNoteRepository.findPurchaseInvoiceForPurchaseCreditNote(client, companyId, purchaseInvoiceId);
  if (!invoice) {
    throw new AppError(INVOICE_NOT_FOUND_MESSAGE);
  }
  if (invoice.status !== "POSTED") {
    throw new AppError(INVOICE_NOT_POSTED_MESSAGE);
  }
  if (invoice.supplierId !== supplierId) {
    throw new AppError(INVOICE_SUPPLIER_MISMATCH_MESSAGE);
  }
  return invoice;
}

/** Builds one line's persisted fields via the GST Engine — a Purchase
 * Credit Note line's `taxableAmount` is entered directly (not derived from
 * qty x rate), so `calculateLine` always runs with `isInclusive: false`
 * (mirrors credit-note-service.ts's buildCreditNoteLine exactly). */
function buildPurchaseCreditNoteLine(input: PurchaseCreditNoteLineInput, supplyType: SupplyType): PurchaseCreditNoteLinePersistData {
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

function buildPurchaseCreditNoteLines(
  lines: readonly PurchaseCreditNoteLineInput[],
  supplyType: SupplyType
): PurchaseCreditNoteLinePersistData[] {
  return lines.map((line) => buildPurchaseCreditNoteLine(line, supplyType));
}

interface PurchaseCreditNoteHeaderFields {
  supplierId: string;
  purchaseInvoiceId: string | null;
  noteDate: Date;
  placeOfSupplyStateCode: string;
  reason: string;
}

function buildHeaderPersistData(
  fields: PurchaseCreditNoteHeaderFields,
  totals: PurchaseCreditNoteTotals
): PurchaseCreditNoteHeaderPersistData {
  return {
    supplierId: fields.supplierId,
    purchaseInvoiceId: fields.purchaseInvoiceId,
    noteDate: fields.noteDate,
    placeOfSupplyStateCode: fields.placeOfSupplyStateCode,
    reason: fields.reason,
    ...totals,
  };
}

interface ResolvedPurchaseCreditNoteInput {
  lines: PurchaseCreditNoteLinePersistData[];
  totals: PurchaseCreditNoteTotals;
}

/**
 * The full create/update validation pipeline: the supplier must exist and
 * be active, an optional linked invoice must be POSTED/supplier-matched,
 * and every line's tax is computed fresh via the GST Engine from this
 * note's own place of supply.
 */
async function resolvePurchaseCreditNoteInput(
  client: PrismaClientOrTransaction,
  companyId: string,
  data: CreatePurchaseCreditNoteInput
): Promise<ResolvedPurchaseCreditNoteInput> {
  await verifySupplier(client, companyId, data.supplierId);
  await resolveInvoiceLink(client, companyId, data.supplierId, data.purchaseInvoiceId);

  const supplyType = await resolveSupplyType(companyId, data.placeOfSupplyStateCode);
  const lines = buildPurchaseCreditNoteLines(data.lines, supplyType);
  const totals = sumPurchaseCreditNoteHeaderTotals(lines);

  return { lines, totals };
}

interface VoucherEntriesInput {
  supplyType: SupplyType;
  totals: PurchaseCreditNoteTotals;
  settings: CompanySettings;
  supplierLedgerId: string;
}

/**
 * The reversal of Purchase Invoice's own ledger posting
 * (purchase-invoice-service.ts's buildVoucherEntries) — Credit the
 * purchase/input-tax ledgers for the adjustment amounts (less input tax
 * credit claimed), Debit the supplier's ledger for `grandTotal`. No
 * payment-ledger loop (a credit note has no cash component) and no
 * round-off entry (this model has no roundOff column — every line amount is
 * already paise-exact from gstEngine.calculateLine, so the sum is exact by
 * construction, the same posture as credit-note-service.ts's own
 * buildVoucherEntries). Balances by construction.
 */
function buildVoucherEntries(input: VoucherEntriesInput): VoucherEntryLineInput[] {
  const entries: VoucherEntryLineInput[] = [];
  const { totals, settings } = input;

  if (totals.taxableAmount > 0) {
    entries.push({ ledgerId: settings.purchaseLedgerId as string, entryType: "CREDIT", amount: totals.taxableAmount });
  }
  if (input.supplyType === "INTRA_STATE") {
    if (totals.totalCgst > 0) {
      entries.push({ ledgerId: settings.inputCgstLedgerId as string, entryType: "CREDIT", amount: totals.totalCgst });
    }
    if (totals.totalSgst > 0) {
      entries.push({ ledgerId: settings.inputSgstLedgerId as string, entryType: "CREDIT", amount: totals.totalSgst });
    }
  } else if (totals.totalIgst > 0) {
    entries.push({ ledgerId: settings.inputIgstLedgerId as string, entryType: "CREDIT", amount: totals.totalIgst });
  }
  if (totals.totalCess > 0) {
    entries.push({ ledgerId: settings.inputCessLedgerId as string, entryType: "CREDIT", amount: totals.totalCess });
  }

  entries.push({ ledgerId: input.supplierLedgerId, entryType: "DEBIT", amount: totals.grandTotal });

  return entries;
}

export const purchaseCreditNoteService = {
  async listPurchaseCreditNotes(filters: PurchaseCreditNoteListFilters = {}): Promise<PurchaseCreditNoteListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return purchaseCreditNoteRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /** Infinite-scroll page for the Purchase Credit Notes list page. */
  async listPurchaseCreditNotesPage(
    filters: PurchaseCreditNoteListFilters,
    page: PageParams
  ): Promise<Page<PurchaseCreditNoteListRow>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return { items: [], hasMore: false };
    }
    return purchaseCreditNoteRepository.findManyPage(user.companyId, financialYear.id, filters, page);
  },

  async getPurchaseCreditNote(id: string): Promise<PurchaseCreditNoteDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const purchaseCreditNote = await purchaseCreditNoteRepository.findById(id);
    if (!purchaseCreditNote || purchaseCreditNote.companyId !== user.companyId) {
      return null;
    }
    return purchaseCreditNote;
  },

  async listPurchaseCreditNoteFormOptions(): Promise<PurchaseCreditNoteFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();

    const [suppliers, invoices, gstRates, settings] = await Promise.all([
      supplierService.listSelectableSuppliers(),
      financialYear
        ? purchaseCreditNoteRepository.findPostedInvoicesForPicker(user.companyId, financialYear.id)
        : Promise.resolve<PurchaseCreditNoteInvoiceOption[]>([]),
      gstRateService.listSelectableGstRates(),
      companySettingsService.getSettings(user.companyId),
    ]);

    return {
      suppliers: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.ledger.name })),
      invoices,
      gstRates: gstRates.map((rate) => ({ id: rate.id, name: rate.name, ratePercent: rate.ratePercent, cessPercent: rate.cessPercent })),
      isLedgerMappingComplete: isPurchaseLedgerMappingComplete(settings),
    };
  },

  async createDraft(input: CreatePurchaseCreditNoteInput): Promise<PurchaseCreditNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "create");

    const financialYear = await requireFinancialYear();
    const data = createPurchaseCreditNoteSchema.parse(input);
    const resolved = await resolvePurchaseCreditNoteInput(prisma, user.companyId, data);
    const header = buildHeaderPersistData(
      {
        supplierId: data.supplierId,
        purchaseInvoiceId: data.purchaseInvoiceId ?? null,
        noteDate: toUtcDate(data.noteDate),
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        reason: data.reason,
      },
      resolved.totals
    );

    return runInTransaction((tx) =>
      purchaseCreditNoteRepository.create(tx, user.companyId, financialYear.id, header, resolved.lines, user.id)
    );
  },

  // Only reachable while DRAFT — checked before AND, atomically, inside the
  // write transaction. Never generates noteNumber (only
  // postPurchaseCreditNote does).
  async updateDraft(id: string, input: UpdatePurchaseCreditNoteInput): Promise<PurchaseCreditNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    const existing = await purchaseCreditNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updatePurchaseCreditNoteSchema.parse(input);
    const resolved = await resolvePurchaseCreditNoteInput(prisma, user.companyId, data);
    const header = buildHeaderPersistData(
      {
        supplierId: data.supplierId,
        purchaseInvoiceId: data.purchaseInvoiceId ?? null,
        noteDate: toUtcDate(data.noteDate),
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        reason: data.reason,
      },
      resolved.totals
    );

    const updated = await runInTransaction((tx) =>
      purchaseCreditNoteRepository.replaceItemsAndUpdate(tx, id, user.companyId, ["DRAFT"], header, resolved.lines)
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * The orchestration this module exists for: one transaction that
   * re-validates every business rule against CURRENT state, recomputes each
   * line's tax fresh via the GST Engine, posts the balanced voucher
   * (Voucher Engine), and flips this note to POSTED — atomically. **No
   * Inventory Engine call ever** (a Purchase Credit Note never moves
   * stock).
   */
  async postPurchaseCreditNote(id: string): Promise<PurchaseCreditNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "approve");

    const existing = await purchaseCreditNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_CREDIT_NOTE");
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_CREDIT_NOTE_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await purchaseCreditNoteRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_POST_MESSAGE);
      }

      const settingsOrNull = await companySettingsService.getSettings(user.companyId);
      await assertPurchaseLedgerMappingValid(tx, user.companyId, settingsOrNull);
      const settings = settingsOrNull as CompanySettings;

      const supplier = await verifySupplier(tx, user.companyId, current.supplierId);

      // Step 1: re-verify the (optional) linked invoice against CURRENT state.
      await resolveInvoiceLink(tx, user.companyId, current.supplierId, current.purchaseInvoiceId ?? undefined);

      // Step 2: recompute every line's tax fresh via the GST Engine.
      const supplyType = await resolveSupplyType(user.companyId, current.placeOfSupplyStateCode);
      const lineInputs: PurchaseCreditNoteLineInput[] = current.items.map((item) => ({
        description: item.description,
        taxableAmount: item.taxableAmount,
        ratePercent: item.ratePercent,
        cessPercent: item.cessPercent,
      }));
      const lines = buildPurchaseCreditNoteLines(lineInputs, supplyType);
      const totals = sumPurchaseCreditNoteHeaderTotals(lines);

      // Step 3: generate noteNumber — the first time this row receives one.
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId: user.companyId,
        financialYearId: current.financialYearId,
        documentType: "PURCHASE_CREDIT_NOTE",
      });

      // Step 4: balanced voucher. No Inventory Engine call.
      const entries = buildVoucherEntries({
        supplyType,
        totals,
        settings,
        supplierLedgerId: supplier.ledgerId,
      });
      const voucher = await voucherEngine.postVoucher(
        user.companyId,
        {
          financialYearId: current.financialYearId,
          voucherType: "PURCHASE_CREDIT_NOTE",
          voucherDate: toDateInputValue(current.noteDate),
          narration: current.reason,
          referenceType: "PURCHASE_CREDIT_NOTE",
          referenceId: current.id,
          createdByUserId: user.id,
          entries,
        },
        tx
      );

      // Step 5: persist final totals, noteNumber, voucherId, POSTED status.
      const header = buildHeaderPersistData(
        {
          supplierId: current.supplierId,
          purchaseInvoiceId: current.purchaseInvoiceId,
          noteDate: current.noteDate,
          placeOfSupplyStateCode: current.placeOfSupplyStateCode,
          reason: current.reason,
        },
        totals
      );
      const posted = await purchaseCreditNoteRepository.replaceItemsAndPost(tx, id, user.companyId, header, lines, generated, voucher.id);
      if (!posted) {
        throw new AppError(CANNOT_POST_MESSAGE);
      }
      return posted;
    });
  },

  /**
   * `POSTED -> CANCELLED` only — mirrors reversal (Voucher Engine), no
   * stock involved.
   */
  async cancelPurchaseCreditNote(id: string): Promise<PurchaseCreditNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "approve");

    const existing = await purchaseCreditNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED" || !existing.voucherId) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PURCHASE_CREDIT_NOTE_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await purchaseCreditNoteRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED" || !current.voucherId) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      await voucherEngine.cancelVoucher(user.companyId, current.voucherId, tx);

      const count = await purchaseCreditNoteRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await purchaseCreditNoteRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    });
  },
};
