"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/pdf-client";

interface Gstr1PortalExportButtonProps {
  /** `YYYY-MM-DD` start of the selected filing period. */
  from: string;
  /** `YYYY-MM-DD` end of the selected filing period. */
  to: string;
}

const FALLBACK_FILENAME = "GSTR1-portal-import.xlsx";

function filenameFrom(response: Response): string {
  const disposition = response.headers.get("Content-Disposition");
  return (disposition ? /filename="([^"]+)"/.exec(disposition)?.[1] : null) ?? FALLBACK_FILENAME;
}

/**
 * Downloads the GSTR-1 portal import workbook (b2cs, hsn(b2c), docs). It
 * fetches rather than using a plain `<a download>` link because the export can
 * refuse with something the user must act on (draft invoices, products with no
 * HSN) — a link would save that error as a file instead of showing it.
 */
export function Gstr1PortalExportButton({ from, to }: Gstr1PortalExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const response = await fetch(`/gst/gstr-1/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "Failed to export the GSTR-1 file.");
        return;
      }
      downloadBlob(await response.blob(), filenameFrom(response));
    } catch {
      toast.error("Failed to export the GSTR-1 file. Check your connection and try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      title="Excel for the GST portal's offline-tool import: b2cs, hsn(b2c) and docs sheets"
    >
      <Download size={16} />
      {isExporting ? "Preparing…" : "Export for GST portal"}
    </Button>
  );
}
