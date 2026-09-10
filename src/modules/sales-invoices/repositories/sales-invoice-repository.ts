import { Prisma, type SalesInvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  SalesInvoiceCustomerOption,
  SalesInvoiceDetail,
  SalesInvoiceItemDetail,
  SalesInvoiceListFilters,
  SalesInvoiceListRow,
  SalesInvoiceProductOption,
} from "@/types/sales-invoice";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const CUSTOMER_INCLUDE = {
  customer: {
    select: { id: true, isActive: true, creditLimit: true, ledger: { select: { name: true } } },
  },
} as const;

const SALES_ORDER_INCLUDE = {
  salesOrder: { select: { id: true, orderNumber: true } },
} as const;

const DELIVERY_CHALLAN_INCLUDE = {
  deliveryChallan: { select: { id: true, challanNumber: true } },
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

type SalesInvoiceListRowRaw = Prisma.SalesInvoiceGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof SALES_ORDER_INCLUDE & typeof DELIVERY_CHALLAN_INCLUDE;
}>;
type SalesInvoiceDetailRaw = Prisma.SalesInvoiceGetPayload<{
  include: typeof CUSTOMER_INCLUDE &
    typeof SALES_ORDER_INCLUDE &
    typeof DELIVERY_CHALLAN_INCLUDE &
    typeof ITEM_INCLUDE &
    typeof PAYMENT_INCLUDE;
}>;

