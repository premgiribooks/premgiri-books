import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPayrollRunDate } from "@/modules/payroll/utils/format-payroll-run-date";
import type { SalaryRegisterReport } from "@/types/employee-report";

interface EmployeeSalaryRegisterTableProps {
  report: SalaryRegisterReport;
}

/** POSTED runs only, per 73-employee-reports.md's Business Rules #3 — the
 * service layer already excludes DRAFT/CANCELLED runs, so every row here is
 * a run the employee was actually paid under. */
export function EmployeeSalaryRegisterTable({ report }: EmployeeSalaryRegisterTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No posted payroll history found for {report.employeeName}.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Payroll Number</TableHead>
          <TableHead>Period</TableHead>
          <TableHead className="text-right">Basic Salary</TableHead>
          <TableHead className="text-right">Worked Days</TableHead>
          <TableHead className="text-right">Total Days</TableHead>
          <TableHead className="text-right">Net Salary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.payrollRunId}>
            <TableCell>
              <Link href={`/employees/payroll/${row.payrollRunId}`} className="font-medium text-foreground hover:underline">
                {row.payrollNumber ?? "—"}
              </Link>
            </TableCell>
            <TableCell className="font-financial">
              {formatPayrollRunDate(row.periodStart)} – {formatPayrollRunDate(row.periodEnd)}
            </TableCell>
            <TableCell className="text-right font-financial">{row.basicSalary.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.workedDays.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.totalDaysInPeriod}</TableCell>
            <TableCell className="text-right font-financial">{row.netSalary.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
