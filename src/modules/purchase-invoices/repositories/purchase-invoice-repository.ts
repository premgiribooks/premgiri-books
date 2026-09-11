import { Prisma, type PurchaseInvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  PurchaseInvoiceDetail,
  PurchaseInvoiceItemDetail,
  PurchaseInvoiceListFilters,
  PurchaseInvoiceListRow,
  PurchaseInvoiceProductOption,
  PurchaseInvoiceSupplierOption,
} from "@/types/purchase-invoice";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const SUPPLIER_INCLUDE = {
  supplier: {
    select: { id: true, isActive: true, creditDays: true, ledger: { select: { name: true } } },
  },
} as const;

const PURCHASE_ORDER_INCLUDE = {
  purchaseOrder: { select: { id: true, orderNumber: true } },
} as const;

const GOODS_RECEIPT_NOTE_INCLUDE = {
  goodsReceiptNote: { select: { id: true, grnNumber: true } },
} as const;

const ITEM_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, productCode: true, isActive: true } },
      warehouse: { select: { id: true, name: true, code: true, isActive: true } },
    },
  },
} as const;

const PAYMENT_INCLUDE = {
  payments: { include: { ledger: { select: { id: true, name: true } } } },
} as const;

type PurchaseInvoiceListRowRaw = Prisma.PurchaseInvoiceGetPayload<{
  include: typeof SUPPLIER_INCLUDE & typeof PURCHASE_ORDER_INCLUDE & typeof GOODS_RECEIPT_NOTE_INCLUDE;
}>;
type PurchaseInvoiceDetailRaw = Prisma.PurchaseInvoiceGetPayload<{
  include: typeof SUPPLIER_INCLUDE &
    typeof PURCHASE_ORDER_INCLUDE &
    typeof GOODS_RECEIPT_NOTE_INCLUDE &
    typeof ITEM_INCLUDE &
    typeof PAYMENT_INCLUDE;
}>;