const SALES_INVOICE_ITEM_DECIMAL_FIELDS = [
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

const SALES_INVOICE_ITEM_NULLABLE_DECIMAL_FIELDS = [
  "overriddenCgst",
  "overriddenSgst",
  "overriddenIgst",
  "overriddenCess",
] as const;

const SALES_INVOICE_DECIMAL_FIELDS = [
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
// sales-order-repository.ts convention, extended with a second pass for the
// nullable overridden* item columns (null stays null).
function toCustomerOption(
  raw: { id: string; isActive: boolean; creditLimit: Prisma.Decimal | null; ledger: { name: string } } | null
): SalesInvoiceCustomerOption | null {
  if (!raw) {
    return null;
  }
  return {
    id: raw.id,
    name: raw.ledger.name,
    isActive: raw.isActive,
    creditLimit: raw.creditLimit ? raw.creditLimit.toNumber() : null,
  };
}

function toSalesInvoiceListRow(raw: SalesInvoiceListRowRaw): SalesInvoiceListRow {
  const { customer, salesOrder, deliveryChallan, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of SALES_INVOICE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  return {
    ...(normalizedHeader as unknown as SalesInvoiceListRow),
    customer: toCustomerOption(customer),
    salesOrder,
    deliveryChallan,
  };
}

function toSalesInvoiceDetail(raw: SalesInvoiceDetailRaw): SalesInvoiceDetail {
  const { customer, salesOrder, deliveryChallan, items, payments, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of SALES_INVOICE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row order
  // (sales-order-repository.ts's identical note).
  const normalizedItems: SalesInvoiceItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of SALES_INVOICE_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      for (const field of SALES_INVOICE_ITEM_NULLABLE_DECIMAL_FIELDS) {
        const value = (item as unknown as Record<string, Prisma.Decimal | null>)[field];
        line[field] = value ? value.toNumber() : null;
      }
      return { ...(line as unknown as SalesInvoiceItemDetail), product: item.product, warehouse: item.warehouse };
    });

  const normalizedPayments = payments.map((payment) => ({
    ...payment,
    amount: payment.amount.toNumber(),
    ledger: payment.ledger,
  }));

  return {
    ...(normalizedHeader as unknown as SalesInvoiceDetail),
    customer: toCustomerOption(customer),
    salesOrder,
    deliveryChallan,
    items: normalizedItems,
    payments: normalizedPayments,
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: SalesInvoiceListFilters
): Prisma.SalesInvoiceWhereInput {
  const where: Prisma.SalesInvoiceWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.customerId) {
    where.customerId = filters.customerId;
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
      { customer: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
      { quickCustomerName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export interface SalesInvoiceLinePersistData {
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

export interface SalesInvoiceHeaderPersistData {
  customerMode: "PERMANENT" | "QUICK" | "WALK_IN";
  customerId: string | null;
  quickCustomerName: string | null;
  quickCustomerMobile: string | null;
  quickCustomerGstin: string | null;
  quickCustomerAddress: string | null;
  invoiceDate: Date;
  placeOfSupplyStateCode: string;
  narration: string | null;
  salesOrderId: string | null;
  deliveryChallanId: string | null;
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

export interface SalesInvoicePaymentPersistData {
  ledgerId: string;
  amount: number;
  reference: string | null;
}

export const salesInvoiceRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: SalesInvoiceListFilters = {}
  ): Promise<SalesInvoiceListRow[]> {
    const rows = await prisma.salesInvoice.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, ...DELIVERY_CHALLAN_INCLUDE },
      orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
    });
    return rows.map(toSalesInvoiceListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<SalesInvoiceDetail | null> {
    const row = await client.salesInvoice.findUnique({
      where: { id },
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, ...DELIVERY_CHALLAN_INCLUDE, ...ITEM_INCLUDE, ...PAYMENT_INCLUDE },
    });
    return row ? toSalesInvoiceDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: SalesInvoiceHeaderPersistData,
    lines: SalesInvoiceLinePersistData[],
    payments: SalesInvoicePaymentPersistData[],
    generated: GeneratedNumber,
    createdByUserId: string
  ): Promise<SalesInvoiceDetail> {
    const created = await tx.salesInvoice.create({
      data: {
        companyId,
        financialYearId,
        invoiceNumber: generated.formatted,
        createdByUserId,
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
        payments: { create: payments },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, ...DELIVERY_CHALLAN_INCLUDE, ...ITEM_INCLUDE, ...PAYMENT_INCLUDE },
    });
    return toSalesInvoiceDetail(created);
  },

  /**
   * Delete-all-then-recreate the line AND payment sets inside the caller's
   * transaction — mirrors sales-order-repository.ts's replaceItemsAndUpdate,
   * extended with payments (this document's own addition).
   * `invoiceNumber` is never touched here (edit never regenerates it). The
   * `allowedStatuses` guard is re-checked atomically here so a concurrent
   * status transition landing between the service's own check and this
   * write loses cleanly.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly SalesInvoiceStatus[],
    header: SalesInvoiceHeaderPersistData,
    lines: SalesInvoiceLinePersistData[],
    payments: SalesInvoicePaymentPersistData[]
  ): Promise<SalesInvoiceDetail | null> {
    const existing = await tx.salesInvoice.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.salesInvoiceItem.deleteMany({ where: { salesInvoiceId: id } });
    await tx.salesInvoicePayment.deleteMany({ where: { salesInvoiceId: id } });
    const updated = await tx.salesInvoice.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
        payments: { create: payments },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, ...DELIVERY_CHALLAN_INCLUDE, ...ITEM_INCLUDE, ...PAYMENT_INCLUDE },
    });
    return toSalesInvoiceDetail(updated);
  },

  /**
   * Posting's own write (38-sales-invoice.md's step 3 + step 10 combined):
   * replaces the line/payment sets with the freshly-recomputed persist data
   * (never trusting stale draft totals), updates every header total plus
   * `customerId`/`customerMode` (for a just-converted Quick Customer) and
   * `voucherId`, and flips `status` to `POSTED` — all atomically, guarded by
   * `WHERE status = 'DRAFT'` so a concurrent status change loses cleanly.
   */
  async replaceItemsAndPost(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    header: SalesInvoiceHeaderPersistData,
    lines: SalesInvoiceLinePersistData[],
    payments: SalesInvoicePaymentPersistData[],
    voucherId: string
  ): Promise<SalesInvoiceDetail | null> {
    const existing = await tx.salesInvoice.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.salesInvoiceItem.deleteMany({ where: { salesInvoiceId: id } });
    await tx.salesInvoicePayment.deleteMany({ where: { salesInvoiceId: id } });
    const updated = await tx.salesInvoice.update({
      where: { id },
      data: {
        ...header,
        voucherId,
        status: "POSTED",
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
        payments: { create: payments },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, ...DELIVERY_CHALLAN_INCLUDE, ...ITEM_INCLUDE, ...PAYMENT_INCLUDE },
    });
    return toSalesInvoiceDetail(updated);
  },

  /**
   * Guarded status transition: only succeeds when the row's current status
   * is still one of `from` at write time — mirrors
   * sales-order-repository.ts's updateStatus exactly. The only user-facing
   * transition this drives is Cancel (`POSTED -> CANCELLED`); Post uses
   * `replaceItemsAndPost` above since it also rewrites totals/lines.
   */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly SalesInvoiceStatus[],
    to: SalesInvoiceStatus
  ): Promise<number> {
    const result = await client.salesInvoice.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  async findCustomerForInvoice(
    client: PrismaClientOrTransaction,
    companyId: string,
    customerId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean; ledgerId: string; creditLimit: number | null } | null> {
    const customer = await client.customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true, isActive: true, ledgerId: true, creditLimit: true },
    });
    if (!customer || customer.companyId !== companyId) {
      return null;
    }
    return { ...customer, creditLimit: customer.creditLimit ? customer.creditLimit.toNumber() : null };
  },

  /** The product picker's options — mirrors sales-order-repository.ts's
   * findOrderableProducts exactly. */
  async findInvoiceableProducts(companyId: string): Promise<SalesInvoiceProductOption[]> {
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

  /** Batched lookup for every distinct productId referenced by a
   * create/update/post payload — mirrors sales-order-repository.ts's
   * findProductsForLines exactly. */
  async findProductsForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<SalesInvoiceProductOption[]> {
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
};
