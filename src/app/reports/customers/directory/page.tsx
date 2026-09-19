import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { CustomerDirectoryTable } from "@/modules/reports/customers/components/customer-directory-table";
import { CustomerReportFilterBar } from "@/modules/reports/customers/components/customer-report-filter-bar";
import { customerReportService } from "@/modules/reports/customers/services/customer-report-service";
import { CUSTOMER_TYPE_VALUES } from "@/modules/customers/validation/customer-schema";
import type { CustomerDirectoryReport } from "@/types/customer-report";

interface CustomerDirectoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerDirectoryPage({ searchParams }: CustomerDirectoryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const isAdmin = await isCurrentUserCompanyAdmin();

  const customerTypeParam = firstValue(resolvedParams.customerType);
  const customerType = CUSTOMER_TYPE_VALUES.find((value) => value === customerTypeParam);

  const statusParam = firstValue(resolvedParams.status);
  const status = statusParam === "all" || statusParam === "inactive" ? statusParam : "active";

  let report: CustomerDirectoryReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await customerReportService.getCustomerDirectory({ customerType, status });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams();
  if (customerType) {
    exportParams.set("customerType", customerType);
  }
  if (status !== "active") {
    exportParams.set("status", status);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Customer Directory</h1>
            <p className="text-sm text-muted-foreground">Every customer&apos;s contact and GST details.</p>
          </div>
          <ReportExportButton
            downloadUrl={`/reports/customers/directory/export?${exportParams.toString()}`}
            pdfDownloadUrl={`/reports/customers/directory/export?${exportParams.toString()}&format=pdf`}
          />
        </div>

        <CustomerReportFilterBar showCustomerType showStatus />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <CustomerDirectoryTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
