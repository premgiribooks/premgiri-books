import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PurchaseReturnDownloadPdfButtonProps {
  purchaseReturnId: string;
}

/** Links to the `[id]/pdf` Route Handler (78-pdf-generation.md) — a plain,
 * server-renderable download link (no client JS needed). Purchase Return
 * has no pre-existing print precedent, so this is its first printing
 * capability of any kind; rendered unconditionally (no status/DRAFT gate) —
 * a still-DRAFT return's PDF simply prints "Draft" in place of its
 * not-yet-assigned `returnNumber`. */
export function PurchaseReturnDownloadPdfButton({ purchaseReturnId }: PurchaseReturnDownloadPdfButtonProps) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a href={`/purchase/returns/${purchaseReturnId}/pdf`} download>
          <Download size={16} />
          Download PDF
        </a>
      }
    />
  );
}
