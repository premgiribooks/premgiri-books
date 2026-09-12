import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { EmployeeDirectoryReport } from "@/types/employee-report";

interface EmployeeDirectoryTableProps {
  report: EmployeeDirectoryReport;
}

export function EmployeeDirectoryTable({ report }: EmployeeDirectoryTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No employees found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Designation</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.employeeCode}</TableCell>
            <TableCell className="font-medium text-foreground">{row.fullName}</TableCell>
            <TableCell>{row.designation ?? "—"}</TableCell>
            <TableCell>{row.department ?? "—"}</TableCell>
            <TableCell>{row.branchName ?? "—"}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={cn(
                  row.isActive
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-muted-foreground/20 bg-muted text-muted-foreground"
                )}
              >
                {row.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
