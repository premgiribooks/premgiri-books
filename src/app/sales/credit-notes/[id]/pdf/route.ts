import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdfOrHtml } from "@/lib/pdf-generation";
import { buildCreditNoteHtml } from "@/modules/credit-notes/pdf/credit-note-pdf";
import { creditNoteService } from "@/modules/credit-notes/services/credit-note-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(noteNumber: string): string {
  return `${noteNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * Delivers a Credit Note as a downloadable PDF — a thin Route Handler with
 * no business logic of its own (code-standards.md's Business Logic rule):
 * `creditNoteService.getCreditNote` re-checks its own `sales`/`view`
 * permission and company scoping exactly as the detail page does,
 * `buildCreditNoteHtml` renders the already-loaded document, and
 * `renderHtmlToPdf` turns it into a buffer (78-pdf-generation.md). This
 * document has no DRAFT-download restriction — it has no pre-existing print
 * precedent, so this is its first printing capability of any kind.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    const creditNote = await creditNoteService.getCreditNote(id);
    if (!creditNote) {
      return NextResponse.json({ error: "Credit note not found." }, { status: 404 });
    }

    const html = buildCreditNoteHtml(creditNote);
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
        "Content-Disposition": `attachment; filename="${downloadFilename(creditNote.noteNumber ?? creditNote.id)}"`,
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
    logger.error({ err: error }, "Unhandled error generating credit note PDF");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
