import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PurchaseOrderDownloadPdfButtonProps {
  purchaseOrderId: string;
}

/** Links to the `[id]/pdf` Route Handler (78-pdf-generation.md) — a plain,
 * server-renderable download link (no client JS needed). Purchase Order has
 * no pre-existing print precedent, so this is its first printing capability
 * of any kind; unlike Sales Invoice, it is rendered unconditionally (no
 * status/DRAFT gate). */
export function PurchaseOrderDownloadPdfButton({ purchaseOrderId }: PurchaseOrderDownloadPdfButtonProps) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a href={`/purchase/orders/${purchaseOrderId}/pdf`} download>
          <Download size={16} />
          Download PDF
        </a>
      }
    />
  );
}
