import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Forward-noted stub — 57-gst-registers.md's Do Not: "Actual Excel/PDF file
 * generation for the Export button (Phase 11, #75/#76 — button present,
 * wiring deferred)." Renders disabled until Excel Export (spec 77) exists.
 */
export function GstReportExportButton() {
  return (
    <Button variant="outline" disabled title="Export will be available once Excel Export ships">
      <Download size={16} />
      Export
    </Button>
  );
}
