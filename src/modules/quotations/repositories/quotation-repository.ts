import { Prisma, type QuotationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  QuotationCustomerOption,
  QuotationDetail,
  QuotationItemDetail,
  QuotationListFilters,
  QuotationListRow,
  QuotationProductOption,
} from "@/types/quotation";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const CUSTOMER_INCLUDE = {
  customer: { select: { id: true, isActive: true, ledger: { select: { name: true } } } },
} as const;

const ITEM_INCLUDE = {
  items: {
    include: { product: { select: { id: true, name: true, productCode: true, isActive: true } } },
  },
} as const;

type QuotationListRowRaw = Prisma.QuotationGetPayload<{ include: typeof CUSTOMER_INCLUDE }>;
type QuotationDetailRaw = Prisma.QuotationGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof ITEM_INCLUDE;
}>;

const QUOTATION_ITEM_DECIMAL_FIELDS = [
  "quantity",
  "rate",
  "discountPercent",
  "discountAmount",
  "ratePercent",
  "cessPercent",
  "taxableAmount",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "totalAmount",
] as const;

const QUOTATION_DECIMAL_FIELDS = [
  "subtotal",
  "totalDiscount",
  "taxableAmount",
  "totalCgst",
  "totalSgst",
  "totalIgst",
  "totalCess",
  "grandTotal",
] as const;

// Decimal -> number normalization at the repository boundary (the
// voucher-repository.ts toPostedVoucher convention).
function toCustomerOption(raw: { id: string; isActive: boolean; ledger: { name: string } }): QuotationCustomerOption {
  return { id: raw.id, name: raw.ledger.name, isActive: raw.isActive };
}

