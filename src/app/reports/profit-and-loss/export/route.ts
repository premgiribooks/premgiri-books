import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toProfitAndLossExportTable } from "@/engines/reporting/profit-and-loss";
import { profitAndLossService } from "@/modules/reports/services/profit-and-loss-service";
import { profitAndLossFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(from: string, to: string): string {
  return `Profit-and-Loss-${from}_to_${to}.xlsx`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Delivers the Profit & Loss report as a downloadable `.xlsx`, following
 * trial-balance/export/route.ts's own reference wiring exactly (Profit &
 * Loss reuses `profitAndLossFiltersSchema`'s from/to shape, per
 * profit-and-loss-service.ts). Re-checks its own `reports`/`export`
 * permission independently of the calling screen's Export button;
 * `profitAndLossService.getProfitAndLoss` re-checks `reports`/`view` and
 * financial-year ownership on its own.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const filters = profitAndLossFiltersSchema.parse({
      financialYearId: url.searchParams.get("financialYearId") ?? "",
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
    });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await profitAndLossService.getProfitAndLoss(filters);
    const buffer = await exportToExcelBuffer(toProfitAndLossExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.from, filters.to)}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid financial year and From/To date range." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Profit & Loss Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
