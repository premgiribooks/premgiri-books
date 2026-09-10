import { Prisma, type SalesReturnStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  ReturnableInvoiceOption,
  SalesReturnDetail,
  SalesReturnItemDetail,
  SalesReturnListFilters,
  SalesReturnListRow,
} from "@/types/sales-return";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const SALES_INVOICE_INCLUDE = {
  salesInvoice: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      customerMode: true,
      customerId: true,
      customer: { select: { ledger: { select: { name: true } } } },
      quickCustomerName: true,
    },
  },
} as const;

const REFUND_LEDGER_INCLUDE = {
  refundLedger: { select: { id: true, name: true } },
} as const;

const ITEM_INCLUDE = {
  items: {
    include: {
      salesInvoiceItem: {
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

type SalesReturnListRowRaw = Prisma.SalesReturnGetPayload<{ include: typeof SALES_INVOICE_INCLUDE }>;
type SalesReturnDetailRaw = Prisma.SalesReturnGetPayload<{
  include: typeof SALES_INVOICE_INCLUDE & typeof REFUND_LEDGER_INCLUDE & typeof ITEM_INCLUDE;
}>;

const SALES_RETURN_ITEM_DECIMAL_FIELDS = ["quantity", "taxableAmount", "cgst", "sgst", "igst", "cess", "totalAmount"] as const;

const SALES_RETURN_DECIMAL_FIELDS = ["taxableAmount", "totalCgst", "totalSgst", "totalIgst", "totalCess", "grandTotal"] as const;

function customerName(raw: {
  customerMode: string;
  customer: { ledger: { name: string } } | null;
  quickCustomerName: string | null;
}): string | null {
  if (raw.customer) {
    return raw.customer.ledger.name;
  }
  if (raw.customerMode === "QUICK") {
    return raw.quickCustomerName ?? "Quick Customer";
  }
  return raw.quickCustomerName ? `Walk-in — ${raw.quickCustomerName}` : "Walk-in";
}

function toSalesReturnListRow(raw: SalesReturnListRowRaw): SalesReturnListRow {
  const { salesInvoice, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of SALES_RETURN_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  return {
    ...(normalizedHeader as unknown as SalesReturnListRow),
    salesInvoice: {
      id: salesInvoice.id,
      invoiceNumber: salesInvoice.invoiceNumber,
      invoiceDate: salesInvoice.invoiceDate,
      customerMode: salesInvoice.customerMode,
      customerId: salesInvoice.customerId,
      customerName: customerName(salesInvoice),
    },
  };
}

function toSalesReturnDetail(raw: SalesReturnDetailRaw): SalesReturnDetail {
  const { salesInvoice, refundLedger, items, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of SALES_RETURN_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (sales-invoice-repository.ts's identical note).
  const normalizedItems: SalesReturnItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of SALES_RETURN_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      return {
        ...(line as unknown as SalesReturnItemDetail),
        salesInvoiceItem: {
          id: item.salesInvoiceItem.id,
          productId: item.salesInvoiceItem.productId,
          productName: item.salesInvoiceItem.product.name,
          productCode: item.salesInvoiceItem.product.productCode,
          warehouseId: item.salesInvoiceItem.warehouseId,
          warehouseName: item.salesInvoiceItem.warehouse.name,
        },
      };
    });

  return {
    ...(normalizedHeader as unknown as SalesReturnDetail),
    salesInvoice: {
      id: salesInvoice.id,
      invoiceNumber: salesInvoice.invoiceNumber,
      invoiceDate: salesInvoice.invoiceDate,
      customerMode: salesInvoice.customerMode,
      customerId: salesInvoice.customerId,
      customerName: customerName(salesInvoice),
    },
    refundLedger,
    items: normalizedItems,
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: SalesReturnListFilters
): Prisma.SalesReturnWhereInput {
  const where: Prisma.SalesReturnWhereInput = { companyId, financialYearId };

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
      { salesInvoice: { invoiceNumber: { contains: filters.search, mode: "insensitive" } } },
      { salesInvoice: { customer: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } } },
    ];
  }

  return where;
}

export interface SalesReturnLinePersistData {
  salesInvoiceItemId: string;
  quantity: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

export interface SalesReturnHeaderPersistData {
  salesInvoiceId: string;
  returnDate: Date;
  refundMode: "LEDGER_ADJUSTMENT" | "CASH_REFUND";
  refundLedgerId: string | null;
  reason: string | null;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export interface SalesInvoiceItemForReturn {
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

export interface SalesInvoiceForReturn {
  id: string;
  companyId: string;
  financialYearId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  status: string;
  customerMode: string;
  customerId: string | null;
  customerName: string | null;
  items: SalesInvoiceItemForReturn[];
}

const INVOICE_FOR_RETURN_INCLUDE = {
  customer: { select: { ledger: { select: { name: true } } } },
  items: {
    include: {
      product: { select: { name: true, productCode: true, unit: { select: { symbol: true, decimalPlaces: true } } } },
      warehouse: { select: { name: true } },
    },
  },
} as const;

type InvoiceForReturnRaw = Prisma.SalesInvoiceGetPayload<{ include: typeof INVOICE_FOR_RETURN_INCLUDE }>;

function toSalesInvoiceForReturn(raw: InvoiceForReturnRaw): SalesInvoiceForReturn {
  return {
    id: raw.id,
    companyId: raw.companyId,
    financialYearId: raw.financialYearId,
    invoiceNumber: raw.invoiceNumber,
    invoiceDate: raw.invoiceDate,
    status: raw.status,
    customerMode: raw.customerMode,
    customerId: raw.customerId,
    customerName: raw.customer
      ? raw.customer.ledger.name
      : raw.customerMode === "QUICK"
        ? (raw.quickCustomerName ?? "Quick Customer")
        : raw.quickCustomerName
          ? `Walk-in — ${raw.quickCustomerName}`
          : "Walk-in",
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

export const salesReturnRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: SalesReturnListFilters = {}
  ): Promise<SalesReturnListRow[]> {
    const rows = await prisma.salesReturn.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: SALES_INVOICE_INCLUDE,
      orderBy: [{ returnDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toSalesReturnListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma) {
    const row = await client.salesReturn.findUnique({
      where: { id },
      include: { ...SALES_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toSalesReturnDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: SalesReturnHeaderPersistData,
    lines: SalesReturnLinePersistData[],
    createdByUserId: string
  ) {
    const created = await tx.salesReturn.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...SALES_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toSalesReturnDetail(created);
  },

  /**
   * Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors sales-invoice-repository.ts's replaceItemsAndUpdate.
   * `returnNumber` is never touched here (edit never generates it — only
   * `replaceItemsAndPost` does). The `allowedStatuses` guard is re-checked
   * atomically here so a concurrent status transition landing between the
   * service's own check and this write loses cleanly.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly SalesReturnStatus[],
    header: SalesReturnHeaderPersistData,
    lines: SalesReturnLinePersistData[]
  ) {
    const existing = await tx.salesReturn.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.salesReturnItem.deleteMany({ where: { salesReturnId: id } });
    const updated = await tx.salesReturn.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...SALES_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toSalesReturnDetail(updated);
  },

  /**
   * Posting's own write (39-sales-return.md's Posting steps 3-7 combined):
   * replaces the line set with the freshly-recomputed persist data, updates
   * every header total plus `returnNumber`/`voucherId`, and flips `status`
   * to `POSTED` — all atomically, guarded by `WHERE status = 'DRAFT'` so a
   * concurrent status change loses cleanly.
   */
  async replaceItemsAndPost(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    header: SalesReturnHeaderPersistData,
    lines: SalesReturnLinePersistData[],
    generated: GeneratedNumber,
    voucherId: string
  ) {
    const existing = await tx.salesReturn.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.salesReturnItem.deleteMany({ where: { salesReturnId: id } });
    const updated = await tx.salesReturn.update({
      where: { id },
      data: {
        ...header,
        returnNumber: generated.formatted,
        voucherId,
        status: "POSTED",
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...SALES_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toSalesReturnDetail(updated);
  },

  /** Guarded status transition — mirrors sales-invoice-repository.ts's
   * updateStatus exactly. Drives Cancel (`POSTED -> CANCELLED`) only; Post
   * uses `replaceItemsAndPost` above since it also rewrites totals/lines. */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly SalesReturnStatus[],
    to: SalesReturnStatus
  ): Promise<number> {
    const result = await client.salesReturn.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /** Company-scoped lookup of the source invoice plus every line's
   * price/tax snapshot — the read the create/update/post flows all derive
   * lines from (39-sales-return.md: "a return cannot invent a different
   * price or tax treatment than what was actually invoiced"). */
  async findSalesInvoiceForReturn(
    client: PrismaClientOrTransaction,
    companyId: string,
    salesInvoiceId: string
  ): Promise<SalesInvoiceForReturn | null> {
    const invoice = await client.salesInvoice.findUnique({
      where: { id: salesInvoiceId },
      include: INVOICE_FOR_RETURN_INCLUDE,
    });
    if (!invoice || invoice.companyId !== companyId) {
      return null;
    }
    return toSalesInvoiceForReturn(invoice);
  },

  /** Sums quantity already returned per `salesInvoiceItemId`, counting ONLY
   * sibling SalesReturnItems whose parent SalesReturn is `POSTED` — a DRAFT
   * or CANCELLED sibling contributes nothing (39-sales-return.md's
   * Returnable quantity rule). The return being created/posted is itself
   * excluded automatically: it is DRAFT until the final
   * `replaceItemsAndPost` commit, so this sum never double-counts it. */
  async sumPostedReturnedQuantities(
    client: PrismaClientOrTransaction,
    salesInvoiceItemIds: readonly string[]
  ): Promise<Map<string, number>> {
    if (salesInvoiceItemIds.length === 0) {
      return new Map();
    }
    const grouped = await client.salesReturnItem.groupBy({
      by: ["salesInvoiceItemId"],
      where: { salesInvoiceItemId: { in: [...salesInvoiceItemIds] }, salesReturn: { status: "POSTED" } },
      _sum: { quantity: true },
    });
    return new Map(grouped.map((row) => [row.salesInvoiceItemId, row._sum.quantity?.toNumber() ?? 0]));
  },

  async findRefundLedgerForReturn(
    client: PrismaClientOrTransaction,
    companyId: string,
    ledgerId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean } | null> {
    const ledger = await client.ledger.findUnique({
      where: { id: ledgerId },
      select: { id: true, companyId: true, isActive: true },
    });
    if (!ledger || ledger.companyId !== companyId) {
      return null;
    }
    return ledger;
  },

  async findCustomerLedgerId(
    client: PrismaClientOrTransaction,
    companyId: string,
    customerId: string
  ): Promise<string | null> {
    const customer = await client.customer.findUnique({
      where: { id: customerId },
      select: { companyId: true, ledgerId: true },
    });
    if (!customer || customer.companyId !== companyId) {
      return null;
    }
    return customer.ledgerId;
  },

  /** Any active company Ledger — the refund ledger picker's options, no new
   * Company Settings mapping needed (mirrors SalesInvoicePayment's ledger
   * picker). */
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

  /** POSTED invoices for the "New Sales Return" invoice picker, scoped to
   * the active financial year (mirrors deliveryChallanRepository's own
   * FY-scoped search list). */
  async findPostedInvoicesForPicker(
    companyId: string,
    financialYearId: string,
    search?: string
  ): Promise<ReturnableInvoiceOption[]> {
    const rows = await prisma.salesInvoice.findMany({
      where: {
        companyId,
        financialYearId,
        status: "POSTED",
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { customer: { ledger: { name: { contains: search, mode: "insensitive" } } } },
                { quickCustomerName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        customerMode: true,
        quickCustomerName: true,
        customer: { select: { ledger: { select: { name: true } } } },
      },
      orderBy: { invoiceDate: "desc" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate,
      customerName: customerName(row),
    }));
  },
};
