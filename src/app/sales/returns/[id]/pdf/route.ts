import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildSalesReturnHtml } from "@/modules/sales-returns/pdf/sales-return-pdf";
import { salesReturnService } from "@/modules/sales-returns/services/sales-return-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(returnNumber: string): string {
  return `${returnNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * Delivers a Sales Return as a downloadable PDF — a thin Route Handler with
 * no business logic of its own (code-standards.md's Business Logic rule):
 * `salesReturnService.getSalesReturn` re-checks its own `sales`/`view`
 * permission and company scoping exactly as the detail page does,
 * `buildSalesReturnHtml` renders the already-loaded document, and
 * `renderHtmlToPdf` turns it into a buffer (78-pdf-generation.md). Unlike
 * Sales Invoice, this document has no DRAFT-download restriction — this is
 * its first printing capability of any kind, not an upgrade of one.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    const salesReturn = await salesReturnService.getSalesReturn(id);
    if (!salesReturn) {
      return NextResponse.json({ error: "Sales return not found." }, { status: 404 });
    }

    const html = buildSalesReturnHtml(salesReturn);
    const pdf = await renderHtmlToPdf(html, { format: "A5" });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename(salesReturn.returnNumber ?? salesReturn.id)}"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ err: error }, "Unhandled error generating sales return PDF");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
