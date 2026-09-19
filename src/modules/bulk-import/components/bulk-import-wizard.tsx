"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  commitImportAction,
  downloadErrorReportAction,
  uploadAndPreviewAction,
} from "@/modules/bulk-import/actions/bulk-import-actions";
import type { ParsedRow } from "@/modules/bulk-import/services/bulk-import-service";
import { ImportFileDropzone } from "@/modules/bulk-import/components/import-file-dropzone";
import { ImportPreviewTable } from "@/modules/bulk-import/components/import-preview-table";
import { ImportReportTable } from "@/modules/bulk-import/components/import-report-table";
import type { BulkImportTargetKey, ImportColumn, ImportPreviewResult, ImportReport } from "@/types/bulk-import";

interface BulkImportWizardProps {
  target: BulkImportTargetKey;
  targetLabel: string;
  listHref: string;
}

type WizardStep = "choose" | "preview" | "report";

function triggerBase64Download(base64: string, filename: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * The shared, target-parameterized wizard shell (76-excel-import.md's UI
 * section) — one component driving Products/Customers/Suppliers alike,
 * mirroring manual-voucher.md's ManualVoucherForm precedent.
 */
export function BulkImportWizard({ target, targetLabel, listHref }: BulkImportWizardProps) {
  const [step, setStep] = React.useState<WizardStep>("choose");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [columns, setColumns] = React.useState<ImportColumn[]>([]);
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [preview, setPreview] = React.useState<ImportPreviewResult | null>(null);
  const [report, setReport] = React.useState<ImportReport | null>(null);

  async function handleFileSelected(file: File) {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("target", target);
    formData.set("file", file);

    const result = await uploadAndPreviewAction(formData);
    setIsSubmitting(false);

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Could not read this file.");
      return;
    }

    setColumns(result.data.columns);
    setRows(result.data.rows);
    setPreview(result.data.preview);
    setStep("preview");
  }

  function handleCancelPreview() {
    setColumns([]);
    setRows([]);
    setPreview(null);
    setStep("choose");
  }

  async function handleCommit() {
    if (!preview) {
      return;
    }
    const validRowNumbers = new Set(
      preview.rows.filter((row) => row.status === "valid").map((row) => row.rowNumber)
    );
    const rowsToCommit = rows.filter((row) => validRowNumbers.has(row.rowNumber));

    setIsSubmitting(true);
    const result = await commitImportAction(target, rowsToCommit);
    setIsSubmitting(false);

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Import failed.");
      return;
    }

    setReport(result.data);
    setStep("report");
  }

  async function handleDownloadErrorReport() {
    if (!report) {
      return;
    }
    const result = await downloadErrorReportAction(target, report);
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Could not build the error report.");
      return;
    }
    triggerBase64Download(result.data.base64, result.data.filename);
  }

  function handleStartOver() {
    setColumns([]);
    setRows([]);
    setPreview(null);
    setReport(null);
    setStep("choose");
  }

  return (
    <div className="flex flex-col gap-6">
      {step === "choose" && (
        <ImportFileDropzone
          target={target}
          targetLabel={targetLabel}
          isUploading={isSubmitting}
          onFileSelected={handleFileSelected}
        />
      )}

      {step === "preview" && preview && (
        <div className="flex flex-col gap-4">
          <ImportPreviewTable columns={columns} preview={preview} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={handleCancelPreview}>
              Cancel
            </Button>
            <Button type="button" disabled={isSubmitting || preview.validCount === 0} onClick={handleCommit}>
              {isSubmitting ? "Importing…" : `Import ${preview.validCount} Valid Row${preview.validCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {step === "report" && report && (
        <div className="flex flex-col gap-4">
          <ImportReportTable report={report} />
          <div className="flex justify-end gap-2">
            {report.failedCount > 0 && (
              <Button type="button" variant="outline" onClick={handleDownloadErrorReport}>
                Download Error Report
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleStartOver}>
              Import Another File
            </Button>
            <Button type="button" nativeButton={false} render={<Link href={listHref}>Done</Link>} />
          </div>
        </div>
      )}
    </div>
  );
}
