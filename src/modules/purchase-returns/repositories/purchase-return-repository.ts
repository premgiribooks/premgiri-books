import { Prisma, type PurchaseReturnStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  PurchaseReturnDetail,
  PurchaseReturnItemDetail,
  PurchaseReturnListFilters,
  PurchaseReturnListRow,
  ReturnablePurchaseInvoiceOption,
} from "@/types/purchase-return";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const PURCHASE_INVOICE_INCLUDE = {
  purchaseInvoice: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      supplierId: true,
      supplier: { select: { ledger: { select: { name: true } } } },
    },
  },
} as const;

const REFUND_LEDGER_INCLUDE = {
  refundLedger: { select: { id: true, name: true } },
  paymentMode: { select: { id: true, name: true } },
} as const;

const ITEM_INCLUDE = {
  items: {
    include: {
      purchaseInvoiceItem: {
        select: {
          id: true,
          productId: true,
          product: { select: { name: true, productCode: true } },
          warehouseId: true,
          warehouse: { select: { name: true } },
        },
      },
    },
  },
} as const;

type PurchaseReturnListRowRaw = Prisma.PurchaseReturnGetPayload<{ include: typeof PURCHASE_INVOICE_INCLUDE }>;
type PurchaseReturnDetailRaw = Prisma.PurchaseReturnGetPayload<{
  include: typeof PURCHASE_INVOICE_INCLUDE & typeof REFUND_LEDGER_INCLUDE & typeof ITEM_INCLUDE;
}>;

const PURCHASE_RETURN_ITEM_DECIMAL_FIELDS = ["quantity", "taxableAmount", "cgst", "sgst", "igst", "cess", "totalAmount"] as const;

const PURCHASE_RETURN_DECIMAL_FIELDS = ["taxableAmount", "totalCgst", "totalSgst", "totalIgst", "totalCess", "grandTotal"] as const;

function supplierName(raw: { supplier: { ledger: { name: string } } }): string {
  return raw.supplier.ledger.name;
}

function toPurchaseReturnListRow(raw: PurchaseReturnListRowRaw): PurchaseReturnListRow {
  const { purchaseInvoice, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of PURCHASE_RETURN_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  return {
    ...(normalizedHeader as unknown as PurchaseReturnListRow),
    purchaseInvoice: {
      id: purchaseInvoice.id,
      invoiceNumber: purchaseInvoice.invoiceNumber as string,
      invoiceDate: purchaseInvoice.invoiceDate,
      supplierId: purchaseInvoice.supplierId,
      supplierName: supplierName(purchaseInvoice),
    },
  };
}

function toPurchaseReturnDetail(raw: PurchaseReturnDetailRaw): PurchaseReturnDetail {
  const { purchaseInvoice, refundLedger, paymentMode, items, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of PURCHASE_RETURN_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (purchase-invoice-repository.ts's identical note).
  const normalizedItems: PurchaseReturnItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of PURCHASE_RETURN_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      return {
        ...(line as unknown as PurchaseReturnItemDetail),
        purchaseInvoiceItem: {
          id: item.purchaseInvoiceItem.id,
          productId: item.purchaseInvoiceItem.productId,
          productName: item.purchaseInvoiceItem.product.name,
          productCode: item.purchaseInvoiceItem.product.productCode,
          warehouseId: item.purchaseInvoiceItem.warehouseId,
          warehouseName: item.purchaseInvoiceItem.warehouse.name,
        },
      };
    });

  return {
    ...(normalizedHeader as unknown as PurchaseReturnDetail),
    purchaseInvoice: {
      id: purchaseInvoice.id,
      invoiceNumber: purchaseInvoice.invoiceNumber as string,
      invoiceDate: purchaseInvoice.invoiceDate,
      supplierId: purchaseInvoice.supplierId,
      supplierName: supplierName(purchaseInvoice),
    },
    refundLedger,
    paymentMode,
    items: normalizedItems,
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: PurchaseReturnListFilters
): Prisma.PurchaseReturnWhereInput {
  const where: Prisma.PurchaseReturnWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.fromDate || filters.toDate) {
    where.returnDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { returnNumber: { contains: filters.search, mode: "insensitive" } },
      { purchaseInvoice: { invoiceNumber: { contains: filters.search, mode: "insensitive" } } },
      { purchaseInvoice: { supplier: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } } },
    ];
  }

  return where;
}

