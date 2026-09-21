import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildItemWisePurchaseReport,
  buildPartyWisePurchaseReport,
  buildPurchaseRegister,
  buildPurchaseReturnSummary,
} from "@/engines/reporting/purchase-reports";
import {
  itemWisePurchaseFiltersSchema,
  partyWisePurchaseFiltersSchema,
  purchaseRegisterFiltersSchema,
  purchaseReturnSummaryFiltersSchema,
  toUtcDate,
  type ItemWisePurchaseFiltersInput,
  type PartyWisePurchaseFiltersInput,
  type PurchaseRegisterFiltersInput,
  type PurchaseReturnSummaryFiltersInput,
} from "@/modules/reports/purchase/validation/purchase-report-schema";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";
import { purchaseReturnService } from "@/modules/purchase-returns/services/purchase-return-service";
import type {
  ItemWisePurchaseReport,
  PartyWisePurchaseReport,
  PurchaseRegisterReport,
  PurchaseReturnSummaryReport,
} from "@/types/purchase-report";

/**
 * 69-purchase-reports.md's Purchase Reports module — the layer every Server
 * Action/page in this spec calls. Mirrors
 * src/modules/reports/sales/services/sales-report-service.ts exactly. Gates
 * every one of its four public methods on `reports`/`view` (this spec's own
 * Security section), then delegates the actual read to the owning
 * Purchase-module service's own report-scoped methods
 * (`listPurchaseInvoicesForReport`/`listPurchaseReturnsForReport`/
 * `getItemWisePurchaseReport`/`getPartyWisePurchaseReport` — all four gated
 * on `reports`/`view` themselves, not `purchase`/`view`, so the seeded
 * Accountant role can reach every view in this module), and hands the
 * result to the Reporting Engine (purchase-reports.ts) for shaping. This
 * module owns no table of its own (Data Model) — the one direct Prisma use
 * below (the three filter-bar option lookups) is a read-only lookup, the
 * same posture sales-report-service.ts's own `listCustomerOptions` takes,
 * never a business read routed around the owning Purchase-module services
 * above.
 */
export const purchaseReportService = {
  async getPurchaseRegister(rawFilters: PurchaseRegisterFiltersInput): Promise<PurchaseRegisterReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = purchaseRegisterFiltersSchema.parse(rawFilters);
    const rows = await purchaseInvoiceService.listPurchaseInvoicesForReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
      supplierId: filters.supplierId,
      status: filters.status,
    });
    return buildPurchaseRegister(rows);
  },

  async getItemWisePurchaseReport(rawFilters: ItemWisePurchaseFiltersInput): Promise<ItemWisePurchaseReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = itemWisePurchaseFiltersSchema.parse(rawFilters);
    const rawRows = await purchaseInvoiceService.getItemWisePurchaseReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
      productId: filters.productId,
      warehouseId: filters.warehouseId,
      supplierId: filters.supplierId,
    });
    return buildItemWisePurchaseReport(rawRows);
  },

  async getPartyWisePurchaseReport(rawFilters: PartyWisePurchaseFiltersInput): Promise<PartyWisePurchaseReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = partyWisePurchaseFiltersSchema.parse(rawFilters);
    const rawRows = await purchaseInvoiceService.getPartyWisePurchaseReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
    });
    return buildPartyWisePurchaseReport(rawRows);
  },

  async getPurchaseReturnSummary(rawFilters: PurchaseReturnSummaryFiltersInput): Promise<PurchaseReturnSummaryReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = purchaseReturnSummaryFiltersSchema.parse(rawFilters);
    const rows = await purchaseReturnService.listPurchaseReturnsForReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
      status: filters.status,
    });
    return buildPurchaseReturnSummary(rows, filters.supplierId);
  },

  /**
   * The filter bar's supplier/product/warehouse dropdown options. Queries
   * Prisma directly rather than calling a `masters`/`view`-gated service
   * method — mirrors sales-report-service.ts's own `listCustomerOptions`
   * precedent: the seeded Accountant role has `reports:view` but not
   * `masters:view`, so routing these option lookups through those services
   * would 403 exactly the role this module's own permission gate exists to
   * admit.
   */
  async listSupplierOptions(): Promise<{ id: string; name: string }[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const suppliers = await prisma.supplier.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, ledger: { select: { name: true } } },
      orderBy: { ledger: { name: "asc" } },
    });
    return suppliers.map((supplier) => ({ id: supplier.id, name: supplier.ledger.name }));
  },

  /** Item-wise Purchase Report's own Product filter options. */
  async listProductOptions(): Promise<{ id: string; name: string; productCode: string | null }[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const products = await prisma.product.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, name: true, productCode: true },
      orderBy: { name: "asc" },
    });
    return products;
  },

  /** Item-wise Purchase Report's own Warehouse filter options. */
  async listWarehouseOptions(): Promise<{ id: string; name: string }[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const warehouses = await prisma.warehouse.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return warehouses;
  },
};
