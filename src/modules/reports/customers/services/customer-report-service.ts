import type { CustomerType, Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildCustomerDirectory,
  buildCustomerOutstandingReport,
  buildCustomerSalesSummary,
  buildCustomerStatement,
} from "@/engines/reporting/customer-reports";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import {
  customerDirectoryFiltersSchema,
  customerOutstandingFiltersSchema,
  customerSalesSummaryFiltersSchema,
  customerStatementFiltersSchema,
  toUtcDate,
  type CustomerDirectoryFiltersInput,
  type CustomerOutstandingFiltersInput,
  type CustomerSalesSummaryFiltersInput,
  type CustomerStatementFiltersInput,
} from "@/modules/reports/customers/validation/customer-report-schema";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";
import type {
  CustomerDirectoryReport,
  CustomerOutstandingReport,
  CustomerReportRow,
  CustomerStatementReport,
} from "@/types/customer-report";
import type { PartyWiseSalesReport } from "@/types/sales-report";

/**
 * 71-customer-reports.md's Customer Reports module — the layer every Server
 * Component page in this spec calls. Gates every public method on
 * `reports`/`view`, then delegates the actual read to
 * `voucherQueries.getTrialBalance`/`getLedgerStatement` (spec 31, unmodified)
 * and `salesInvoiceService.getPartyWiseSalesReport` (spec 68, unmodified),
 * handing the result to the Reporting Engine (customer-reports.ts) for
 * shaping. This module owns no table of its own (Data Model) — the direct
 * Prisma reads below are read-only Customer/Ledger lookups, mirroring
 * inventory-report-service.ts's own listReportProducts/listReportWarehouses
 * precedent (see listReportCustomers's own doc comment for why this bypasses
 * customerService).
 */

/**
 * Every Customer for the caller's own company, matching `filters` —
 * queried directly rather than through `customerService.listCustomers()`
 * (this spec's own literal suggestion): the seeded Accountant role has
 * `reports:view` but not `masters:view`, so routing this read through that
 * masters-gated service would 403 exactly the role this module exists to
 * serve — the same precedent every other report service in this batch
 * (purchase/sales/inventory) already established for its own filter-bar
 * options and join data.
 */
async function listReportCustomers(
  companyId: string,
  filters: { status?: "all" | "active" | "inactive"; customerType?: CustomerType } = {}
): Promise<CustomerReportRow[]> {
  const where: Prisma.CustomerWhereInput = { companyId };
  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }
  if (filters.customerType) {
    where.customerType = filters.customerType;
  }

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      customerType: true,
      mobileNumber: true,
      gstin: true,
      city: true,
      state: true,
      isActive: true,
      ledgerId: true,
      creditLimit: true,
      ledger: { select: { name: true, openingBalance: true, openingBalanceType: true } },
    },
    orderBy: { ledger: { name: "asc" } },
  });

  return customers.map((customer) => ({
    id: customer.id,
    displayName: customer.ledger.name,
    customerType: customer.customerType,
    mobileNumber: customer.mobileNumber,
    gstin: customer.gstin,
    city: customer.city,
    state: customer.state,
    isActive: customer.isActive,
    ledgerId: customer.ledgerId,
    creditLimit: customer.creditLimit === null ? null : customer.creditLimit.toNumber(),
    openingBalance: customer.ledger.openingBalance.toNumber(),
    openingBalanceType: customer.ledger.openingBalanceType,
  }));
}

export const customerReportService = {
  async getCustomerOutstandingReport(rawFilters: CustomerOutstandingFiltersInput): Promise<CustomerOutstandingReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = customerOutstandingFiltersSchema.parse(rawFilters);

    const financialYear = await financialYearService.getFinancialYear(filters.financialYearId);
    if (!financialYear || financialYear.companyId !== user.companyId) {
      throw new AppError("Financial year not found.");
    }

    const asOfDate = toUtcDate(filters.asOfDate);
    if (asOfDate.getTime() < financialYear.startDate.getTime() || asOfDate.getTime() > financialYear.endDate.getTime()) {
      throw new AppError("As-of date must fall within the selected financial year's date range.");
    }

    const [trialBalance, customers] = await Promise.all([
      voucherQueries.getTrialBalance(user.companyId, filters.financialYearId, asOfDate),
      listReportCustomers(user.companyId, { status: filters.status }),
    ]);

    return buildCustomerOutstandingReport(trialBalance, customers);
  },

  async getCustomerStatement(rawFilters: CustomerStatementFiltersInput): Promise<CustomerStatementReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = customerStatementFiltersSchema.parse(rawFilters);

    const customer = await prisma.customer.findUnique({
      where: { id: filters.customerId },
      select: { id: true, companyId: true, ledgerId: true, ledger: { select: { name: true } } },
    });
    if (!customer || customer.companyId !== user.companyId) {
      throw new AppError("Customer not found.");
    }

    const statement = await voucherQueries.getLedgerStatement(
      user.companyId,
      customer.ledgerId,
      toUtcDate(filters.dateFrom),
      toUtcDate(filters.dateTo)
    );

    return buildCustomerStatement({ id: customer.id, displayName: customer.ledger.name }, statement);
  },

  async getCustomerSalesSummary(rawFilters: CustomerSalesSummaryFiltersInput): Promise<PartyWiseSalesReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = customerSalesSummaryFiltersSchema.parse(rawFilters);
    const rawRows = await salesInvoiceService.getPartyWiseSalesReport({
      fromDate: toUtcDate(filters.dateFrom),
      toDate: toUtcDate(filters.dateTo),
    });

    return buildCustomerSalesSummary(rawRows);
  },

  async getCustomerDirectory(rawFilters: CustomerDirectoryFiltersInput): Promise<CustomerDirectoryReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = customerDirectoryFiltersSchema.parse(rawFilters);
    const customers = await listReportCustomers(user.companyId, {
      status: filters.status,
      customerType: filters.customerType,
    });

    return buildCustomerDirectory(customers);
  },

  /** The Customer Statement view's own required customer picker. */
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
};
