import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildItemWiseSalesReport,
  buildPartyWiseSalesReport,
  buildSalesRegister,
  buildSalesReturnSummary,
} from "@/engines/reporting/sales-reports";
import {
  itemWiseSalesFiltersSchema,
  partyWiseSalesFiltersSchema,
  salesRegisterFiltersSchema,
  salesReturnSummaryFiltersSchema,
  toUtcDate,
  type ItemWiseSalesFiltersInput,
  type PartyWiseSalesFiltersInput,
  type SalesRegisterFiltersInput,
  type SalesReturnSummaryFiltersInput,
} from "@/modules/reports/sales/validation/sales-report-schema";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";
import { salesReturnService } from "@/modules/sales-returns/services/sales-return-service";
import type { ItemWiseSalesReport, PartyWiseSalesReport, SalesRegisterReport, SalesReturnSummaryReport } from "@/types/sales-report";

/**
 * 68-sales-reports.md's Sales Reports module — the layer every Server
 * Action/page in this spec calls. Gates every one of its four public
 * methods on `reports`/`view` (this spec's own Security section), then
 * delegates the actual read to the owning Sales-module service's own
 * report-scoped methods (`listSalesInvoicesForReport`/
 * `listSalesReturnsForReport`/`getItemWiseSalesReport`/
 * `getPartyWiseSalesReport` — all four gated on `reports`/`view`
 * themselves, not `sales`/`view`, so the seeded Accountant role can reach
 * every view in this module), and hands the result to the Reporting Engine
 * (sales-reports.ts) for shaping. This module owns no table of its own
 * (Data Model) — the one direct Prisma use below (the three filter-bar
 * option lookups) is a read-only lookup, the same posture
 * gst-register-service.ts's own `listPartyOptions` takes, never a business
 * read routed around the owning Sales-module services above.
 */
export const salesReportService = {
  async getSalesRegister(rawFilters: SalesRegisterFiltersInput): Promise<SalesRegisterReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = salesRegisterFiltersSchema.parse(rawFilters);
    const rows = await salesInvoiceService.listSalesInvoicesForReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
      customerId: filters.customerId,
      status: filters.status,
    });
    return buildSalesRegister(rows);
  },

  async getItemWiseSalesReport(rawFilters: ItemWiseSalesFiltersInput): Promise<ItemWiseSalesReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = itemWiseSalesFiltersSchema.parse(rawFilters);
    const rawRows = await salesInvoiceService.getItemWiseSalesReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
      productId: filters.productId,
      warehouseId: filters.warehouseId,
      customerId: filters.customerId,
    });
    return buildItemWiseSalesReport(rawRows);
  },

  async getPartyWiseSalesReport(rawFilters: PartyWiseSalesFiltersInput): Promise<PartyWiseSalesReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = partyWiseSalesFiltersSchema.parse(rawFilters);
    const rawRows = await salesInvoiceService.getPartyWiseSalesReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
    });
    return buildPartyWiseSalesReport(rawRows);
  },

  async getSalesReturnSummary(rawFilters: SalesReturnSummaryFiltersInput): Promise<SalesReturnSummaryReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = salesReturnSummaryFiltersSchema.parse(rawFilters);
    const rows = await salesReturnService.listSalesReturnsForReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
      status: filters.status,
    });
    return buildSalesReturnSummary(rows, filters.customerId);
  },

  /**
   * The filter bar's customer/product/warehouse dropdown options. Queries
   * Prisma directly rather than calling customerService.listSelectableCustomers()/
   * productService.listSelectableProducts()/warehouseService.listSelectableWarehouses()
   * (all three gated on `masters`/`view`) — mirrors
   * gst-register-service.ts's own `listPartyOptions` precedent: the seeded
   * Accountant role has `reports:view` but not `masters:view`, so routing
   * these option lookups through those services would 403 exactly the role
   * this module's own permission gate exists to admit.
   */
  async listCustomerOptions(): Promise<{ id: string; name: string }[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const customers = await prisma.customer.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, ledger: { select: { name: true } } },
      orderBy: { ledger: { name: "asc" } },
    });
    return customers.map((customer) => ({ id: customer.id, name: customer.ledger.name }));
  },

  /** Item-wise Sales Report's own Product filter options. */
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

  /** Item-wise Sales Report's own Warehouse filter options. */
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
