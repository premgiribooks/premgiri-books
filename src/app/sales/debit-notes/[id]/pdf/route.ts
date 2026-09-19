import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildDebitNoteHtml } from "@/modules/debit-notes/pdf/debit-note-pdf";
import { debitNoteService } from "@/modules/debit-notes/services/debit-note-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(noteNumber: string): string {
  return `${noteNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * Delivers a Debit Note as a downloadable PDF — a thin Route Handler with no
 * business logic of its own (code-standards.md's Business Logic rule):
 * `debitNoteService.getDebitNote` re-checks its own `sales`/`view`
 * permission and company scoping exactly as the detail page does,
 * `buildDebitNoteHtml` renders the already-loaded document, and
 * `renderHtmlToPdf` turns it into a buffer (78-pdf-generation.md). This
 * document has no DRAFT-download restriction — it has no pre-existing print
 * precedent, so this is its first printing capability of any kind.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    const debitNote = await debitNoteService.getDebitNote(id);
    if (!debitNote) {
      return NextResponse.json({ error: "Debit note not found." }, { status: 404 });
    }

    const html = buildDebitNoteHtml(debitNote);
    const pdf = await renderHtmlToPdf(html, { format: "A5" });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename(debitNote.noteNumber ?? debitNote.id)}"`,
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
    logger.error({ err: error }, "Unhandled error generating debit note PDF");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
