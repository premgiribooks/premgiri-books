import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { SupplierDirectoryTable } from "@/modules/reports/suppliers/components/supplier-directory-table";
import { SupplierReportFilterBar } from "@/modules/reports/suppliers/components/supplier-report-filter-bar";
import { supplierReportService } from "@/modules/reports/suppliers/services/supplier-report-service";
import type { SupplierDirectoryReport } from "@/types/supplier-report";

interface SupplierDirectoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupplierDirectoryPage({ searchParams }: SupplierDirectoryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const isAdmin = await isCurrentUserCompanyAdmin();

  const statusParam = firstValue(resolvedParams.status);
  const status = statusParam === "all" || statusParam === "inactive" ? statusParam : "active";

  let report: SupplierDirectoryReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await supplierReportService.getSupplierDirectory({ status });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ status });

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Supplier Directory</h1>
            <p className="text-sm text-muted-foreground">Every supplier&apos;s contact and GST details.</p>
          </div>
          <ReportExportButton
            downloadUrl={`/reports/suppliers/directory/export?${exportParams.toString()}`}
            pdfDownloadUrl={`/reports/suppliers/directory/export?${exportParams.toString()}&format=pdf`}
          />
        </div>

        <SupplierReportFilterBar showStatus />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <SupplierDirectoryTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
