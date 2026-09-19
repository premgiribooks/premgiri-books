import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toTrialBalanceExportTable } from "@/engines/reporting/trial-balance";
import { trialBalanceReportService } from "@/modules/reports/services/trial-balance-report-service";
import { trialBalanceFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(asOfDate: string): string {
  return `Trial-Balance-${asOfDate.replace(/[^a-zA-Z0-9._-]/g, "_")}.xlsx`;
}

/**
 * Delivers the Trial Balance report as a downloadable `.xlsx` — the
 * reference wiring for Excel Export (77-excel-export.md's UI section). A
 * thin Route Handler with no business logic of its own: re-checks its own
 * `reports`/`export` permission (never assuming the calling screen's
 * disabled-until-now Export button implies authorization), re-derives the
 * report from the same already-validated filters the page itself uses
 * (trialBalanceReportService re-checks `reports`/`view` and financial-year
 * ownership on its own), then flattens and formats it via this module's
 * shared, domain-agnostic exportToExcelBuffer.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const filters = trialBalanceFiltersSchema.parse({
      financialYearId: url.searchParams.get("financialYearId") ?? "",
      asOfDate: url.searchParams.get("asOfDate") ?? "",
    });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await trialBalanceReportService.getTrialBalanceReport(filters);
    const buffer = await exportToExcelBuffer(toTrialBalanceExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.asOfDate)}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid financial year and as-of date." }, { status: 400 });
    }
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ err: error }, "Unhandled error generating Trial Balance Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