export interface PurchaseReturnLinePersistData {
  purchaseInvoiceItemId: string;
  quantity: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

export interface PurchaseReturnHeaderPersistData {
  purchaseInvoiceId: string;
  returnDate: Date;
  refundMode: "LEDGER_ADJUSTMENT" | "CASH_REFUND";
  refundLedgerId: string | null;
  paymentModeId: string | null;
  reason: string | null;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export interface PurchaseInvoiceItemForReturn {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  warehouseId: string;
  warehouseName: string;
  unitSymbol: string;
  unitDecimalPlaces: number;
  quantity: number;
  rate: number;
  ratePercent: number;
  cessPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  isTaxOverridden: boolean;
  overriddenCgst: number | null;
  overriddenSgst: number | null;
  overriddenIgst: number | null;
  overriddenCess: number | null;
}

export interface PurchaseInvoiceForReturn {
  id: string;
  companyId: string;
  financialYearId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  status: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseInvoiceItemForReturn[];
}

const INVOICE_FOR_RETURN_INCLUDE = {
  supplier: { select: { ledger: { select: { name: true } } } },
  items: {
    include: {
      product: { select: { name: true, productCode: true, unit: { select: { symbol: true, decimalPlaces: true } } } },
      warehouse: { select: { name: true } },
    },
  },
} as const;

type InvoiceForReturnRaw = Prisma.PurchaseInvoiceGetPayload<{ include: typeof INVOICE_FOR_RETURN_INCLUDE }>;

function toPurchaseInvoiceForReturn(raw: InvoiceForReturnRaw): PurchaseInvoiceForReturn {
  return {
    id: raw.id,
    companyId: raw.companyId,
    financialYearId: raw.financialYearId,
    invoiceNumber: raw.invoiceNumber as string,
    invoiceDate: raw.invoiceDate,
    status: raw.status,
    supplierId: raw.supplierId,
    supplierName: raw.supplier.ledger.name,
    items: raw.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productCode: item.product.productCode,
      warehouseId: item.warehouseId,
      warehouseName: item.warehouse.name,
      unitSymbol: item.product.unit.symbol,
      unitDecimalPlaces: item.product.unit.decimalPlaces,
      quantity: item.quantity.toNumber(),
      rate: item.rate.toNumber(),
      ratePercent: item.ratePercent.toNumber(),
      cessPercent: item.cessPercent.toNumber(),
      taxableAmount: item.taxableAmount.toNumber(),
      cgst: item.cgst.toNumber(),
      sgst: item.sgst.toNumber(),
      igst: item.igst.toNumber(),
      cess: item.cess.toNumber(),
      isTaxOverridden: item.isTaxOverridden,
      overriddenCgst: item.overriddenCgst ? item.overriddenCgst.toNumber() : null,
      overriddenSgst: item.overriddenSgst ? item.overriddenSgst.toNumber() : null,
      overriddenIgst: item.overriddenIgst ? item.overriddenIgst.toNumber() : null,
      overriddenCess: item.overriddenCess ? item.overriddenCess.toNumber() : null,
    })),
  };
}

