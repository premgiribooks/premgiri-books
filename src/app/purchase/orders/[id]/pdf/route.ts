import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildPurchaseOrderHtml } from "@/modules/purchase-orders/pdf/purchase-order-pdf";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(orderNumber: string): string {
  return `${orderNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * Delivers a Purchase Order as a downloadable PDF — a thin Route Handler
 * with no business logic of its own (code-standards.md's Business Logic
 * rule): `purchaseOrderService.getPurchaseOrder` re-checks its own
 * `purchase`/`view` permission and company scoping exactly as the detail
 * page does, `buildPurchaseOrderHtml` renders the already-loaded document,
 * and `renderHtmlToPdf` turns it into a buffer (78-pdf-generation.md).
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    const purchaseOrder = await purchaseOrderService.getPurchaseOrder(id);
    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
    }

    const html = buildPurchaseOrderHtml(purchaseOrder);
    const pdf = await renderHtmlToPdf(html, { format: "A5" });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename(purchaseOrder.orderNumber)}"`,
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
    logger.error({ err: error }, "Unhandled error generating purchase order PDF");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
