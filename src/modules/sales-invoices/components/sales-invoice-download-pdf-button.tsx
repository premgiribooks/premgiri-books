import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SalesInvoiceDownloadPdfButtonProps {
  salesInvoiceId: string;
}

/** Links to the `[id]/pdf` Route Handler (78-pdf-generation.md) — a plain,
 * server-renderable download link (no client JS needed), added beside the
 * existing browser-only Print action rather than replacing it. */
export function SalesInvoiceDownloadPdfButton({ salesInvoiceId }: SalesInvoiceDownloadPdfButtonProps) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a href={`/sales/invoices/${salesInvoiceId}/pdf`} download>
          <Download size={16} />
          Download PDF
        </a>
      }
    />
  );
}
