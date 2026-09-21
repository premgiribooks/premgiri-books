import { Prisma, type SalesInvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  ItemWiseSalesAggregateRow,
  ItemWiseSalesFilters,
  PartyWiseSalesAggregateRow,
  PartyWiseSalesFilters,
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
    select: {
      id: true,
      isActive: true,
      creditLimit: true,
      ledgerId: true,
      ledger: { select: { name: true } },
      // gstin/address: needed by the printed PDF's "Bill To" block for a
      // PERMANENT customer (78-pdf-generation.md) — not previously
      // selected since no prior reader needed them.
      gstin: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      pinCode: true,
    },
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
      product: {
        select: {
          id: true,
          name: true,
          productCode: true,
          isActive: true,
          // unit/hsnCode: needed by the printed PDF's item table (a Tax
          // Invoice must show each line's HSN/SAC code and unit) — mirrors
          // quotation-repository.ts's/sales-order-repository.ts's identical
          // select shape.
          unit: { select: { symbol: true } },
          hsnCode: { select: { code: true } },
        },
      },
      // The FIFO auto-allocator's own persisted breakdown (see
      // SalesInvoiceItemWarehouseAllocation's own schema comment) — empty on
      // a DRAFT line, one-or-more rows once posted.
      warehouseAllocations: {
        select: { warehouseId: true, quantity: true, warehouse: { select: { name: true } } },
      },
    },
  },
} as const;

