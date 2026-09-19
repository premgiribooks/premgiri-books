import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportColumn, ImportPreviewResult } from "@/types/bulk-import";

interface ImportPreviewTableProps {
  columns: ImportColumn[];
  preview: ImportPreviewResult;
}

export function ImportPreviewTable({ columns, preview }: ImportPreviewTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{preview.validCount}</span> valid /{" "}
        <span className="font-medium text-destructive">{preview.invalidCount}</span> invalid of {preview.rows.length}{" "}
        row{preview.rows.length === 1 ? "" : "s"}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            <TableHead>Status</TableHead>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.header}</TableHead>
            ))}
            <TableHead>Errors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.rows.map((row) => (
            <TableRow key={row.rowNumber} className={row.status === "invalid" ? "bg-destructive/5" : undefined}>
              <TableCell className="font-financial">{row.rowNumber}</TableCell>
              <TableCell>
                <Badge variant={row.status === "valid" ? "default" : "destructive"}>{row.status}</Badge>
              </TableCell>
              {columns.map((column) => (
                <TableCell key={column.key}>{row.raw[column.key] || "—"}</TableCell>
              ))}
              <TableCell className="text-destructive">{row.errors.join(" ")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
