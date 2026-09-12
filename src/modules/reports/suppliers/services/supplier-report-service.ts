import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildSupplierDirectory,
  buildSupplierOutstandingReport,
  buildSupplierPurchaseSummary,
  buildSupplierStatement,
} from "@/engines/reporting/supplier-reports";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";
import {
  supplierDirectoryFiltersSchema,
  supplierOutstandingFiltersSchema,
  supplierPurchaseSummaryFiltersSchema,
  supplierStatementFiltersSchema,
  toUtcDate,
  type SupplierDirectoryFiltersInput,
  type SupplierOutstandingFiltersInput,
  type SupplierPurchaseSummaryFiltersInput,
  type SupplierStatementFiltersInput,
} from "@/modules/reports/suppliers/validation/supplier-report-schema";
import type {
  SupplierDirectoryReport,
  SupplierOutstandingReport,
  SupplierReportRow,
  SupplierStatementReport,
} from "@/types/supplier-report";
import type { PartyWisePurchaseReport } from "@/types/purchase-report";

/**
 * 72-supplier-reports.md's Supplier Reports module — the layer every Server
 * Component page in this spec calls. Gates every public method on
 * `reports`/`view`, then delegates the actual read to
 * `voucherQueries.getTrialBalance`/`getLedgerStatement` (spec 31, unmodified)
 * and `purchaseInvoiceService.getPartyWisePurchaseReport` (spec 69,
 * unmodified), handing the result to the Reporting Engine
 * (supplier-reports.ts) for shaping. This module owns no table of its own
 * (Data Model) — the direct Prisma reads below are read-only Supplier/Ledger
 * lookups, mirroring customer-report-service.ts's own listReportCustomers
 * precedent (see listReportSuppliers's own doc comment for why this bypasses
 * supplierService).
 */

/**
 * Every Supplier for the caller's own company, matching `filters` —
 * queried directly rather than through `supplierService.listSuppliers()`
 * (this spec's own literal suggestion): the seeded Accountant role has
 * `reports:view` but not `masters:view`, so routing this read through that
 * masters-gated service would 403 exactly the role this module exists to
 * serve — the same precedent every other report service in this batch
 * (purchase/sales/inventory/customer) already established for its own filter-bar
 * options and join data.
 */
async function listReportSuppliers(
  companyId: string,
  filters: { status?: "all" | "active" | "inactive" } = {}
): Promise<SupplierReportRow[]> {
  const where: Prisma.SupplierWhereInput = { companyId };
  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    select: {
      id: true,
      mobileNumber: true,
      gstin: true,
      city: true,
      state: true,
      isActive: true,
      ledgerId: true,
      creditDays: true,
      ledger: { select: { name: true, openingBalance: true, openingBalanceType: true } },
    },
    orderBy: { ledger: { name: "asc" } },
  });

  return suppliers.map((supplier) => ({
    id: supplier.id,
    displayName: supplier.ledger.name,
    mobileNumber: supplier.mobileNumber,
    gstin: supplier.gstin,
    city: supplier.city,
    state: supplier.state,
    isActive: supplier.isActive,
    ledgerId: supplier.ledgerId,
    creditDays: supplier.creditDays,
    openingBalance: supplier.ledger.openingBalance.toNumber(),
    openingBalanceType: supplier.ledger.openingBalanceType,
  }));
}

export const supplierReportService = {
  async getSupplierOutstandingReport(rawFilters: SupplierOutstandingFiltersInput): Promise<SupplierOutstandingReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = supplierOutstandingFiltersSchema.parse(rawFilters);

    const financialYear = await financialYearService.getFinancialYear(filters.financialYearId);
    if (!financialYear || financialYear.companyId !== user.companyId) {
      throw new AppError("Financial year not found.");
    }

    const asOfDate = toUtcDate(filters.asOfDate);
    if (asOfDate.getTime() < financialYear.startDate.getTime() || asOfDate.getTime() > financialYear.endDate.getTime()) {
      throw new AppError("As-of date must fall within the selected financial year's date range.");
    }

    const [trialBalance, suppliers] = await Promise.all([
      voucherQueries.getTrialBalance(user.companyId, filters.financialYearId, asOfDate),
      listReportSuppliers(user.companyId, { status: filters.status }),
    ]);

    return buildSupplierOutstandingReport(trialBalance, suppliers);
  },

  async getSupplierStatement(rawFilters: SupplierStatementFiltersInput): Promise<SupplierStatementReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = supplierStatementFiltersSchema.parse(rawFilters);

    const supplier = await prisma.supplier.findUnique({
      where: { id: filters.supplierId },
      select: { id: true, companyId: true, ledgerId: true, ledger: { select: { name: true } } },
    });
    if (!supplier || supplier.companyId !== user.companyId) {
      throw new AppError("Supplier not found.");
    }

    const statement = await voucherQueries.getLedgerStatement(
      user.companyId,
      supplier.ledgerId,
      toUtcDate(filters.dateFrom),
      toUtcDate(filters.dateTo)
    );

    return buildSupplierStatement({ id: supplier.id, displayName: supplier.ledger.name }, statement);
  },

  async getSupplierPurchaseSummary(rawFilters: SupplierPurchaseSummaryFiltersInput): Promise<PartyWisePurchaseReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = supplierPurchaseSummaryFiltersSchema.parse(rawFilters);
    const rawRows = await purchaseInvoiceService.getPartyWisePurchaseReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
    });

    return buildSupplierPurchaseSummary(rawRows);
  },

  async getSupplierDirectory(rawFilters: SupplierDirectoryFiltersInput): Promise<SupplierDirectoryReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = supplierDirectoryFiltersSchema.parse(rawFilters);
    const suppliers = await listReportSuppliers(user.companyId, { status: filters.status });

    return buildSupplierDirectory(suppliers);
  },

  /** The Supplier Statement view's own required supplier picker. */
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
};
