import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface PayrollRunLineRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  basicSalary: number;
  totalDaysInPeriod: number;
  presentDays?: number;
  halfDays?: number;
  absentDays?: number;
  onLeaveDays?: number;
  workedDays: number;
  netSalary: number;
}

interface PayrollRunLineTableProps {
  lines: readonly PayrollRunLineRow[];
  totalNetSalary: number;
}

/**
 * Shared per-employee line table — used both by the Create Payroll Run
 * screen's live preview (`PayrollRunLine[]`, which carries the per-status
 * attendance breakdown) and the View Payroll Run screen's posted line
 * breakdown (`PayrollRunItem[]`, which does not). The attendance columns
 * render only when the first row actually carries that breakdown.
 */
export function PayrollRunLineTable({ lines, totalNetSalary }: PayrollRunLineTableProps) {
  const showAttendanceBreakdown = lines.length > 0 && lines[0].presentDays !== undefined;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No employees are included in this run.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead className="text-right">Basic Salary</TableHead>
          {showAttendanceBreakdown ? (
            <>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Half Day</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">On Leave</TableHead>
            </>
          ) : null}
          <TableHead className="text-right">Total Days</TableHead>
          <TableHead className="text-right">Worked Days</TableHead>
          <TableHead className="text-right">Net Salary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.employeeId}>
            <TableCell>
              <span className="font-medium text-foreground">{line.fullName}</span>
              <span className="ml-1 text-xs text-muted-foreground">({line.employeeCode})</span>
            </TableCell>
            <TableCell className="text-right font-financial">{line.basicSalary.toFixed(2)}</TableCell>
            {showAttendanceBreakdown ? (
              <>
                <TableCell className="text-right font-financial">{line.presentDays}</TableCell>
                <TableCell className="text-right font-financial">{line.halfDays}</TableCell>
                <TableCell className="text-right font-financial">{line.absentDays}</TableCell>
                <TableCell className="text-right font-financial">{line.onLeaveDays}</TableCell>
              </>
            ) : null}
            <TableCell className="text-right font-financial">{line.totalDaysInPeriod}</TableCell>
            <TableCell className="text-right font-financial">{line.workedDays.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{line.netSalary.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={showAttendanceBreakdown ? 8 : 4} className="text-right font-medium">
            Total Net Salary
          </TableCell>
          <TableCell className="text-right font-financial font-medium">{totalNetSalary.toFixed(2)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
