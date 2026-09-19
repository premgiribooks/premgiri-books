import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface QuotationDownloadPdfButtonProps {
  quotationId: string;
}

/** Links to the `[id]/pdf` Route Handler (78-pdf-generation.md) — a plain,
 * server-renderable download link (no client JS needed), mirroring
 * `SalesInvoiceDownloadPdfButton`. Quotation had no pre-existing print
 * precedent, so this is added unconditionally (no status gate). */
export function QuotationDownloadPdfButton({ quotationId }: QuotationDownloadPdfButtonProps) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a href={`/sales/quotations/${quotationId}/pdf`} download>
          <Download size={16} />
          Download PDF
        </a>
      }
    />
  );
}
