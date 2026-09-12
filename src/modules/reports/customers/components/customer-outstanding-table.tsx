import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerTypeBadge } from "@/modules/customers/components/customer-type-badge";
import type { CustomerOutstandingReport } from "@/types/customer-report";

interface CustomerOutstandingTableProps {
  report: CustomerOutstandingReport;
}

export function CustomerOutstandingTable({ report }: CustomerOutstandingTableProps) {
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
          <TableHead>Customer</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Outstanding Balance</TableHead>
          <TableHead className="text-right">Credit Limit</TableHead>
          <TableHead>Over Limit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.customerId}>
            <TableCell>{row.customerName}</TableCell>
            <TableCell>
              <CustomerTypeBadge customerType={row.customerType} />
            </TableCell>
            <TableCell className="text-right font-financial">{row.outstandingBalance.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.creditLimit === null ? "—" : row.creditLimit.toFixed(2)}</TableCell>
            <TableCell>
              {row.isOverLimit === null ? (
                <span className="text-muted-foreground">—</span>
              ) : row.isOverLimit ? (
                <Badge variant="outline" className="border-error/30 bg-error/10 text-error">
                  Over Limit
                </Badge>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
