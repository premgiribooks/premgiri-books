import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import {
  buildCurrentStockReport,
  buildLowStockReport,
  buildStockLedgerReport,
  buildStockValuationReport,
} from "@/engines/reporting/inventory-reports";
import {
  currentStockFiltersSchema,
  lowStockFiltersSchema,
  stockLedgerFiltersSchema,
  stockValuationFiltersSchema,
  toUtcDate,
  type CurrentStockFiltersInput,
  type LowStockFiltersInput,
  type StockLedgerFiltersInput,
  type StockValuationFiltersInput,
} from "@/modules/reports/inventory/validation/inventory-report-schema";
import type {
  CurrentStockReport,
  InventoryReportProductOption,
  InventoryReportWarehouseOption,
  LowStockReport,
  StockLedgerReport,
  StockValuationReport,
} from "@/types/inventory-report";

/**
 * 70-inventory-reports.md's Inventory Reports module — the layer every
 * Server Component page in this spec calls. Gates every public method on
 * `reports`/`view`, then delegates the actual stock read to
 * `inventoryEngine`'s own getCurrentStock/getStockLedger/getStockValuation,
 * handing the result to the Reporting Engine (inventory-reports.ts) for
 * shaping. This module owns no table of its own (Data Model) — the direct
 * Prisma reads below are read-only lookups for Product/Warehouse display
 * data and filter-bar options, mirroring purchase-report-service.ts's own
 * listProductOptions/listWarehouseOptions precedent (see
 * listReportProducts's own doc comment for why these bypass
 * productService/warehouseService).
 */

/** Every known document referenceType the Stock Ledger's reference-label resolution can look up a real document number for (70-inventory-reports.md's Business Rules #2). */
const DOCUMENT_NUMBER_LOOKUPS: Record<
  string,
  (companyId: string, ids: readonly string[]) => Promise<{ id: string; number: string | null }[]>
> = {
  SALES_INVOICE: (companyId, ids) =>
    prisma.salesInvoice
      .findMany({ where: { companyId, id: { in: [...ids] } }, select: { id: true, invoiceNumber: true } })
      .then((rows) => rows.map((row) => ({ id: row.id, number: row.invoiceNumber }))),
  PURCHASE_INVOICE: (companyId, ids) =>
    prisma.purchaseInvoice
      .findMany({ where: { companyId, id: { in: [...ids] } }, select: { id: true, invoiceNumber: true } })
      .then((rows) => rows.map((row) => ({ id: row.id, number: row.invoiceNumber }))),
  SALES_RETURN: (companyId, ids) =>
    prisma.salesReturn
      .findMany({ where: { companyId, id: { in: [...ids] } }, select: { id: true, returnNumber: true } })
      .then((rows) => rows.map((row) => ({ id: row.id, number: row.returnNumber }))),
  PURCHASE_RETURN: (companyId, ids) =>
    prisma.purchaseReturn
      .findMany({ where: { companyId, id: { in: [...ids] } }, select: { id: true, returnNumber: true } })
      .then((rows) => rows.map((row) => ({ id: row.id, number: row.returnNumber }))),
  CREDIT_NOTE: (companyId, ids) =>
    prisma.creditNote
      .findMany({ where: { companyId, id: { in: [...ids] } }, select: { id: true, noteNumber: true } })
      .then((rows) => rows.map((row) => ({ id: row.id, number: row.noteNumber }))),
  DEBIT_NOTE: (companyId, ids) =>
    prisma.debitNote
      .findMany({ where: { companyId, id: { in: [...ids] } }, select: { id: true, noteNumber: true } })
      .then((rows) => rows.map((row) => ({ id: row.id, number: row.noteNumber }))),
};

/** One batched lookup per distinct known referenceType present in `lines` — never one query per line. */
async function resolveDocumentNumbers(
  companyId: string,
  lines: readonly { referenceType: string | null; referenceId: string | null }[]
): Promise<Map<string, string>> {
  const idsByType = new Map<string, Set<string>>();
  for (const line of lines) {
    if (line.referenceType && line.referenceId && DOCUMENT_NUMBER_LOOKUPS[line.referenceType]) {
      const ids = idsByType.get(line.referenceType) ?? new Set<string>();
      ids.add(line.referenceId);
      idsByType.set(line.referenceType, ids);
    }
  }

  const documentNumberByKey = new Map<string, string>();
  await Promise.all(
    [...idsByType.entries()].map(async ([referenceType, ids]) => {
      const rows = await DOCUMENT_NUMBER_LOOKUPS[referenceType](companyId, [...ids]);
      for (const row of rows) {
        if (row.number) {
          documentNumberByKey.set(`${referenceType}:${row.id}`, row.number);
        }
      }
    })
  );
  return documentNumberByKey;
}

