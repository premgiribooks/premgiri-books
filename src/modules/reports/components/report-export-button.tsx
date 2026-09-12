import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Forward-noted stub, shared by every Phase 10 financial report screen
 * (64-trial-balance.md's Do Not: "Actual Excel/PDF file generation for the
 * Export button (Phase 11, #75/#76 — button present, wiring deferred)").
 * Mirrors gst-report-export-button.tsx's identical stub for Phase 8.
 */
export function ReportExportButton() {
  return (
    <Button variant="outline" disabled title="Export will be available once Excel Export ships">
      <Download size={16} />
      Export
    </Button>
  );
}
