import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toBalanceSheetExportTable } from "@/engines/reporting/balance-sheet";
import { balanceSheetService } from "@/modules/reports/services/balance-sheet-service";
import { trialBalanceFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(asOfDate: string): string {
  return `Balance-Sheet-${asOfDate.replace(/[^a-zA-Z0-9._-]/g, "_")}.xlsx`;
}

/**
 * Delivers the Balance Sheet report as a downloadable `.xlsx`, following
 * trial-balance/export/route.ts's own reference wiring exactly (Balance
 * Sheet reuses that same `trialBalanceFiltersSchema` shape, per
 * balance-sheet-service.ts). Re-checks its own `reports`/`export`
 * permission independently of the calling screen's Export button;
 * `balanceSheetService.getBalanceSheet` re-checks `reports`/`view` and
 * financial-year ownership on its own.
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

    const report = await balanceSheetService.getBalanceSheet(filters);
    const buffer = await exportToExcelBuffer(toBalanceSheetExportTable(report));

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
    logger.error({ err: error }, "Unhandled error generating Balance Sheet Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