const PAYMENT_INCLUDE = {
  payments: { include: { ledger: { select: { id: true, name: true } }, paymentMode: { select: { id: true, name: true } } } },
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
  raw: {
    id: string;
    isActive: boolean;
    creditLimit: Prisma.Decimal | null;
    ledgerId: string;
    ledger: { name: string };
    gstin: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    pinCode: string | null;
  } | null
): SalesInvoiceCustomerOption | null {
  if (!raw) {
    return null;
  }
  return {
    id: raw.id,
    name: raw.ledger.name,
    isActive: raw.isActive,
    creditLimit: raw.creditLimit ? raw.creditLimit.toNumber() : null,
    ledgerId: raw.ledgerId,
    gstin: raw.gstin,
    addressLine1: raw.addressLine1,
    addressLine2: raw.addressLine2,
    city: raw.city,
    state: raw.state,
    pinCode: raw.pinCode,
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
      return {
        ...(line as unknown as SalesInvoiceItemDetail),
        product: {
          id: item.product.id,
          name: item.product.name,
          productCode: item.product.productCode,
          isActive: item.product.isActive,
          unitSymbol: item.product.unit.symbol,
          hsnCode: item.product.hsnCode?.code ?? null,
        },
        warehouseAllocations: item.warehouseAllocations.map((allocation) => ({
          warehouseId: allocation.warehouseId,
          warehouseName: allocation.warehouse.name,
          quantity: allocation.quantity.toNumber(),
        })),
      };
    });

  const normalizedPayments = payments.map((payment) => ({
    ...payment,
    amount: payment.amount.toNumber(),
    ledger: payment.ledger,
    paymentMode: payment.paymentMode,
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

/** One resolved warehouse allocation to persist alongside its own line —
 * see SalesInvoiceItemWarehouseAllocation's schema comment. Empty at DRAFT
 * time (nothing has moved yet); populated by postSalesInvoice from the
 * Inventory Engine's own FIFO resolution just before this same line's stock
 * actually moves. */
export interface SalesInvoiceLineWarehouseAllocationPersistData {
  warehouseId: string;
  quantity: number;
}

export interface SalesInvoiceLinePersistData {
  productId: string;
  warehouseAllocations: SalesInvoiceLineWarehouseAllocationPersistData[];
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
  paymentModeId: string;
  amount: number;
  reference: string | null;
}

/** Shapes one persisted line for `items: { create: [...] }` — pulled out
 * because `warehouseAllocations` is itself a nested relation (needs its own
 * `{ create: [...] }`), not a plain scalar that a flat `...line` spread can
 * carry, unlike every other field on `SalesInvoiceLinePersistData`. Shared
 * by `create`/`replaceItemsAndUpdate`/`replaceItemsAndPost` so this shape
 * exists in exactly one place. */
function toItemCreateData(line: SalesInvoiceLinePersistData, index: number) {
  const { warehouseAllocations, ...rest } = line;
  return { ...rest, lineNumber: index + 1, warehouseAllocations: { create: warehouseAllocations } };
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
          create: lines.map(toItemCreateData),
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
        items: { create: lines.map(toItemCreateData) },
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
        items: { create: lines.map(toItemCreateData) },
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

  async findCompanyStateCode(companyId: string): Promise<string | null> {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { stateCode: true } });
    return company?.stateCode ?? null;
  },

  /**
   * 68-sales-reports.md's Item-wise Sales Report — groups every `POSTED`
   * SalesInvoiceItem row (joined through its parent invoice for the
   * date/customer scoping) by `productId`, summing quantity/taxable/tax/
   * total. Prisma's `groupBy` has no "count distinct salesInvoiceId" option,
   * so a second, narrow query fetches just the (productId, salesInvoiceId)
   * pairs the where clause matches, and the invoice count is the size of
   * each product's own distinct-id Set — never approximated by row count,
   * which would over-count a product billed twice on one invoice. One
   * batched `product.findMany` resolves every group's name/code, matching
   * this codebase's "no query inside the grouping loop" convention
   * (hsn-summary-service.ts's own precedent).
   */
  async aggregateItemWiseSales(
    companyId: string,
    financialYearId: string,
    filters: ItemWiseSalesFilters
  ): Promise<ItemWiseSalesAggregateRow[]> {
    const where: Prisma.SalesInvoiceItemWhereInput = {
      salesInvoice: {
        companyId,
        financialYearId,
        status: "POSTED",
        invoiceDate: { gte: filters.fromDate, lte: filters.toDate },
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
      },
      ...(filters.productId ? { productId: filters.productId } : {}),
      // A line has no single warehouseId any more (it can be fulfilled from
      // more than one) — matches a line if ANY of its resolved allocations
      // is at the requested warehouse.
      ...(filters.warehouseId ? { warehouseAllocations: { some: { warehouseId: filters.warehouseId } } } : {}),
    };

    const grouped = await prisma.salesInvoiceItem.groupBy({
      by: ["productId"],
      where,
      _sum: { quantity: true, taxableAmount: true, cgst: true, sgst: true, igst: true, cess: true, totalAmount: true },
    });
    if (grouped.length === 0) {
      return [];
    }

    const [pairs, products] = await Promise.all([
      prisma.salesInvoiceItem.findMany({ where, select: { productId: true, salesInvoiceId: true } }),
      prisma.product.findMany({
        where: { id: { in: grouped.map((row) => row.productId) }, companyId },
        select: { id: true, name: true, productCode: true },
      }),
    ]);

    const invoiceIdsByProduct = new Map<string, Set<string>>();
    for (const pair of pairs) {
      const set = invoiceIdsByProduct.get(pair.productId) ?? new Set<string>();
      set.add(pair.salesInvoiceId);
      invoiceIdsByProduct.set(pair.productId, set);
    }
    const productById = new Map(products.map((product) => [product.id, product]));

    return grouped.map((row) => {
      const product = productById.get(row.productId);
      return {
        productId: row.productId,
        productName: product?.name ?? "Unknown product",
        productCode: product?.productCode ?? "",
        quantity: row._sum.quantity?.toNumber() ?? 0,
        taxableAmount: row._sum.taxableAmount?.toNumber() ?? 0,
        cgst: row._sum.cgst?.toNumber() ?? 0,
        sgst: row._sum.sgst?.toNumber() ?? 0,
        igst: row._sum.igst?.toNumber() ?? 0,
        cess: row._sum.cess?.toNumber() ?? 0,
        totalAmount: row._sum.totalAmount?.toNumber() ?? 0,
        invoiceCount: invoiceIdsByProduct.get(row.productId)?.size ?? 0,
      };
    });
  },

  /**
   * 68-sales-reports.md's Party-wise Sales Summary — groups every `POSTED`
   * invoice by `(customerId, customerMode)`. A non-null `customerId` always
   * carries `customerMode: "PERMANENT"` (a QUICK invoice converts to
   * PERMANENT before it can ever receive a `customerId` — see
   * sales-invoice-service.ts's `convertQuickCustomer`), so grouping by the
   * pair rather than `customerId` alone still yields exactly one row per
   * real customer while cleanly separating the two `customerId: null`
   * buckets (WALK_IN vs. unconverted QUICK) from each other. Assigning the
   * synthetic buckets' own display labels/`groupType` is the Reporting
   * Engine's job, not this repository's (see sales-reports.ts).
   */
  async aggregatePartyWiseSales(
    companyId: string,
    financialYearId: string,
    filters: PartyWiseSalesFilters
  ): Promise<PartyWiseSalesAggregateRow[]> {
    const where: Prisma.SalesInvoiceWhereInput = {
      companyId,
      financialYearId,
      status: "POSTED",
      invoiceDate: { gte: filters.fromDate, lte: filters.toDate },
    };

    const grouped = await prisma.salesInvoice.groupBy({
      by: ["customerId", "customerMode"],
      where,
      _sum: { taxableAmount: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true, grandTotal: true },
      _count: { _all: true },
    });
    if (grouped.length === 0) {
      return [];
    }

    const customerIds = grouped.map((row) => row.customerId).filter((id): id is string => id !== null);
    const customers = customerIds.length
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds }, companyId },
          select: { id: true, ledger: { select: { name: true } } },
        })
      : [];
    const nameByCustomerId = new Map(customers.map((customer) => [customer.id, customer.ledger.name]));

    return grouped.map((row) => ({
      customerId: row.customerId,
      customerMode: row.customerMode,
      customerName: row.customerId ? (nameByCustomerId.get(row.customerId) ?? "Unknown customer") : null,
      invoiceCount: row._count._all,
      taxableAmount: row._sum.taxableAmount?.toNumber() ?? 0,
      cgst: row._sum.totalCgst?.toNumber() ?? 0,
      sgst: row._sum.totalSgst?.toNumber() ?? 0,
      igst: row._sum.totalIgst?.toNumber() ?? 0,
      cess: row._sum.totalCess?.toNumber() ?? 0,
      grandTotal: row._sum.grandTotal?.toNumber() ?? 0,
    }));
  },
};
