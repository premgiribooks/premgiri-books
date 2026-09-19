import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ReportExportButtonProps {
  /**
   * The report's own Excel download Route Handler URL (query params
   * included), e.g.
   * `/reports/trial-balance/export?financialYearId=...&asOfDate=...`.
   * Omitted, this renders the original disabled stub — every Phase 10
   * screen other than Trial Balance still passes nothing, since only Trial
   * Balance is wired as 77-excel-export.md's required reference
   * implementation; each remaining screen wiring its own download route
   * through this same prop is a named, small, mechanical follow-up.
   */
  downloadUrl?: string;
  /**
   * The report's own PDF download Route Handler URL — the same route as
   * `downloadUrl` with `&format=pdf` appended, e.g.
   * `/reports/trial-balance/export?financialYearId=...&asOfDate=...&format=pdf`.
   * Additive and optional (78-pdf-generation.md's Report PDFs rule: only
   * Trial Balance is wired as the required reference implementation; every
   * other Phase 10 screen keeps passing only `downloadUrl` and renders
   * exactly as before). When given alongside `downloadUrl`, renders a small
   * Excel/PDF format choice instead of the single link.
   */
  pdfDownloadUrl?: string;
}

/**
 * Shared by every Phase 10 financial report screen. A plain,
 * server-renderable `<a download>` link when `downloadUrl` is given (no
 * client JS needed — mirrors sales-invoice-download-pdf-button.tsx's
 * identical convention), otherwise the original forward-noted disabled stub
 * (64-trial-balance.md's Do Not: "Actual Excel/PDF file generation for the
 * Export button (Phase 11, #75/#76 — button present, wiring deferred)").
 * Mirrors gst-report-export-button.tsx's identical stub for Phase 8. When
 * `pdfDownloadUrl` is also given, renders two adjacent small format-choice
 * links (Excel/PDF) instead of the single "Export" link — both still plain
 * server-renderable `<a download>` links, no client JS required
 * (78-pdf-generation.md's UI section).
 */
export function ReportExportButton({ downloadUrl, pdfDownloadUrl }: ReportExportButtonProps) {
  if (!downloadUrl) {
    return (
      <Button variant="outline" disabled title="Export will be available once Excel Export ships">
        <Download size={16} />
        Export
      </Button>
    );
  }

  if (!pdfDownloadUrl) {
    return (
      <Button
        variant="outline"
        nativeButton={false}
        render={
          <a href={downloadUrl} download>
            <Download size={16} />
            Export
          </a>
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <a href={downloadUrl} download>
            <Download size={16} />
            Excel
          </a>
        }
      />
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <a href={pdfDownloadUrl} download>
            <Download size={16} />
            PDF
          </a>
        }
      />
    </div>
  );
}
