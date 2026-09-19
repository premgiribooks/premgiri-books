import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { CustomerReportFilterBar } from "@/modules/reports/customers/components/customer-report-filter-bar";
import { customerReportService } from "@/modules/reports/customers/services/customer-report-service";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { PartyWiseSalesTable } from "@/modules/reports/sales/components/party-wise-sales-table";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { PartyWiseSalesReport } from "@/types/sales-report";

interface CustomerSalesSummaryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerSalesSummaryPage({ searchParams }: CustomerSalesSummaryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYear] = await Promise.all([isCurrentUserCompanyAdmin(), getCurrentFinancialYear()]);

  if (!financialYear) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">Customer Sales Summary</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select an active financial year to view the Customer Sales Summary.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const dateFromParam = firstValue(resolvedParams.dateFrom);
  const dateFrom = dateFromParam && isValidCalendarDate(dateFromParam) ? dateFromParam : toCalendarDateString(financialYear.startDate);
  const dateToParam = firstValue(resolvedParams.dateTo);
  const dateTo = dateToParam && isValidCalendarDate(dateToParam) ? dateToParam : resolveDefaultAsOfDate(financialYear);

  let report: PartyWiseSalesReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await customerReportService.getCustomerSalesSummary({ dateFrom, dateTo });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ dateFrom, dateTo });

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Customer Sales Summary</h1>
            <p className="text-sm text-muted-foreground">Sales value grouped by customer, for the selected period.</p>
          </div>
          <ReportExportButton
            downloadUrl={`/reports/customers/sales-summary/export?${exportParams.toString()}`}
            pdfDownloadUrl={`/reports/customers/sales-summary/export?${exportParams.toString()}&format=pdf`}
          />
        </div>

        <CustomerReportFilterBar showDateRange />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <PartyWiseSalesTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
