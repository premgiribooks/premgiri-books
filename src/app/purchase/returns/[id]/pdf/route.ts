import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildPurchaseReturnHtml } from "@/modules/purchase-returns/pdf/purchase-return-pdf";
import { purchaseReturnService } from "@/modules/purchase-returns/services/purchase-return-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(returnNumber: string): string {
  return `${returnNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * Delivers a Purchase Return as a downloadable PDF — a thin Route Handler
 * with no business logic of its own (code-standards.md's Business Logic
 * rule): `purchaseReturnService.getPurchaseReturn` re-checks its own
 * `purchase`/`view` permission and company scoping exactly as the detail
 * page does, `buildPurchaseReturnHtml` renders the already-loaded document,
 * and `renderHtmlToPdf` turns it into a buffer (78-pdf-generation.md).
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    const purchaseReturn = await purchaseReturnService.getPurchaseReturn(id);
    if (!purchaseReturn) {
      return NextResponse.json({ error: "Purchase return not found." }, { status: 404 });
    }

    const html = buildPurchaseReturnHtml(purchaseReturn);
    const pdf = await renderHtmlToPdf(html, { format: "A5" });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename(purchaseReturn.returnNumber ?? purchaseReturn.id)}"`,
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
    logger.error({ err: error }, "Unhandled error generating purchase return PDF");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
