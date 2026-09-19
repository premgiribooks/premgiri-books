import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { SalesRegisterTable } from "@/modules/reports/sales/components/sales-register-table";
import { SalesReportFilterBar } from "@/modules/reports/sales/components/sales-report-filter-bar";
import { salesReportService } from "@/modules/reports/sales/services/sales-report-service";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import { SALES_INVOICE_STATUS_VALUES } from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type { SalesRegisterReport } from "@/types/sales-report";

interface SalesRegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type SalesInvoiceStatusValue = (typeof SALES_INVOICE_STATUS_VALUES)[number];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesRegisterPage({ searchParams }: SalesRegisterPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYear, customers] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    getCurrentFinancialYear(),
    salesReportService.listCustomerOptions(),
  ]);

  if (!financialYear) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">Sales Register</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select an active financial year to view the Sales Register.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const dateFromParam = firstValue(resolvedParams.dateFrom);
  const dateFrom = dateFromParam && isValidCalendarDate(dateFromParam) ? dateFromParam : toCalendarDateString(financialYear.startDate);
  const dateToParam = firstValue(resolvedParams.dateTo);
  const dateTo = dateToParam && isValidCalendarDate(dateToParam) ? dateToParam : resolveDefaultAsOfDate(financialYear);
  const customerId = firstValue(resolvedParams.customerId);
  const statusParam = firstValue(resolvedParams.status);
  const status: SalesInvoiceStatusValue | undefined = (SALES_INVOICE_STATUS_VALUES as readonly string[]).includes(
    statusParam ?? ""
  )
    ? (statusParam as SalesInvoiceStatusValue)
    : undefined;

  let report: SalesRegisterReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await salesReportService.getSalesRegister({ dateFrom, dateTo, customerId, status });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ dateFrom, dateTo });
  if (customerId) {
    exportParams.set("customerId", customerId);
  }
  if (status) {
    exportParams.set("status", status);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sales Register</h1>
            <p className="text-sm text-muted-foreground">Every Sales Invoice within the selected date range, POSTED by default.</p>
          </div>
          <ReportExportButton downloadUrl={`/reports/sales/register/export?${exportParams.toString()}`} />
        </div>

        <SalesReportFilterBar customers={customers} statusOptions={SALES_INVOICE_STATUS_VALUES} />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <SalesRegisterTable rows={report!.rows} totals={report!.totals} />
        )}
      </div>
    </AppShell>
  );
}
