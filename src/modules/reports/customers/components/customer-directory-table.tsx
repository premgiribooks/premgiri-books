import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerStatusBadge } from "@/modules/customers/components/customer-status-badge";
import { CustomerTypeBadge } from "@/modules/customers/components/customer-type-badge";
import type { CustomerDirectoryReport } from "@/types/customer-report";

interface CustomerDirectoryTableProps {
  report: CustomerDirectoryReport;
}

export function CustomerDirectoryTable({ report }: CustomerDirectoryTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No customers found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Mobile</TableHead>
          <TableHead>GSTIN</TableHead>
          <TableHead>City / State</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.displayName}</TableCell>
            <TableCell>
              <CustomerTypeBadge customerType={row.customerType} />
            </TableCell>
            <TableCell>{row.mobileNumber ?? "—"}</TableCell>
            <TableCell>{row.gstin ?? "—"}</TableCell>
            <TableCell>{[row.city, row.state].filter(Boolean).join(", ") || "—"}</TableCell>
            <TableCell>
              <CustomerStatusBadge isActive={row.isActive} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
