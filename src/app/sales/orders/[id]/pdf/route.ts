import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
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
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    const salesOrder = await salesOrderService.getSalesOrder(id);
    if (!salesOrder) {
      return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
    }

    const html = buildSalesOrderHtml(salesOrder);
    const pdf = await renderHtmlToPdf(html, { format: "A5" });

    return new NextResponse(new Uint8Array(pdf), {
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
