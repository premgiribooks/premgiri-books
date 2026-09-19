import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DebitNoteDownloadPdfButtonProps {
  debitNoteId: string;
}

/** Links to the `[id]/pdf` Route Handler (78-pdf-generation.md) — a plain,
 * server-renderable download link (no client JS needed). Debit Note has no
 * pre-existing print precedent, so this is its first printing capability of
 * any kind, rendered unconditionally in the detail page's action row. */
export function DebitNoteDownloadPdfButton({ debitNoteId }: DebitNoteDownloadPdfButtonProps) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a href={`/sales/debit-notes/${debitNoteId}/pdf`} download>
          <Download size={16} />
          Download PDF
        </a>
      }
    />
  );
}