export const purchaseReturnRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: PurchaseReturnListFilters = {}
  ): Promise<PurchaseReturnListRow[]> {
    const rows = await prisma.purchaseReturn.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: PURCHASE_INVOICE_INCLUDE,
      orderBy: [{ returnDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toPurchaseReturnListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma) {
    const row = await client.purchaseReturn.findUnique({
      where: { id },
      include: { ...PURCHASE_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toPurchaseReturnDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: PurchaseReturnHeaderPersistData,
    lines: PurchaseReturnLinePersistData[],
    createdByUserId: string
  ) {
    const created = await tx.purchaseReturn.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...PURCHASE_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toPurchaseReturnDetail(created);
  },

  /**
   * Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors purchase-invoice-repository.ts's replaceItemsAndUpdate.
   * `returnNumber` is never touched here (edit never generates it — only
   * `replaceItemsAndPost` does). The `allowedStatuses` guard is re-checked
   * atomically here so a concurrent status transition landing between the
   * service's own check and this write loses cleanly.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly PurchaseReturnStatus[],
    header: PurchaseReturnHeaderPersistData,
    lines: PurchaseReturnLinePersistData[]
  ) {
    const existing = await tx.purchaseReturn.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.purchaseReturnItem.deleteMany({ where: { purchaseReturnId: id } });
    const updated = await tx.purchaseReturn.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...PURCHASE_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toPurchaseReturnDetail(updated);
  },

  /**
   * Posting's own write (45-purchase-return.md's Posting steps combined):
   * replaces the line set with the freshly-recomputed persist data, updates
   * every header total plus `returnNumber`/`voucherId`, and flips `status`
   * to `POSTED` — all atomically, guarded by `WHERE status = 'DRAFT'` so a
   * concurrent status change loses cleanly.
   */
  async replaceItemsAndPost(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    header: PurchaseReturnHeaderPersistData,
    lines: PurchaseReturnLinePersistData[],
    generated: GeneratedNumber,
    voucherId: string
  ) {
    const existing = await tx.purchaseReturn.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.purchaseReturnItem.deleteMany({ where: { purchaseReturnId: id } });
    const updated = await tx.purchaseReturn.update({
      where: { id },
      data: {
        ...header,
        returnNumber: generated.formatted,
        voucherId,
        status: "POSTED",
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...PURCHASE_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toPurchaseReturnDetail(updated);
  },

  /** Guarded status transition — mirrors purchase-invoice-repository.ts's
   * updateStatus exactly. Drives Cancel (`POSTED -> CANCELLED`) only; Post
   * uses `replaceItemsAndPost` above since it also rewrites totals/lines. */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly PurchaseReturnStatus[],
    to: PurchaseReturnStatus
  ): Promise<number> {
    const result = await client.purchaseReturn.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /** Company-scoped lookup of the source invoice plus every line's
   * price/tax snapshot — the read the create/update/post flows all derive
   * lines from (45-purchase-return.md: "a return cannot invent a different
   * price or tax treatment than what was actually invoiced"). */
  async findPurchaseInvoiceForReturn(
    client: PrismaClientOrTransaction,
    companyId: string,
    purchaseInvoiceId: string
  ): Promise<PurchaseInvoiceForReturn | null> {
    const invoice = await client.purchaseInvoice.findUnique({
      where: { id: purchaseInvoiceId },
      include: INVOICE_FOR_RETURN_INCLUDE,
    });
    if (!invoice || invoice.companyId !== companyId) {
      return null;
    }
    return toPurchaseInvoiceForReturn(invoice);
  },

  /** Sums quantity already returned per `purchaseInvoiceItemId`, counting
   * ONLY sibling PurchaseReturnItems whose parent PurchaseReturn is
   * `POSTED` — a DRAFT or CANCELLED sibling contributes nothing
   * (45-purchase-return.md's Returnable quantity rule). The return being
   * created/posted is itself excluded automatically: it is DRAFT until the
   * final `replaceItemsAndPost` commit, so this sum never double-counts it. */
  async sumPostedReturnedQuantities(
    client: PrismaClientOrTransaction,
    purchaseInvoiceItemIds: readonly string[]
  ): Promise<Map<string, number>> {
    if (purchaseInvoiceItemIds.length === 0) {
      return new Map();
    }
    const grouped = await client.purchaseReturnItem.groupBy({
      by: ["purchaseInvoiceItemId"],
      where: { purchaseInvoiceItemId: { in: [...purchaseInvoiceItemIds] }, purchaseReturn: { status: "POSTED" } },
      _sum: { quantity: true },
    });
    return new Map(grouped.map((row) => [row.purchaseInvoiceItemId, row._sum.quantity?.toNumber() ?? 0]));
  },

  /** The refund ledger's active/group/bank-link fields, company-scoped —
   * the read `assertRefundLedgerValid` (in the service) derives its
   * Cash-in-Hand-or-BankAccount-linked check from. Mirrors
   * sales-return-repository.ts's findRefundLedgerForReturn, extended with
   * the two extra fields Purchase Return's stricter rule needs. */
  async findRefundLedgerForReturn(
    client: PrismaClientOrTransaction,
    companyId: string,
    refundLedgerId: string
  ): Promise<{ id: string; name: string; companyId: string; isActive: boolean; ledgerGroupId: string; hasBankAccount: boolean } | null> {
    const ledger = await client.ledger.findUnique({
      where: { id: refundLedgerId },
      select: { id: true, name: true, companyId: true, isActive: true, ledgerGroupId: true, bankAccount: { select: { id: true } } },
    });
    if (!ledger) {
      return null;
    }
    return {
      id: ledger.id,
      name: ledger.name,
      companyId: ledger.companyId,
      isActive: ledger.isActive,
      ledgerGroupId: ledger.ledgerGroupId,
      hasBankAccount: ledger.bankAccount !== null,
    };
  },

  async findSupplierLedgerId(
    client: PrismaClientOrTransaction,
    companyId: string,
    supplierId: string
  ): Promise<string | null> {
    const supplier = await client.supplier.findUnique({
      where: { id: supplierId },
      select: { companyId: true, ledgerId: true },
    });
    if (!supplier || supplier.companyId !== companyId) {
      return null;
    }
    return supplier.ledgerId;
  },

  /** Any active company Ledger — the refund ledger picker's options.
   * `assertRefundLedgerValid` (in the service) applies the stricter
   * Cash-in-Hand-or-BankAccount-linked server-side check at save/post time;
   * this list is a UI convenience only. */
  async findSelectableRefundLedgers(
    companyId: string
  ): Promise<{ id: string; name: string; groupName: string }[]> {
    const ledgers = await prisma.ledger.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, ledgerGroup: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return ledgers.map((ledger) => ({ id: ledger.id, name: ledger.name, groupName: ledger.ledgerGroup.name }));
  },

  /** POSTED invoices for the "New Purchase Return" invoice picker, scoped to
   * the active financial year (mirrors sales-return-repository.ts's own
   * FY-scoped search list). */
  async findPostedInvoicesForPicker(
    companyId: string,
    financialYearId: string,
    search?: string
  ): Promise<ReturnablePurchaseInvoiceOption[]> {
    const rows = await prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        financialYearId,
        status: "POSTED",
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { supplierInvoiceNumber: { contains: search, mode: "insensitive" } },
                { supplier: { ledger: { name: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        supplier: { select: { ledger: { select: { name: true } } } },
      },
      orderBy: { invoiceDate: "desc" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber as string,
      invoiceDate: row.invoiceDate,
      supplierName: row.supplier.ledger.name,
    }));
  },
};
