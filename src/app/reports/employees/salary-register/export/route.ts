import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdfOrHtml } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toSalaryRegisterExportTable } from "@/engines/reporting/employee-reports";
import { employeeReportService } from "@/modules/reports/employees/services/employee-report-service";
import { salaryRegisterFiltersSchema } from "@/modules/reports/employees/validation/employee-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

type ExportFormat = "xlsx" | "pdf";

/**
 * Anything other than the literal string `"pdf"` is treated as `"xlsx"` —
 * this codebase's fail-safe-default convention (78-pdf-generation.md's
 * Business Rules), so an unrecognized `?format=` value never 500s, it just
 * falls back to the original behavior.
 */
function resolveFormat(value: string | null): ExportFormat {
  return value === "pdf" ? "pdf" : "xlsx";
}

function downloadFilename(employeeName: string, format: ExportFormat): string {
  const sanitizedName = employeeName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Salary-Register-${sanitizedName}.${format}`;
}

/**
 * Delivers the Salary Register report as a downloadable `.xlsx` or `.pdf`,
 * following customers/statement/export/route.ts's own reference wiring for
 * a single-employee report exactly. Re-checks its own `reports`/`export`
 * permission independently of the calling screen's Export button —
 * `employeeReportService.getSalaryRegister` re-checks `reports`/`view` and
 * same-company employee ownership on its own, the same module every other
 * Employee Reports view is gated on. A dedicated `employees` permission
 * module does exist in the catalog and gates payroll-run mutations
 * elsewhere (payroll-run-service.ts), but this report-read path
 * deliberately uses the coarser `reports` module instead — a known, tracked
 * design tradeoff (see progress-tracker.md), not an oversight; this applies
 * equally to both export formats. `financialYearId`/`dateFrom`/`dateTo` are
 * all optional (an employee's salary history naturally spans multiple
 * financial years, per the schema's own comment), so — unlike Customer
 * Statement's required date range — the download filename is built from
 * only the report's own resolved `employeeName` (not the raw query param,
 * so it always matches the employee actually resolved), with no
 * date-derived suffix. Both export formats reuse the exact same
 * `toSalaryRegisterExportTable(report)` shaping.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId") ?? "";
    const financialYearId = url.searchParams.get("financialYearId");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const filters = salaryRegisterFiltersSchema.parse({
      employeeId,
      ...(financialYearId ? { financialYearId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await employeeReportService.getSalaryRegister(filters);
    const tables = toSalaryRegisterExportTable(report);

    if (format === "pdf") {
      const html = buildReportHtml(tables);
      const result = await renderHtmlToPdfOrHtml(html, { format: "A4", orientation: "portrait" });

      // See renderHtmlToPdfOrHtml's docstring: when Chromium can't launch on
      // this platform, this is the raw HTML instead of a real PDF, and the
      // client (src/lib/pdf-client.ts) falls back to opening its own print
      // dialog on it rather than downloading it as-is.
      if (result.kind === "html") {
        return new NextResponse(result.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          "Content-Type": PDF_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${downloadFilename(report.employeeName, "pdf")}"`,
        },
      });
    }

    const buffer = await exportToExcelBuffer(tables);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(report.employeeName, "xlsx")}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid employee, financial year, or date range." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Salary Register Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
