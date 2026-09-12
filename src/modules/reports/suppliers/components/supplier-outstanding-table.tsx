import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SupplierOutstandingReport } from "@/types/supplier-report";

interface SupplierOutstandingTableProps {
  report: SupplierOutstandingReport;
}

export function SupplierOutstandingTable({ report }: SupplierOutstandingTableProps) {
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
          <TableHead>Supplier</TableHead>
          <TableHead className="text-right">Outstanding Balance</TableHead>
          <TableHead className="text-right">Credit Days</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.supplierId}>
            <TableCell>{row.supplierName}</TableCell>
            <TableCell className="text-right font-financial">{row.outstandingBalance.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.creditDays === null ? "—" : row.creditDays}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