function toQuotationListRow(raw: QuotationListRowRaw): QuotationListRow {
  const header: Record<string, unknown> = { ...raw };
  for (const field of QUOTATION_DECIMAL_FIELDS) {
    header[field] = (raw as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }
  return { ...(header as unknown as QuotationListRow), customer: toCustomerOption(raw.customer) };
}

function toQuotationDetail(raw: QuotationDetailRaw): QuotationDetail {
  const header: Record<string, unknown> = { ...raw };
  for (const field of QUOTATION_DECIMAL_FIELDS) {
    header[field] = (raw as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (voucher-repository.ts's identical note).
  const items: QuotationItemDetail[] = raw.items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of QUOTATION_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      return { ...(line as unknown as QuotationItemDetail), product: item.product };
    });

  return { ...(header as unknown as QuotationDetail), customer: toCustomerOption(raw.customer), items };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: QuotationListFilters
): Prisma.QuotationWhereInput {
  const where: Prisma.QuotationWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.customerId) {
    where.customerId = filters.customerId;
  }
  if (filters.fromDate || filters.toDate) {
    where.quotationDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { quotationNumber: { contains: filters.search, mode: "insensitive" } },
      { customer: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  return where;
}

export interface QuotationLinePersistData {
  productId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  ratePercent: number;
  cessPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

export interface QuotationHeaderPersistData {
  customerId: string;
  quotationDate: Date;
  validUntil: Date | null;
  placeOfSupplyStateCode: string;
  narration: string | null;
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export const quotationRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: QuotationListFilters = {}
  ): Promise<QuotationListRow[]> {
    const rows = await prisma.quotation.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: CUSTOMER_INCLUDE,
      orderBy: [{ quotationDate: "desc" }, { quotationNumber: "desc" }],
    });
    return rows.map(toQuotationListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<QuotationDetail | null> {
    const row = await client.quotation.findUnique({
      where: { id },
      include: { ...CUSTOMER_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toQuotationDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: QuotationHeaderPersistData,
    lines: QuotationLinePersistData[],
    generated: GeneratedNumber,
    createdByUserId: string
  ): Promise<QuotationDetail> {
    const created = await tx.quotation.create({
      data: {
        companyId,
        financialYearId,
        quotationNumber: generated.formatted,
        createdByUserId,
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...CUSTOMER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toQuotationDetail(created);
  },

  /**
   * Delete-all-then-recreate the line set inside the caller's transaction —
   * never called standalone. `quotationNumber` is never touched here (edit
   * never regenerates it, 35-quotations.md's Business Rules). The
   * `allowedStatuses` guard is re-checked atomically here (in addition to
   * the service's own pre-transaction check) so a concurrent status
   * transition landing between that check and this write loses cleanly —
   * `null` covers both "not found/cross-company" and "no longer editable,"
   * the voucher-engine.ts cancelVoucher double-check pattern.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly QuotationStatus[],
    header: QuotationHeaderPersistData,
    lines: QuotationLinePersistData[]
  ): Promise<QuotationDetail | null> {
    const existing = await tx.quotation.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    const updated = await tx.quotation.update({
      where: { id },
      data: {
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...CUSTOMER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toQuotationDetail(updated);
  },

  /**
   * Guarded status transition: only succeeds when the row's current status
   * is still one of `from` at write time — a concurrent peer transition
   * loses the race and its caller sees `count === 0`, the same
   * re-check-inside-the-transaction pattern voucher-engine.ts uses for
   * cancellation.
   */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly QuotationStatus[],
    to: QuotationStatus
  ): Promise<number> {
    const result = await client.quotation.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /**
   * Lazy `SENT -> EXPIRED` sweep (35-quotations.md's Business Rules — no
   * scheduled job exists in this codebase). A single atomic, idempotent,
   * company-scoped statement; safe to call on every read path. Never paired
   * with `revalidatePath` by its callers — that is illegal during render.
   */
  async expireOverdue(companyId: string, today: Date, id?: string): Promise<void> {
    await prisma.quotation.updateMany({
      where: { companyId, status: "SENT", validUntil: { lt: today }, ...(id ? { id } : {}) },
      data: { status: "EXPIRED" },
    });
  },

  /** The product picker's options — active products of the company, with the
   * GST/unit snapshot fields a new line needs. Deliberately its own narrow
   * select rather than reusing product-repository.ts's PRODUCT_INCLUDE
   * (whose gstRate select has no ratePercent/cessPercent). */
  async findQuotableProducts(companyId: string): Promise<QuotationProductOption[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
        sellingPrice: true,
        purchasePrice: true,
        unit: { select: { symbol: true, decimalPlaces: true } },
        hsnCode: { select: { code: true } },
        gstRate: { select: { ratePercent: true, cessPercent: true } },
      },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      productCode: row.productCode,
      isActive: row.isActive,
      unitSymbol: row.unit.symbol,
      unitDecimalPlaces: row.unit.decimalPlaces,
      hsnCode: row.hsnCode?.code ?? null,
      hasGstRate: row.gstRate !== null,
      ratePercent: row.gstRate?.ratePercent.toNumber() ?? 0,
      cessPercent: row.gstRate?.cessPercent.toNumber() ?? 0,
      sellingPrice: row.sellingPrice?.toNumber() ?? null,
      purchasePrice: row.purchasePrice?.toNumber() ?? null,
    }));
  },

  /** Batched lookup for every distinct productId referenced by a create/update
   * payload — inactive products are allowed through here (pricing a stored
   * row must keep working, the pricing-engine.ts convention); the picker
   * itself only ever offers active ones. */
  async findProductsForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<QuotationProductOption[]> {
    const rows = await client.product.findMany({
      where: { id: { in: [...productIds] }, companyId },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
        sellingPrice: true,
        purchasePrice: true,
        unit: { select: { symbol: true, decimalPlaces: true } },
        hsnCode: { select: { code: true } },
        gstRate: { select: { ratePercent: true, cessPercent: true } },
      },
    });
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        productCode: row.productCode,
        isActive: row.isActive,
        unitSymbol: row.unit.symbol,
        unitDecimalPlaces: row.unit.decimalPlaces,
        hsnCode: row.hsnCode?.code ?? null,
        hasGstRate: row.gstRate !== null,
        ratePercent: row.gstRate?.ratePercent.toNumber() ?? 0,
        cessPercent: row.gstRate?.cessPercent.toNumber() ?? 0,
        sellingPrice: row.sellingPrice?.toNumber() ?? null,
        purchasePrice: row.purchasePrice?.toNumber() ?? null,
      }));
  },

  async findCustomerForQuotation(
    client: PrismaClientOrTransaction,
    companyId: string,
    customerId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean; priceListId: string | null } | null> {
    const customer = await client.customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true, isActive: true, priceListId: true },
    });
    if (!customer || customer.companyId !== companyId) {
      return null;
    }
    return customer;
  },

  async findCompanyStateCode(companyId: string): Promise<string | null> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { stateCode: true },
    });
    return company?.stateCode ?? null;
  },
};
