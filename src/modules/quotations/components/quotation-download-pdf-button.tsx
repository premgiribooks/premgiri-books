"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadOrPrintDocument } from "@/lib/pdf-client";
import { useMarginOverride } from "@/hooks/use-margin-override";

interface QuotationDownloadPdfButtonProps {
  quotationId: string;
}

/**
 * Fetches the `[id]/pdf` Route Handler (78-pdf-generation.md) and downloads
 * the PDF it returns. No longer a plain `<a href download>` link: the route
 * can now respond with the printable HTML instead of a real PDF when
 * server-side Chromium isn't available (Termux/Android has none at all —
 * see pdf-generation.ts), and a plain download link can't tell which one it
 * got. `downloadOrPrintDocument` (src/lib/pdf-client.ts) does — it opens the
 * browser's own print dialog on that HTML instead, so this stays a working
 * one-click action either way, just with a hint to use "Save as PDF" on the
 * deployments where the instant download isn't available.
 */
export function QuotationDownloadPdfButton({ quotationId }: QuotationDownloadPdfButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);
  const marginOverride = useMarginOverride();

  async function handleDownload() {
    setIsPreparing(true);
    try {
      const pdfUrl = marginOverride
        ? `/sales/quotations/${quotationId}/pdf?marginOverride=${marginOverride.marginPercent}`
        : `/sales/quotations/${quotationId}/pdf`;
      const { usedPrintFallback } = await downloadOrPrintDocument(pdfUrl);
      if (usedPrintFallback) {
        toast.info('Choose "Save as PDF" in the print dialog to download this quotation.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to prepare the quotation PDF.");
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleDownload} disabled={isPreparing}>
      <Download size={16} />
      {isPreparing ? "Preparing…" : "Download PDF"}
    </Button>
  );
}
