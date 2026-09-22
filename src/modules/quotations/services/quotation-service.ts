import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import type { Page, PageParams } from "@/lib/pagination";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { gstEngine } from "@/engines/gst/gst-engine";
import type { CalculateLineInput, DocumentGroupResult, SupplyType } from "@/engines/gst/types";
import { applyMarginOverride } from "@/engines/pricing/margin-override";
import { pricingEngine } from "@/engines/pricing/pricing-engine";
import { customerService } from "@/modules/customers/services/customer-service";
import {
  quotationRepository,
  type QuotationHeaderPersistData,
  type QuotationLinePersistData,
} from "@/modules/quotations/repositories/quotation-repository";
import { computeTaxableAmountPre, sumHeaderGrossTotals } from "@/modules/quotations/utils/quotation-calculations";
import {
  createQuotationSchema,
  previewQuotationSchema,
  toUtcDate,
  updateQuotationSchema,
  type CreateQuotationInput,
  type PreviewQuotationInput,
  type QuotationLineInput,
  type UpdateQuotationInput,
} from "@/modules/quotations/validation/quotation-schema";
import type {
  QuotationDetail,
  QuotationFormOptions,
  QuotationLineComputation,
  QuotationListFilters,
  QuotationListRow,
  QuotationPreview,
  QuotationProductOption,
  QuotationTotals,
  ResolvedLinePrice,
} from "@/types/quotation";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Quotation not found.";
const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found.";
const CUSTOMER_INACTIVE_MESSAGE = "Selected customer is inactive.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with quotations.";
const NO_COMPANY_STATE_MESSAGE =
  "Set your company's GST state before creating a quotation (Company > Edit Profile).";
// The single message for every rejected status transition — a quotation
// that has since been accepted, rejected, cancelled, or lazily expired all
// look identical to the caller: "you can no longer act on this, please
// refresh" (35-quotations.md's Business Rules: "no separate error path is
// needed" for the just-expired-on-Accept case).
const CANNOT_CHANGE_MESSAGE =
  "This quotation can no longer be changed — it may have been accepted, rejected, cancelled, or expired. Please refresh.";

const ZERO_TOTALS: QuotationTotals = {
  subtotal: 0,
  totalDiscount: 0,
  taxableAmount: 0,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  totalCess: 0,
  grandTotal: 0,
};

function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Unit-dependent, so enforced here (after the product/unit row loads) rather
// than as a static Zod bound — mirrors pricing-engine.ts's
// assertQuantityPrecision exactly.
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
  persist: QuotationLinePersistData;
  computation: Omit<QuotationLineComputation, "lineNumber">;
  calcInput: CalculateLineInput | null;
}

/**
 * Builds one line's persisted fields and display computation. A line whose
 * taxable value nets to zero (full discount, or a zero rate — both valid per
 * the Zod schema) SHORT-CIRCUITS rather than calling the GST Engine's
 * calculateLine, which requires a positive amount — zero tax on zero value
 * is not a calculation, it is the absence of one, so this does not violate
 * the "no GST arithmetic outside the engine" invariant.
 */
function buildLine(
  input: QuotationLineInput,
  product: QuotationProductOption,
  supplyType: SupplyType
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

  const persist: QuotationLinePersistData = {
    productId: product.id,
    quantity: input.quantity,
    rate: input.rate,
    discountPercent,
    discountAmount,
    ratePercent: product.ratePercent,
    cessPercent: product.cessPercent,
    taxableAmount: result?.taxableAmount ?? 0,
    cgst: result?.cgst ?? 0,
    sgst: result?.sgst ?? 0,
    igst: result?.igst ?? 0,
    cess: result?.cess ?? 0,
    totalAmount: result?.totalAmount ?? 0,
  };

  // Below-cost is a direct comparison against the product's stored purchase
  // cost, not a second resolvePrice() call — resolvePrice's job is prefilling
  // `rate` client-side; the warning here only needs to know whether the
  // FINAL entered/overridden rate undercuts cost (35-quotations.md's
  // Business Rules), which the already-loaded product snapshot answers.
  const computation: Omit<QuotationLineComputation, "lineNumber"> = {
    taxableAmount: persist.taxableAmount,
    cgst: persist.cgst,
    sgst: persist.sgst,
    igst: persist.igst,
    cess: persist.cess,
    totalAmount: persist.totalAmount,
    isBelowCost: product.purchasePrice !== null && input.rate < product.purchasePrice,
    isHsnMissing: gstEngine.isHsnRequired(isTaxedLine, product.hsnCode),
    isGstRateMissing: isTaxedLine && !product.hasGstRate,
  };

  return { persist, computation, calcInput };
}

