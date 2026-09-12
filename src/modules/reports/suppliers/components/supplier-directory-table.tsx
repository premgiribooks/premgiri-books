import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SupplierStatusBadge } from "@/modules/suppliers/components/supplier-status-badge";
import type { SupplierDirectoryReport } from "@/types/supplier-report";

interface SupplierDirectoryTableProps {
  report: SupplierDirectoryReport;
}

export function SupplierDirectoryTable({ report }: SupplierDirectoryTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No suppliers found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Mobile</TableHead>
          <TableHead>GSTIN</TableHead>
          <TableHead className="text-right">Credit Days</TableHead>
          <TableHead>City / State</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.displayName}</TableCell>
            <TableCell>{row.mobileNumber ?? "—"}</TableCell>
            <TableCell>{row.gstin ?? "—"}</TableCell>
            <TableCell className="text-right font-financial">{row.creditDays === null ? "—" : row.creditDays}</TableCell>
            <TableCell>{[row.city, row.state].filter(Boolean).join(", ") || "—"}</TableCell>
            <TableCell>
              <SupplierStatusBadge isActive={row.isActive} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
