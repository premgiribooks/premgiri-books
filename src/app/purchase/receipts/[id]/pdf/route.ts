import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildGoodsReceiptNoteHtml } from "@/modules/goods-receipt-notes/pdf/goods-receipt-note-pdf";
import { goodsReceiptNoteService } from "@/modules/goods-receipt-notes/services/goods-receipt-note-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(grnNumber: string): string {
  return `${grnNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * Delivers a Goods Receipt Note as a downloadable PDF — a thin Route
 * Handler with no business logic of its own (code-standards.md's Business
 * Logic rule): `goodsReceiptNoteService.getGoodsReceiptNote` re-checks its
 * own `purchase`/`view` permission and company scoping exactly as the
 * detail page does, `buildGoodsReceiptNoteHtml` renders the already-loaded
 * document, and `renderHtmlToPdf` turns it into a buffer
 * (78-pdf-generation.md).
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    const goodsReceiptNote = await goodsReceiptNoteService.getGoodsReceiptNote(id);
    if (!goodsReceiptNote) {
      return NextResponse.json({ error: "Goods receipt note not found." }, { status: 404 });
    }

    const html = buildGoodsReceiptNoteHtml(goodsReceiptNote);
    const pdf = await renderHtmlToPdf(html, { format: "A5" });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename(goodsReceiptNote.grnNumber)}"`,
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
    logger.error({ err: error }, "Unhandled error generating goods receipt note PDF");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
