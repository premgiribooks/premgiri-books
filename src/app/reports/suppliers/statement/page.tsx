import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { SupplierReportFilterBar } from "@/modules/reports/suppliers/components/supplier-report-filter-bar";
import { SupplierStatementTable } from "@/modules/reports/suppliers/components/supplier-statement-table";
import { supplierReportService } from "@/modules/reports/suppliers/services/supplier-report-service";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { SupplierStatementReport } from "@/types/supplier-report";

interface SupplierStatementPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupplierStatementPage({ searchParams }: SupplierStatementPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, suppliers, activeFinancialYear] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    supplierReportService.listSupplierOptions(),
    getCurrentFinancialYear(),
  ]);

  const today = toCalendarDateString(new Date());
  const defaultFrom = activeFinancialYear ? toCalendarDateString(activeFinancialYear.startDate) : today;
  const defaultTo = activeFinancialYear ? resolveDefaultAsOfDate(activeFinancialYear) : today;

  const supplierId = firstValue(resolvedParams.supplierId);
  const dateFromParam = firstValue(resolvedParams.dateFrom);
  const dateFrom = dateFromParam && isValidCalendarDate(dateFromParam) ? dateFromParam : defaultFrom;
  const dateToParam = firstValue(resolvedParams.dateTo);
  const dateTo = dateToParam && isValidCalendarDate(dateToParam) ? dateToParam : defaultTo;

  let report: SupplierStatementReport | null = null;
  let errorMessage: string | null = null;
  if (supplierId) {
    try {
      report = await supplierReportService.getSupplierStatement({ supplierId, dateFrom, dateTo });
    } catch (error) {
      errorMessage = toActionErrorMessage(error);
    }
  }

  const exportParams = supplierId ? new URLSearchParams({ supplierId, dateFrom, dateTo }) : null;

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Supplier Statement</h1>
            <p className="text-sm text-muted-foreground">Dated ledger entries with running balance for one supplier.</p>
          </div>
          <ReportExportButton
            downloadUrl={exportParams ? `/reports/suppliers/statement/export?${exportParams.toString()}` : undefined}
            pdfDownloadUrl={
              exportParams ? `/reports/suppliers/statement/export?${exportParams.toString()}&format=pdf` : undefined
            }
          />
        </div>

        <SupplierReportFilterBar suppliers={suppliers} showDateRange />

        {!supplierId ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a supplier to view their statement.</p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <SupplierStatementTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
