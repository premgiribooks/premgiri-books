import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface GoodsReceiptNoteDownloadPdfButtonProps {
  goodsReceiptNoteId: string;
}

/** Links to the `[id]/pdf` Route Handler (78-pdf-generation.md) — a plain,
 * server-renderable download link (no client JS needed). Goods Receipt Note
 * has no pre-existing print precedent, so this is its first printing
 * capability of any kind; rendered unconditionally (no status/DRAFT gate). */
export function GoodsReceiptNoteDownloadPdfButton({ goodsReceiptNoteId }: GoodsReceiptNoteDownloadPdfButtonProps) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a href={`/purchase/receipts/${goodsReceiptNoteId}/pdf`} download>
          <Download size={16} />
          Download PDF
        </a>
      }
    />
  );
}
