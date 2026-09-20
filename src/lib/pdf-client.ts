// Browser-only helpers for every "Download PDF"/"Print" button that hits a
// `[id]/pdf` (or reports `*/export?format=pdf`) Route Handler. Those routes
// now respond with either a real PDF (`renderHtmlToPdfOrHtml`'s `"pdf"`
// case) or, when server-side Chromium can't launch at all (Termux/Android —
// see pdf-generation.ts), the raw printable HTML instead. This module is the
// one place that branches on which one came back, so every caller gets the
// same behavior instead of re-implementing it per document type. Plain
// functions, not a component — only ever imported from a "use client" file,
// since every export here touches `document`/`window`.

const PDF_CONTENT_TYPE = "application/pdf";
const FALLBACK_FILENAME = "document.pdf";

export class DocumentFetchError extends Error {}

function extractFilename(response: Response): string | null {
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
  return match?.[1] ?? null;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// A hidden iframe (not a new tab) so the print dialog opens without the user
// ever seeing an extra navigation — matches the one print flow this codebase
// already had (the pre-existing SalesInvoicePrintButton) before this fallback
// existed for every other document type.
function openBlobForPrinting(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.inset = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;

  const cleanup = () => {
    iframe.remove();
    URL.revokeObjectURL(url);
  };

  iframe.addEventListener("load", () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.addEventListener("focus", cleanup, { once: true });
  });

  document.body.appendChild(iframe);
}

async function fetchDocument(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new DocumentFetchError(body?.error ?? "Failed to generate the document.");
  }
  return response;
}

export interface DownloadOrPrintResult {
  /** True when the server couldn't render a real PDF and the browser's own print-to-PDF was used instead. */
  usedPrintFallback: boolean;
}

/**
 * Fetches a `[id]/pdf`-style route and either downloads the PDF it returned,
 * or — when the response isn't actually a PDF (the server-side HTML
 * fallback) — opens the browser's print dialog on that HTML so the user can
 * choose "Save as PDF" themselves. Callers don't need to know which one they
 * got ahead of time; both paths start with the exact same fetch.
 */
export async function downloadOrPrintDocument(url: string): Promise<DownloadOrPrintResult> {
  const response = await fetchDocument(url);
  const blob = await response.blob();

  if (blob.type === PDF_CONTENT_TYPE) {
    downloadBlob(blob, extractFilename(response) ?? FALLBACK_FILENAME);
    return { usedPrintFallback: false };
  }

  openBlobForPrinting(blob);
  return { usedPrintFallback: true };
}

/**
 * Fetches a `[id]/pdf`-style route and opens it for printing unconditionally
 * (used by explicit "Print" actions, as opposed to "Download PDF" ones) —
 * content-type agnostic by design: a real PDF and the HTML fallback are
 * equally printable inside an iframe, so this never needs to branch.
 */
export async function printDocument(url: string): Promise<void> {
  const response = await fetchDocument(url);
  const blob = await response.blob();
  openBlobForPrinting(blob);
}
