"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SalesInvoicePrintButtonProps {
  salesInvoiceId: string;
}

/** Prints the exact same document the Download button downloads — fetches
 * the `[id]/pdf` Route Handler's PDF (78-pdf-generation.md), loads it into a
 * hidden iframe, and triggers that iframe's native print dialog. Reuses the
 * PDF byte-for-byte instead of maintaining a second, divergent print
 * stylesheet (the two had drifted out of sync — see progress-tracker.md's
 * 2026-09-19 Sales Invoice PDF redesign entry). */
export function SalesInvoicePrintButton({
  salesInvoiceId,
}: SalesInvoicePrintButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  async function handlePrint() {
    setIsPreparing(true);
    try {
      const response = await fetch(`/sales/invoices/${salesInvoiceId}/pdf`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? "Failed to generate the PDF for printing.",
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.inset = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;

      const cleanup = () => {
        iframe.remove();
        URL.revokeObjectURL(url);
      };

      iframe.addEventListener("load", () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        window.addEventListener("focus", cleanup, { once: true });
      });

      document.body.appendChild(iframe);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to prepare the invoice for printing.",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrint}
      disabled={isPreparing}
    >
      <Printer size={16} />
      {isPreparing ? "Preparing…" : "Print"}
    </Button>
  );
}
