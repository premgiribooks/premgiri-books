import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AttendanceSummaryReport } from "@/types/employee-report";

interface EmployeeAttendanceSummaryTableProps {
  report: AttendanceSummaryReport;
}

export function EmployeeAttendanceSummaryTable({ report }: EmployeeAttendanceSummaryTableProps) {
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
          <TableHead>Employee</TableHead>
          <TableHead className="text-right">Present</TableHead>
          <TableHead className="text-right">Half Day</TableHead>
          <TableHead className="text-right">Absent</TableHead>
          <TableHead className="text-right">On Leave</TableHead>
          <TableHead className="text-right">Total Marked</TableHead>
          <TableHead className="text-right">Unmarked</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.employeeId}>
            <TableCell>
              <span className="font-medium text-foreground">{row.fullName}</span>
              <span className="ml-1 text-xs text-muted-foreground">({row.employeeCode})</span>
            </TableCell>
            <TableCell className="text-right font-financial">{row.presentDays}</TableCell>
            <TableCell className="text-right font-financial">{row.halfDays}</TableCell>
            <TableCell className="text-right font-financial">{row.absentDays}</TableCell>
            <TableCell className="text-right font-financial">{row.onLeaveDays}</TableCell>
            <TableCell className="text-right font-financial">{row.totalMarkedDays}</TableCell>
            <TableCell className="text-right font-financial">{row.unmarkedDays}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
