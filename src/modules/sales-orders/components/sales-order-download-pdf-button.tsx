import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SalesOrderDownloadPdfButtonProps {
  salesOrderId: string;
}

/** Links to the `[id]/pdf` Route Handler (78-pdf-generation.md) — a plain,
 * server-renderable download link (no client JS needed), mirroring
 * `SalesInvoiceDownloadPdfButton`. Sales Order had no pre-existing print
 * precedent, so this is added unconditionally (no status gate). */
export function SalesOrderDownloadPdfButton({ salesOrderId }: SalesOrderDownloadPdfButtonProps) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a href={`/sales/orders/${salesOrderId}/pdf`} download>
          <Download size={16} />
          Download PDF
        </a>
      }
    />
  );
}