/**
 * Every TRADING product for the caller's own company, active or not —
 * queried directly rather than through `productService.listSelectableProducts()`
 * (this spec's own literal suggestion): the seeded Accountant role has
 * `reports:view` but not `masters:view`, so routing this read through that
 * masters-gated service would 403 exactly the role this module exists to
 * serve — the same precedent purchase-report-service.ts's own
 * listProductOptions/listWarehouseOptions already established for this
 * batch of reports. Used both as the join data every report builder needs
 * (name/productCode/minStockLevel) and, filtered to active only, as this
 * module's own filter-bar options.
 */
async function listReportProducts(companyId: string): Promise<InventoryReportProductOption[]> {
  const products = await prisma.product.findMany({
    where: { companyId, productType: "TRADING" },
    select: {
      id: true,
      name: true,
      productCode: true,
      isActive: true,
      minStockLevel: true,
      unit: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    productCode: product.productCode,
    unitName: product.unit.name,
    isActive: product.isActive,
    minStockLevel: product.minStockLevel === null ? null : product.minStockLevel.toNumber(),
  }));
}

/** Every Warehouse for the caller's own company, active or not — same reasoning as listReportProducts. */
async function listReportWarehouses(companyId: string): Promise<InventoryReportWarehouseOption[]> {
  return prisma.warehouse.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export const inventoryReportService = {
  async getCurrentStockReport(rawFilters: CurrentStockFiltersInput): Promise<CurrentStockReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = currentStockFiltersSchema.parse(rawFilters);
    const [stockRows, products, warehouses] = await Promise.all([
      inventoryEngine.getCurrentStock(user.companyId, { productId: filters.productId, warehouseId: filters.warehouseId }),
      listReportProducts(user.companyId),
      listReportWarehouses(user.companyId),
    ]);

    return buildCurrentStockReport(stockRows, products, warehouses, {
      warehouseId: filters.warehouseId,
      includeZeroStock: filters.includeZeroStock,
    });
  },

  async getStockLedgerReport(rawFilters: StockLedgerFiltersInput): Promise<StockLedgerReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = stockLedgerFiltersSchema.parse(rawFilters);
    const [ledgerResult, products, warehouses] = await Promise.all([
      inventoryEngine.getStockLedger(user.companyId, filters.productId, {
        warehouseId: filters.warehouseId,
        from: filters.dateFrom ? toUtcDate(filters.dateFrom) : undefined,
        to: filters.dateTo ? toUtcDate(filters.dateTo) : undefined,
      }),
      listReportProducts(user.companyId),
      listReportWarehouses(user.companyId),
    ]);

    const productName = products.find((product) => product.id === filters.productId)?.name ?? "Unknown Product";
    const documentNumberByKey = await resolveDocumentNumbers(user.companyId, ledgerResult.lines);

    return buildStockLedgerReport(ledgerResult, productName, warehouses, documentNumberByKey);
  },

  async getStockValuationReport(rawFilters: StockValuationFiltersInput): Promise<StockValuationReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = stockValuationFiltersSchema.parse(rawFilters);
    const [valuation, products] = await Promise.all([
      inventoryEngine.getStockValuation(user.companyId, { warehouseId: filters.warehouseId }),
      listReportProducts(user.companyId),
    ]);

    const productCodeById = new Map(products.map((product) => [product.id, product.productCode]));
    return buildStockValuationReport(valuation, productCodeById);
  },

  async getLowStockReport(rawFilters: LowStockFiltersInput): Promise<LowStockReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = lowStockFiltersSchema.parse(rawFilters);
    const [stockRows, products, warehouses] = await Promise.all([
      inventoryEngine.getCurrentStock(user.companyId, { warehouseId: filters.warehouseId }),
      listReportProducts(user.companyId),
      listReportWarehouses(user.companyId),
    ]);

    return buildLowStockReport(stockRows, products, warehouses, { warehouseId: filters.warehouseId });
  },

  /** The Stock Ledger view's own required product picker. */
  async listProductOptions(): Promise<{ id: string; name: string; productCode: string | null }[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const products = await listReportProducts(user.companyId);
    return products
      .filter((product) => product.isActive)
      .map((product) => ({ id: product.id, name: product.name, productCode: product.productCode }));
  },

  async listWarehouseOptions(): Promise<{ id: string; name: string }[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    return prisma.warehouse.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  },
};
