import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { buildGstr1OfflineWorkbook } from "@/engines/gst/gstr1-offline/build-gstr1-workbook";
import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { gstr1OfflineExportService } from "@/modules/gst/services/gstr1-offline-export-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(from: string, to: string): string {
  const safeFrom = from.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeTo = to.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `GSTR1-portal-import-${safeFrom}_to_${safeTo}.xlsx`;
}

/**
 * Downloads the GSTR-1 offline-tool import workbook (sheets b2cs, hsn(b2c),
 * docs) for one filing period. Re-checks `reports`/`export` itself, independent
 * of the calling screen; the service re-checks `gst`/`view`. Refusals the user
 * can act on (draft invoices, products without HSN) come back as a 400 with
 * the message in `error`, which the screen's export button shows as a toast.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const url = new URL(request.url);
    const filters = gstReportFiltersSchema.parse({
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
    });

    const data = await gstr1OfflineExportService.getOfflineExport({ from: toUtcDate(filters.from), to: toUtcDate(filters.to) });
    const buffer = await buildGstr1OfflineWorkbook(data);

    logger.info({ companyId: user.companyId, from: filters.from, to: filters.to }, "GSTR-1 portal import workbook exported");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.from, filters.to)}"`,
        // Authenticated tax data: never let a shared cache or proxy keep a copy.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid date range." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating GSTR-1 portal import workbook");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
