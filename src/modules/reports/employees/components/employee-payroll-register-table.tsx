import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PayrollRunStatusBadge } from "@/modules/payroll/components/payroll-run-status-badge";
import { formatPayrollRunDate } from "@/modules/payroll/utils/format-payroll-run-date";
import type { PayrollRegisterReport } from "@/types/employee-report";

interface EmployeePayrollRegisterTableProps {
  report: PayrollRegisterReport;
}

export function EmployeePayrollRegisterTable({ report }: EmployeePayrollRegisterTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No payroll runs found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total Net Salary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Link href={`/employees/payroll/${run.id}`} className="font-medium text-foreground hover:underline">
                {run.payrollNumber ?? "—"}
              </Link>
            </TableCell>
            <TableCell className="font-financial">
              {formatPayrollRunDate(run.periodStart)} – {formatPayrollRunDate(run.periodEnd)}
            </TableCell>
            <TableCell>
              <PayrollRunStatusBadge status={run.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{run.totalNetSalary.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
