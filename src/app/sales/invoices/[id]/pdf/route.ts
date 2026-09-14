import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildSalesInvoiceHtml } from "@/modules/sales-invoices/pdf/sales-invoice-pdf";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * Delivers a Sales Invoice as a downloadable PDF — a thin Route Handler
 * with no business logic of its own (code-standards.md's Business Logic
 * rule): `salesInvoiceService.getSalesInvoice` re-checks its own
 * `sales`/`view` permission and company scoping exactly as the detail page
 * does, `buildSalesInvoiceHtml` renders the already-loaded document, and
 * `renderHtmlToPdf` turns it into a buffer (78-pdf-generation.md).
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  let salesInvoice;
  try {
    salesInvoice = await salesInvoiceService.getSalesInvoice(id);
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
    logger.error({ err: error }, "Unhandled error loading sales invoice for PDF generation");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  if (!salesInvoice) {
    return NextResponse.json({ error: "Sales invoice not found." }, { status: 404 });
  }

  const html = buildSalesInvoiceHtml(salesInvoice);
  const pdf = await renderHtmlToPdf(html, { format: "A5" });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadFilename(salesInvoice.invoiceNumber)}"`,
    },
  });
}
