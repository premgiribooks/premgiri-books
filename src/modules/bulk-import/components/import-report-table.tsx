import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportReport } from "@/types/bulk-import";

interface ImportReportTableProps {
  report: ImportReport;
}

export function ImportReportTable({ report }: ImportReportTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{report.createdCount}</span> created /{" "}
        <span className="font-medium text-destructive">{report.failedCount}</span> failed
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.map((row) => (
            <TableRow key={row.rowNumber} className={row.status === "failed" ? "bg-destructive/5" : undefined}>
              <TableCell className="font-financial">{row.rowNumber}</TableCell>
              <TableCell>
                <Badge variant={row.status === "created" ? "default" : "destructive"}>{row.status}</Badge>
              </TableCell>
              <TableCell className={row.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                {row.status === "failed" ? row.error : row.recordId}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
