import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdfOrHtml } from "@/lib/pdf-generation";
import { isValidMarginOverridePercent } from "@/engines/pricing/margin-override";
import { buildSalesOrderHtml } from "@/modules/sales-orders/pdf/sales-order-pdf";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(orderNumber: string): string {
  return `${orderNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * Delivers a Sales Order as a downloadable PDF — a thin Route Handler with
 * no business logic of its own (code-standards.md's Business Logic rule):
 * `salesOrderService.getSalesOrder` re-checks its own `sales`/`view`
 * permission and company scoping exactly as the detail page does,
 * `buildSalesOrderHtml` renders the already-loaded document, and
 * `renderHtmlToPdf` turns it into a buffer (78-pdf-generation.md).
 */
export async function GET(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    // Hidden "temporary margin override" feature (Ctrl+Shift+M) — an
    // optional, request-scoped rendering instruction the client appends
    // only when it has an active override cookie. NEVER written to the DB:
    // an invalid or out-of-range value is silently ignored.
    const marginOverrideParam = new URL(request.url).searchParams.get("marginOverride");
    const marginOverridePercent = marginOverrideParam === null ? null : Number(marginOverrideParam);
    const hasValidMarginOverride =
      marginOverridePercent !== null && isValidMarginOverridePercent(marginOverridePercent);

    const salesOrder = hasValidMarginOverride
      ? await salesOrderService.previewSalesOrderWithMarginOverride(id, marginOverridePercent)
      : await salesOrderService.getSalesOrder(id);
    if (!salesOrder) {
      return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
    }

    const html = buildSalesOrderHtml(salesOrder);
    const result = await renderHtmlToPdfOrHtml(html, { format: "A5" });

    // See renderHtmlToPdfOrHtml's docstring: when Chromium can't launch on
    // this platform, this is the raw HTML instead of a real PDF, and the
    // client (src/lib/pdf-client.ts) falls back to opening its own print
    // dialog on it rather than downloading it as-is.
    if (result.kind === "html") {
      return new NextResponse(result.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename(salesOrder.orderNumber)}"`,
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
    logger.error({ err: error }, "Unhandled error generating sales order PDF");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
