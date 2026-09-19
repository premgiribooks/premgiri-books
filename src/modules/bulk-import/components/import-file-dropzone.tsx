"use client";

import * as React from "react";
import { Download, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isAllowedImportFilename } from "@/modules/bulk-import/validation/bulk-import-schema";
import type { BulkImportTargetKey } from "@/types/bulk-import";

interface ImportFileDropzoneProps {
  target: BulkImportTargetKey;
  targetLabel: string;
  isUploading: boolean;
  onFileSelected: (file: File) => void;
}

/** Click-to-browse file select, mirroring logo-upload.tsx's established convention — no drag-and-drop, this codebase has no existing precedent for it. */
export function ImportFileDropzone({ target, targetLabel, isUploading, onFileSelected }: ImportFileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!isAllowedImportFilename(file.name)) {
      setError("Only .xlsx or .csv files can be imported.");
      return;
    }
    setError(null);
    onFileSelected(file);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
      <p className="text-sm text-muted-foreground">
        Upload an .xlsx or .csv file of {targetLabel.toLowerCase()} to create in bulk.
      </p>

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
        />
        <Button type="button" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          <Upload size={16} />
          {isUploading ? "Uploading…" : "Choose File"}
        </Button>
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={
            <a href={`/api/bulk-import/template?target=${target}`} download>
              <Download size={16} />
              Download Template
            </a>
          }
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
