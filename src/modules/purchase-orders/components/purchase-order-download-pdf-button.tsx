"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadOrPrintDocument } from "@/lib/pdf-client";

interface PurchaseOrderDownloadPdfButtonProps {
  purchaseOrderId: string;
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
export function PurchaseOrderDownloadPdfButton({ purchaseOrderId }: PurchaseOrderDownloadPdfButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  async function handleDownload() {
    setIsPreparing(true);
    try {
      const { usedPrintFallback } = await downloadOrPrintDocument(`/purchase/orders/${purchaseOrderId}/pdf`);
      if (usedPrintFallback) {
        toast.info('Choose "Save as PDF" in the print dialog to download this purchase order.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to prepare the purchase order PDF.");
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