const PURCHASE_INVOICE_ITEM_DECIMAL_FIELDS = [
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

const PURCHASE_INVOICE_ITEM_NULLABLE_DECIMAL_FIELDS = [
  "overriddenCgst",
  "overriddenSgst",
  "overriddenIgst",
  "overriddenCess",
] as const;

const PURCHASE_INVOICE_DECIMAL_FIELDS = [
  "subtotal",
  "totalDiscount",
  "taxableAmount",
  "totalCgst",
  "totalSgst",
  "totalIgst",
  "totalCess",
  "roundOff",
  "grandTotal",
  "amountPaid",
] as const;

// Decimal -> number normalization at the repository boundary — the
// sales-invoice-repository.ts convention, extended with a second pass for
// the nullable overridden* item columns (null stays null).
function toSupplierOption(
  raw: { id: string; isActive: boolean; creditDays: number | null; ledger: { name: string } }
): PurchaseInvoiceSupplierOption {
  return { id: raw.id, name: raw.ledger.name, isActive: raw.isActive, creditDays: raw.creditDays };
}

function toPurchaseInvoiceListRow(raw: PurchaseInvoiceListRowRaw): PurchaseInvoiceListRow {
  const { supplier, purchaseOrder, goodsReceiptNote, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of PURCHASE_INVOICE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  return {
    ...(normalizedHeader as unknown as PurchaseInvoiceListRow),
    supplier: toSupplierOption(supplier),
    purchaseOrder,
    goodsReceiptNote,
  };
}

function toPurchaseInvoiceDetail(raw: PurchaseInvoiceDetailRaw): PurchaseInvoiceDetail {
  const { supplier, purchaseOrder, goodsReceiptNote, items, payments, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of PURCHASE_INVOICE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row order
  // (sales-invoice-repository.ts's identical note).
  const normalizedItems: PurchaseInvoiceItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of PURCHASE_INVOICE_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      for (const field of PURCHASE_INVOICE_ITEM_NULLABLE_DECIMAL_FIELDS) {
        const value = (item as unknown as Record<string, Prisma.Decimal | null>)[field];
        line[field] = value ? value.toNumber() : null;
      }
      return { ...(line as unknown as PurchaseInvoiceItemDetail), product: item.product, warehouse: item.warehouse };
    });

  const normalizedPayments = payments.map((payment) => ({
    ...payment,
    amount: payment.amount.toNumber(),
    ledger: payment.ledger,
  }));

  return {
    ...(normalizedHeader as unknown as PurchaseInvoiceDetail),
    supplier: toSupplierOption(supplier),
    purchaseOrder,
    goodsReceiptNote,
    items: normalizedItems,
    payments: normalizedPayments,
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: PurchaseInvoiceListFilters
): Prisma.PurchaseInvoiceWhereInput {
  const where: Prisma.PurchaseInvoiceWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
  }
  if (filters.fromDate || filters.toDate) {
    where.invoiceDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
      { supplierInvoiceNumber: { contains: filters.search, mode: "insensitive" } },
      { supplier: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  return where;
}

export interface PurchaseInvoiceLinePersistData {
  productId: string;
  warehouseId: string;
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
  isTaxOverridden: boolean;
  overriddenCgst: number | null;
  overriddenSgst: number | null;
  overriddenIgst: number | null;
  overriddenCess: number | null;
  overrideReason: string | null;
  overriddenByUserId: string | null;
}

export interface PurchaseInvoiceHeaderPersistData {
  supplierId: string;
  supplierInvoiceNumber: string;
  invoiceDate: Date;
  placeOfSupplyStateCode: string;
  narration: string | null;
  purchaseOrderId: string | null;
  goodsReceiptNoteId: string | null;
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
}

export interface PurchaseInvoicePaymentPersistData {
  ledgerId: string;
  amount: number;
  reference: string | null;
}

export const purchaseInvoiceRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: PurchaseInvoiceListFilters = {}
  ): Promise<PurchaseInvoiceListRow[]> {
    const rows = await prisma.purchaseInvoice.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_ORDER_INCLUDE, ...GOODS_RECEIPT_NOTE_INCLUDE },
      orderBy: [{ invoiceDate: "desc" }, { supplierInvoiceNumber: "desc" }],
    });
    return rows.map(toPurchaseInvoiceListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<PurchaseInvoiceDetail | null> {
    const row = await client.purchaseInvoice.findUnique({
      where: { id },
      include: {
        ...SUPPLIER_INCLUDE,
        ...PURCHASE_ORDER_INCLUDE,
        ...GOODS_RECEIPT_NOTE_INCLUDE,
        ...ITEM_INCLUDE,
        ...PAYMENT_INCLUDE,
      },
    });
    return row ? toPurchaseInvoiceDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: PurchaseInvoiceHeaderPersistData,
    lines: PurchaseInvoiceLinePersistData[],
    payments: PurchaseInvoicePaymentPersistData[],
    createdByUserId: string
  ): Promise<PurchaseInvoiceDetail> {
    const created = await tx.purchaseInvoice.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
        payments: { create: payments },
      },
      include: {
        ...SUPPLIER_INCLUDE,
        ...PURCHASE_ORDER_INCLUDE,
        ...GOODS_RECEIPT_NOTE_INCLUDE,
        ...ITEM_INCLUDE,
        ...PAYMENT_INCLUDE,
      },
    });
    return toPurchaseInvoiceDetail(created);
  },

  /**
   * Delete-all-then-recreate the line AND payment sets inside the caller's
   * transaction — mirrors sales-invoice-repository.ts's
   * replaceItemsAndUpdate. `invoiceNumber` is never touched here (it is
   * null until posting, and edit never regenerates it). The
   * `allowedStatuses` guard is re-checked atomically here so a concurrent
   * status transition landing between the service's own check and this
   * write loses cleanly.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly PurchaseInvoiceStatus[],
    header: PurchaseInvoiceHeaderPersistData,
    lines: PurchaseInvoiceLinePersistData[],
    payments: PurchaseInvoicePaymentPersistData[]
  ): Promise<PurchaseInvoiceDetail | null> {
    const existing = await tx.purchaseInvoice.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } });
    await tx.purchaseInvoicePayment.deleteMany({ where: { purchaseInvoiceId: id } });
    const updated = await tx.purchaseInvoice.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
        payments: { create: payments },
      },
      include: {
        ...SUPPLIER_INCLUDE,
        ...PURCHASE_ORDER_INCLUDE,
        ...GOODS_RECEIPT_NOTE_INCLUDE,
        ...ITEM_INCLUDE,
        ...PAYMENT_INCLUDE,
      },
    });
    return toPurchaseInvoiceDetail(updated);
  },

  /**
   * Posting's own write (44-purchase-invoice.md's steps 2-4 + 8 combined):
   * replaces the line/payment sets with the freshly-recomputed persist data
   * (never trusting stale draft totals), assigns the just-generated
   * `invoiceNumber` (null until now — see the schema's Decisions), updates
   * every header total plus `voucherId`, and flips `status` to `POSTED` —
   * all atomically, guarded by `WHERE status = 'DRAFT'` so a concurrent
   * status change loses cleanly.
   */
  async replaceItemsAndPost(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    invoiceNumber: string,
    header: PurchaseInvoiceHeaderPersistData,
    lines: PurchaseInvoiceLinePersistData[],
    payments: PurchaseInvoicePaymentPersistData[],
    voucherId: string
  ): Promise<PurchaseInvoiceDetail | null> {
    const existing = await tx.purchaseInvoice.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } });
    await tx.purchaseInvoicePayment.deleteMany({ where: { purchaseInvoiceId: id } });
    const updated = await tx.purchaseInvoice.update({
      where: { id },
      data: {
        ...header,
        invoiceNumber,
        voucherId,
        status: "POSTED",
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
        payments: { create: payments },
      },
      include: {
        ...SUPPLIER_INCLUDE,
        ...PURCHASE_ORDER_INCLUDE,
        ...GOODS_RECEIPT_NOTE_INCLUDE,
        ...ITEM_INCLUDE,
        ...PAYMENT_INCLUDE,
      },
    });
    return toPurchaseInvoiceDetail(updated);
  },

  /**
   * Guarded status transition: only succeeds when the row's current status
   * is still one of `from` at write time — mirrors
   * sales-invoice-repository.ts's updateStatus exactly. The only
   * user-facing transition this drives is Cancel (`POSTED -> CANCELLED`);
   * Post uses `replaceItemsAndPost` above since it also rewrites
   * totals/lines/invoiceNumber.
   */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly PurchaseInvoiceStatus[],
    to: PurchaseInvoiceStatus
  ): Promise<number> {
    const result = await client.purchaseInvoice.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  async findSupplierForInvoice(
    client: PrismaClientOrTransaction,
    companyId: string,
    supplierId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean; ledgerId: string } | null> {
    const supplier = await client.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, companyId: true, isActive: true, ledgerId: true },
    });
    if (!supplier || supplier.companyId !== companyId) {
      return null;
    }
    return supplier;
  },

  /** The product picker's options — mirrors
   * purchase-order-repository.ts's findOrderableProducts, extended with
   * `hsnCode`/`hasGstRate` (this document's own HSN hard-block). */
  async findInvoiceableProducts(companyId: string): Promise<PurchaseInvoiceProductOption[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
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
      purchasePrice: row.purchasePrice?.toNumber() ?? null,
    }));
  },

  /** Batched lookup for every distinct productId referenced by a
   * create/update/post payload — mirrors sales-invoice-repository.ts's
   * findProductsForLines exactly. */
  async findProductsForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<PurchaseInvoiceProductOption[]> {
    const rows = await client.product.findMany({
      where: { id: { in: [...productIds] }, companyId },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
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
      purchasePrice: row.purchasePrice?.toNumber() ?? null,
    }));
  },

  async findSelectableWarehouses(companyId: string): Promise<{ id: string; name: string; code: string; isActive: boolean }[]> {
    return prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  async findWarehousesForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    warehouseIds: readonly string[]
  ): Promise<{ id: string; name: string; code: string; isActive: boolean }[]> {
    return client.warehouse.findMany({
      where: { id: { in: [...warehouseIds] }, companyId },
      select: { id: true, name: true, code: true, isActive: true },
    });
  },

  async findCompanyStateCode(companyId: string): Promise<string | null> {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { stateCode: true } });
    return company?.stateCode ?? null;
  },

  /** Every active company ledger, with enough group/bank-link info for the
   * service to filter down to the payment-ledger picker's allowed set
   * (Cash-in-Hand group or BankAccount-linked — 44-purchase-invoice.md's
   * Ledger Posting rule). Unfiltered here since the "Cash-in-Hand subtree"
   * computation needs the company's full LedgerGroup list, which the
   * service already loads once for the six-mapping validation. */
  async findActiveLedgersForPaymentPicker(
    companyId: string
  ): Promise<{ id: string; name: string; ledgerGroupId: string; ledgerGroupName: string; hasBankAccount: boolean }[]> {
    const rows = await prisma.ledger.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        ledgerGroupId: true,
        ledgerGroup: { select: { name: true } },
        bankAccount: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      ledgerGroupId: row.ledgerGroupId,
      ledgerGroupName: row.ledgerGroup.name,
      hasBankAccount: row.bankAccount !== null,
    }));
  },
};
