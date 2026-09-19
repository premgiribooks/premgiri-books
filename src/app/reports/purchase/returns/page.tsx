import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { PurchaseReportFilterBar } from "@/modules/reports/purchase/components/purchase-report-filter-bar";
import { PurchaseReturnSummaryTable } from "@/modules/reports/purchase/components/purchase-return-summary-table";
import { purchaseReportService } from "@/modules/reports/purchase/services/purchase-report-service";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import { PURCHASE_RETURN_STATUS_VALUES } from "@/modules/purchase-returns/validation/purchase-return-schema";
import type { PurchaseReturnSummaryReport } from "@/types/purchase-report";

interface PurchaseReturnSummaryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type PurchaseReturnStatusValue = (typeof PURCHASE_RETURN_STATUS_VALUES)[number];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PurchaseReturnSummaryPage({ searchParams }: PurchaseReturnSummaryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYear, suppliers] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    getCurrentFinancialYear(),
    purchaseReportService.listSupplierOptions(),
  ]);

  if (!financialYear) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">Purchase Return Summary</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select an active financial year to view the Purchase Return Summary.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const dateFromParam = firstValue(resolvedParams.dateFrom);
  const dateFrom = dateFromParam && isValidCalendarDate(dateFromParam) ? dateFromParam : toCalendarDateString(financialYear.startDate);
  const dateToParam = firstValue(resolvedParams.dateTo);
  const dateTo = dateToParam && isValidCalendarDate(dateToParam) ? dateToParam : resolveDefaultAsOfDate(financialYear);
  const supplierId = firstValue(resolvedParams.supplierId);
  const statusParam = firstValue(resolvedParams.status);
  const status: PurchaseReturnStatusValue | undefined = (PURCHASE_RETURN_STATUS_VALUES as readonly string[]).includes(
    statusParam ?? ""
  )
    ? (statusParam as PurchaseReturnStatusValue)
    : undefined;

  let report: PurchaseReturnSummaryReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await purchaseReportService.getPurchaseReturnSummary({ dateFrom, dateTo, supplierId, status });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ dateFrom, dateTo });
  if (supplierId) exportParams.set("supplierId", supplierId);
  if (status) exportParams.set("status", status);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Purchase Return Summary</h1>
            <p className="text-sm text-muted-foreground">Every Purchase Return within the selected date range, POSTED by default.</p>
          </div>
          <ReportExportButton
            downloadUrl={`/reports/purchase/returns/export?${exportParams.toString()}`}
            pdfDownloadUrl={`/reports/purchase/returns/export?${exportParams.toString()}&format=pdf`}
          />
        </div>

        <PurchaseReportFilterBar suppliers={suppliers} statusOptions={PURCHASE_RETURN_STATUS_VALUES} />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <PurchaseReturnSummaryTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
