"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Browser print only — no PDF library, no WhatsApp (38-sales-invoice.md's
 * Do Not). Triggers window.print(), which renders SalesInvoicePrintView via
 * its `print:` Tailwind variants. */
export function SalesInvoicePrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer size={16} />
      Print
    </Button>
  );
}
