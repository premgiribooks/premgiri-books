"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadOrPrintDocument } from "@/lib/pdf-client";

interface ReportExportButtonProps {
  /**
   * The report's own Excel download Route Handler URL (query params
   * included), e.g.
   * `/reports/trial-balance/export?financialYearId=...&asOfDate=...`.
   * Omitted, this renders the original disabled stub. Excel export never
   * touches Puppeteer (77-excel-export.md), so this link stays a plain,
   * server-renderable `<a download>` — no client JS needed for this half.
   */
  downloadUrl?: string;
  /**
   * The report's own PDF download Route Handler URL — the same route as
   * `downloadUrl` with `&format=pdf` appended, e.g.
   * `/reports/trial-balance/export?financialYearId=...&asOfDate=...&format=pdf`.
   * When given alongside `downloadUrl`, renders a small Excel/PDF format
   * choice instead of the single link. Unlike the Excel link, this one is
   * NOT a plain `<a download>`: the route can respond with either a real
   * PDF or, when server-side Chromium isn't available for this platform
   * (Termux/Android has no Chromium build at all — see pdf-generation.ts),
   * the raw printable HTML instead — a plain link can't tell which one it
   * got. `downloadOrPrintDocument` (src/lib/pdf-client.ts) can, and falls
   * back to the browser's own print dialog on the HTML case.
   */
  pdfDownloadUrl?: string;
}

/**
 * Shared by every report screen's Export action. The disabled stub renders
 * when `downloadUrl` is omitted (64-trial-balance.md's original Phase 10
 * placeholder, still the correct fallback for any screen not yet wired to a
 * real export route). Excel-only renders a plain `<a download>` link
 * (77-excel-export.md). When `pdfDownloadUrl` is also given, renders a small
 * Excel/PDF format choice — Excel stays a plain link, PDF goes through
 * `downloadOrPrintDocument` so it degrades to the browser's print dialog
 * instead of downloading corrupted HTML-under-a-`.pdf`-name on a platform
 * where Puppeteer can't launch (78-pdf-generation.md).
 */
export function ReportExportButton({ downloadUrl, pdfDownloadUrl }: ReportExportButtonProps) {
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);

  async function handlePdfDownload(url: string) {
    setIsPreparingPdf(true);
    try {
      const { usedPrintFallback } = await downloadOrPrintDocument(url);
      if (usedPrintFallback) {
        toast.info('Choose "Save as PDF" in the print dialog to download this report.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to prepare the report PDF.");
    } finally {
      setIsPreparingPdf(false);
    }
  }

  if (!downloadUrl) {
    return (
      <Button variant="outline" disabled title="Export will be available once Excel Export ships">
        <Download size={16} />
        Export
      </Button>
    );
  }

  if (!pdfDownloadUrl) {
    return (
      <Button
        variant="outline"
        nativeButton={false}
        render={
          <a href={downloadUrl} download>
            <Download size={16} />
            Export
          </a>
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <a href={downloadUrl} download>
            <Download size={16} />
            Excel
          </a>
        }
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handlePdfDownload(pdfDownloadUrl)}
        disabled={isPreparingPdf}
      >
        <Download size={16} />
        {isPreparingPdf ? "Preparing…" : "PDF"}
      </Button>
    </div>
  );
}