interface BuiltQuotation {
  lines: BuiltLine[];
  header: QuotationTotals;
  groups: DocumentGroupResult[];
}

/**
 * Composes every line via `buildLine`, then calls the GST Engine's
 * calculateDocument ONCE over every taxed (nonzero) line for the header
 * totals — `subtotal`/`totalDiscount` are the only two header fields not
 * produced by that call (quotation-calculations.ts's sumHeaderGrossTotals).
 * `strict` distinguishes actual save (create/update — rejects an
 * all-zero-value quotation outright) from the live-editing preview (returns
 * zero totals instead, since the user may simply be mid-edit).
 */
function buildQuotation(
  lineInputs: readonly QuotationLineInput[],
  productsById: ReadonlyMap<string, QuotationProductOption>,
  supplyType: SupplyType,
  strict: boolean
): BuiltQuotation {
  if (lineInputs.length === 0) {
    return { lines: [], header: ZERO_TOTALS, groups: [] };
  }

  const lines = lineInputs.map((input) => {
    const product = productsById.get(input.productId);
    if (!product) {
      throw new AppError("One or more products were not found.");
    }
    return buildLine(input, product, supplyType);
  });

  const grossTotals = sumHeaderGrossTotals(
    lineInputs.map((input) => ({
      quantity: input.quantity,
      rate: input.rate,
      discountPercent: input.discountPercent ?? 0,
      discountAmount: input.discountAmount ?? 0,
    }))
  );

  const taxedInputs = lines
    .map((line) => line.calcInput)
    .filter((calcInput): calcInput is CalculateLineInput => calcInput !== null);

  if (taxedInputs.length === 0) {
    if (strict) {
      throw new AppError("A quotation cannot consist entirely of zero-value lines.");
    }
    return {
      lines,
      header: { ...ZERO_TOTALS, subtotal: grossTotals.subtotal, totalDiscount: grossTotals.totalDiscount },
      groups: [],
    };
  }

  const documentResult = gstEngine.calculateDocument(taxedInputs);

  return {
    lines,
    header: {
      subtotal: grossTotals.subtotal,
      totalDiscount: grossTotals.totalDiscount,
      taxableAmount: documentResult.taxableAmount,
      totalCgst: documentResult.cgst,
      totalSgst: documentResult.sgst,
      totalIgst: documentResult.igst,
      totalCess: documentResult.cess,
      grandTotal: documentResult.totalAmount,
    },
    groups: documentResult.groups,
  };
}

async function loadProductsMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly QuotationLineInput[]
): Promise<Map<string, QuotationProductOption>> {
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];
  const products = await quotationRepository.findProductsForLines(client, companyId, productIds);
  return new Map(products.map((product) => [product.id, product]));
}

async function verifyCustomer(companyId: string, customerId: string): Promise<void> {
  const customer = await quotationRepository.findCustomerForQuotation(prisma, companyId, customerId);
  if (!customer) {
    throw new AppError(CUSTOMER_NOT_FOUND_MESSAGE);
  }
  if (!customer.isActive) {
    throw new AppError(CUSTOMER_INACTIVE_MESSAGE);
  }
}

/**
 * `determineSupplyType` is computed ONCE per document, fed into every line
 * (35-quotations.md's Data Model). The company's own GST state code has no
 * derivation fallback — it is a real, explicit `Company.stateCode` column a
 * Company Admin must set once; unset blocks with a friendly, actionable
 * error rather than guessing from `gstin`'s prefix or a fuzzy match against
 * the free-text `state` name.
 */
async function resolveSupplyType(companyId: string, placeOfSupplyStateCode: string): Promise<SupplyType> {
  const companyStateCode = await quotationRepository.findCompanyStateCode(companyId);
  if (!companyStateCode) {
    throw new AppError(NO_COMPANY_STATE_MESSAGE);
  }
  return gstEngine.determineSupplyType(companyStateCode, placeOfSupplyStateCode);
}

