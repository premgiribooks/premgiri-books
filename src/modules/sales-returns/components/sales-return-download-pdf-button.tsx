import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SalesReturnDownloadPdfButtonProps {
  salesReturnId: string;
}

/** Links to the `[id]/pdf` Route Handler (78-pdf-generation.md) — a plain,
 * server-renderable download link (no client JS needed). Sales Return has
 * no pre-existing print precedent, so this is its first printing capability
 * of any kind, rendered unconditionally in the detail page's action row. */
export function SalesReturnDownloadPdfButton({ salesReturnId }: SalesReturnDownloadPdfButtonProps) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a href={`/sales/returns/${salesReturnId}/pdf`} download>
          <Download size={16} />
          Download PDF
        </a>
      }
    />
  );
}
