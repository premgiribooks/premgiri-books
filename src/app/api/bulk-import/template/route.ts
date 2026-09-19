import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { bulkImportService } from "@/modules/bulk-import/services/bulk-import-service";
import { bulkImportUploadRequestSchema } from "@/modules/bulk-import/validation/bulk-import-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Delivers a blank import template for the given target — gated on
 * `masters`/`view` only (76-excel-import.md's Security section: "reading
 * the column shape is not itself a write"), independently of the page's own
 * permission gate.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const { target: targetKey } = bulkImportUploadRequestSchema.parse({ target: url.searchParams.get("target") });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const target = bulkImportService.getImportTarget(targetKey);
    const buffer = await bulkImportService.buildImportTemplate(target);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${target.label}-import-template.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid import target." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating a bulk import template");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