function toHeaderPersistData(
  data: CreateQuotationInput,
  totals: QuotationTotals
): QuotationHeaderPersistData {
  return {
    customerId: data.customerId,
    quotationDate: toUtcDate(data.quotationDate),
    validUntil: data.validUntil ? toUtcDate(data.validUntil) : null,
    placeOfSupplyStateCode: data.placeOfSupplyStateCode,
    narration: data.narration ?? null,
    ...totals,
  };
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

async function afterTransition(id: string, count: number): Promise<QuotationDetail> {
  if (count === 0) {
    throw new AppError(CANNOT_CHANGE_MESSAGE);
  }
  const updated = await quotationRepository.findById(id);
  if (!updated) {
    throw new AppError(NOT_FOUND_MESSAGE);
  }
  return updated;
}

export const quotationService = {
  // Scoped to the active financial year — quotationNumber is only unique
  // per (company, financial year), so a flat cross-year list would show
  // ambiguous-looking duplicate numbers; every other document in this
  // session already scopes its "current work" to the active FY.
  async listQuotations(filters: QuotationListFilters = {}): Promise<QuotationListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    await quotationRepository.expireOverdue(user.companyId, todayUtcDate());
    return quotationRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /** Infinite-scroll page for the Quotations list page. */
  async listQuotationsPage(filters: QuotationListFilters, page: PageParams): Promise<Page<QuotationListRow>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return { items: [], hasMore: false };
    }

    await quotationRepository.expireOverdue(user.companyId, todayUtcDate());
    return quotationRepository.findManyPage(user.companyId, financialYear.id, filters, page);
  },

  // Company-scoped only (not FY-scoped) — viewing one document by id needs
  // no active-FY context, mirroring voucherEngine.getVoucher. A cross-company
  // id resolves identically to "not found."
  async getQuotation(id: string): Promise<QuotationDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    await quotationRepository.expireOverdue(user.companyId, todayUtcDate(), id);

    const quotation = await quotationRepository.findById(id);
    if (!quotation || quotation.companyId !== user.companyId) {
      return null;
    }
    return quotation;
  },

  /**
   * Backs the hidden "temporary margin override" feature (Ctrl+Shift+M) on
   * the Quotation detail page and its Download button — NEVER persisted,
   * purely a display/print-time recomputation. Mirrors
   * salesInvoiceService.previewSalesInvoiceWithMarginOverride: resolves each
   * line's current latest purchase cost via pricingEngine.resolvePrice, then
   * feeds the overridden rate through this service's own `previewQuotation`
   * (the exact GST Engine path a real quotation goes through) so no tax math
   * is duplicated here.
   */
  async previewQuotationWithMarginOverride(id: string, marginPercent: number): Promise<QuotationDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const quotation = await this.getQuotation(id);
    if (!quotation) {
      return null;
    }

    const costs = await Promise.all(
      quotation.items.map((item) =>
        pricingEngine.resolvePrice({ companyId: user.companyId, productId: item.productId, quantity: item.quantity })
      )
    );

    const overrideLines = quotation.items.map((item, index) => ({
      productId: item.productId,
      quantity: item.quantity,
      rate: applyMarginOverride(costs[index].purchaseCost, marginPercent) ?? item.rate,
      discountPercent: item.discountPercent || undefined,
      discountAmount: item.discountAmount || undefined,
    }));

    const preview = await this.previewQuotation({
      customerId: quotation.customerId,
      quotationDate: quotation.quotationDate.toISOString().slice(0, 10),
      validUntil: quotation.validUntil ? quotation.validUntil.toISOString().slice(0, 10) : undefined,
      placeOfSupplyStateCode: quotation.placeOfSupplyStateCode,
      lines: overrideLines,
    });

    return {
      ...quotation,
      items: quotation.items.map((item, index) => ({
        ...item,
        rate: overrideLines[index].rate,
        taxableAmount: preview.lines[index].taxableAmount,
        cgst: preview.lines[index].cgst,
        sgst: preview.lines[index].sgst,
        igst: preview.lines[index].igst,
        cess: preview.lines[index].cess,
        totalAmount: preview.lines[index].totalAmount,
      })),
      subtotal: preview.totals.subtotal,
      totalDiscount: preview.totals.totalDiscount,
      taxableAmount: preview.totals.taxableAmount,
      totalCgst: preview.totals.totalCgst,
      totalSgst: preview.totals.totalSgst,
      totalIgst: preview.totals.totalIgst,
      totalCess: preview.totals.totalCess,
      grandTotal: preview.totals.grandTotal,
    };
  },

  async listQuotationFormOptions(): Promise<QuotationFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await requireFinancialYear();

    const [customers, products, companyStateCode, preview] = await Promise.all([
      customerService.listSelectableCustomers(),
      quotationRepository.findQuotableProducts(user.companyId),
      quotationRepository.findCompanyStateCode(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "QUOTATION",
      }),
    ]);

    return {
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.ledger.name,
        isActive: customer.isActive,
      })),
      products,
      companyStateCode,
      nextQuotationNumber: preview.formatted,
    };
  },

  /**
   * Read-only pass-through to the Pricing Engine — prefills a new line's
   * `rate` client-side. Never posts anything.
   */
  async resolveLinePrice(input: {
    productId: string;
    quantity: number;
    customerId?: string;
    asOfDate?: string;
  }): Promise<ResolvedLinePrice> {
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

  /**
   * The live-editing preview — the Server Action every line/header edit
   * debounces into (the UI never computes tax/pricing itself,
   * 35-quotations.md's UI section). Lenient: an empty or all-zero-value
   * line set returns zero totals instead of throwing, since the user may be
   * mid-edit. Shares `buildQuotation` with `createQuotation` so preview and
   * save can never disagree.
   */
  async previewQuotation(input: PreviewQuotationInput): Promise<QuotationPreview> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const data = previewQuotationSchema.parse(input);
    if (data.lines.length === 0) {
      return { lines: [], totals: ZERO_TOTALS, groups: [] };
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildQuotation(data.lines, productsById, supplyType, false);

    return {
      lines: built.lines.map((line, index) => ({ lineNumber: index + 1, ...line.computation })),
      totals: built.header,
      groups: built.groups,
    };
  },

  async createQuotation(input: CreateQuotationInput): Promise<QuotationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const financialYear = await requireFinancialYear();
    const data = createQuotationSchema.parse(input);

    await verifyCustomer(user.companyId, data.customerId);
    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildQuotation(data.lines, productsById, supplyType, true);

    // ensureSequence must run in its own short-lived statement BEFORE the
    // posting transaction opens (the Document Number Engine's documented
    // contract) — the postVoucher/cancelVoucher precedent exactly.
    await documentNumberEngine.ensureSequence(user.companyId, financialYear.id, "QUOTATION");

    try {
      return await runInTransaction(async (tx) => {
        const generated = await documentNumberEngine.generateNumber(tx, {
          companyId: user.companyId,
          financialYearId: financialYear.id,
          documentType: "QUOTATION",
        });

        return quotationRepository.create(
          tx,
          user.companyId,
          financialYear.id,
          toHeaderPersistData(data, built.header),
          built.lines.map((line) => line.persist),
          generated,
          user.id
        );
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isUniqueConstraintError(error)) {
        throw new AppError("A quotation with this number already exists for this financial year.");
      }
      throw error;
    }
  },

  // Only reachable while DRAFT/SENT (checked before AND, atomically, inside
  // the write transaction — the voucher-engine.ts cancelVoucher
  // double-check pattern, closing the race against a concurrent status
  // transition). Never regenerates quotationNumber.
  async updateQuotation(id: string, input: UpdateQuotationInput): Promise<QuotationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    await quotationRepository.expireOverdue(user.companyId, todayUtcDate(), id);

    const existing = await quotationRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT" && existing.status !== "SENT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateQuotationSchema.parse(input);
    await verifyCustomer(user.companyId, data.customerId);
    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildQuotation(data.lines, productsById, supplyType, true);

    const updated = await runInTransaction((tx) =>
      quotationRepository.replaceItemsAndUpdate(
        tx,
        id,
        user.companyId,
        ["DRAFT", "SENT"],
        toHeaderPersistData(data, built.header),
        built.lines.map((line) => line.persist)
      )
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  async sendQuotation(id: string): Promise<QuotationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");
    const count = await quotationRepository.updateStatus(prisma, id, user.companyId, ["DRAFT"], "SENT");
    return afterTransition(id, count);
  },

  // approve — a customer's response, recorded by a more senior role in some
  // organizations (35-quotations.md's Security). Lazily expires first so an
  // Accept attempt landing on a just-overdue SENT quotation rejects with the
  // same friendly message a terminal-state quotation always produces.
  async acceptQuotation(id: string): Promise<QuotationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");
    await quotationRepository.expireOverdue(user.companyId, todayUtcDate(), id);
    const count = await quotationRepository.updateStatus(prisma, id, user.companyId, ["SENT"], "ACCEPTED");
    return afterTransition(id, count);
  },

  async rejectQuotation(id: string): Promise<QuotationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "approve");
    await quotationRepository.expireOverdue(user.companyId, todayUtcDate(), id);
    const count = await quotationRepository.updateStatus(prisma, id, user.companyId, ["SENT"], "REJECTED");
    return afterTransition(id, count);
  },

  // Any non-terminal state (DRAFT or SENT) may be cancelled, staff-initiated
  // (35-quotations.md's Business Rules) — deliberately gated on "edit," NOT
  // the "delete" lifecycle-action convention every master since
  // ledger-service.ts uses, because the spec explicitly says delete is not
  // implemented at all for this document; reusing "delete" here would
  // contradict that.
  async cancelQuotation(id: string): Promise<QuotationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");
    await quotationRepository.expireOverdue(user.companyId, todayUtcDate(), id);
    const count = await quotationRepository.updateStatus(
      prisma,
      id,
      user.companyId,
      ["DRAFT", "SENT"],
      "CANCELLED"
    );
    return afterTransition(id, count);
  },
};
