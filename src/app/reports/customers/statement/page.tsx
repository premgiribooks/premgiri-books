import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { CustomerReportFilterBar } from "@/modules/reports/customers/components/customer-report-filter-bar";
import { CustomerStatementTable } from "@/modules/reports/customers/components/customer-statement-table";
import { customerReportService } from "@/modules/reports/customers/services/customer-report-service";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { CustomerStatementReport } from "@/types/customer-report";

interface CustomerStatementPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerStatementPage({ searchParams }: CustomerStatementPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, customers, activeFinancialYear] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    customerReportService.listCustomerOptions(),
    getCurrentFinancialYear(),
  ]);

  const today = toCalendarDateString(new Date());
  const defaultFrom = activeFinancialYear ? toCalendarDateString(activeFinancialYear.startDate) : today;
  const defaultTo = activeFinancialYear ? resolveDefaultAsOfDate(activeFinancialYear) : today;

  const customerId = firstValue(resolvedParams.customerId);
  const dateFromParam = firstValue(resolvedParams.dateFrom);
  const dateFrom = dateFromParam && isValidCalendarDate(dateFromParam) ? dateFromParam : defaultFrom;
  const dateToParam = firstValue(resolvedParams.dateTo);
  const dateTo = dateToParam && isValidCalendarDate(dateToParam) ? dateToParam : defaultTo;

  let report: CustomerStatementReport | null = null;
  let errorMessage: string | null = null;
  if (customerId) {
    try {
      report = await customerReportService.getCustomerStatement({ customerId, dateFrom, dateTo });
    } catch (error) {
      errorMessage = toActionErrorMessage(error);
    }
  }

  const exportParams = customerId ? new URLSearchParams({ customerId, dateFrom, dateTo }) : null;

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Customer Statement</h1>
            <p className="text-sm text-muted-foreground">Dated ledger entries with running balance for one customer.</p>
          </div>
          <ReportExportButton
            downloadUrl={exportParams ? `/reports/customers/statement/export?${exportParams.toString()}` : undefined}
            pdfDownloadUrl={
              exportParams ? `/reports/customers/statement/export?${exportParams.toString()}&format=pdf` : undefined
            }
          />
        </div>

        <CustomerReportFilterBar customers={customers} showDateRange />

        {!customerId ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a customer to view their statement.</p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <CustomerStatementTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
