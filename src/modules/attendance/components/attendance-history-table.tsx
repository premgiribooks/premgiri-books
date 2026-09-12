import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AttendanceStatusBadge } from "@/modules/attendance/components/attendance-status-badge";
import type { AttendanceWithRelations } from "@/types/attendance";

interface AttendanceHistoryTableProps {
  records: AttendanceWithRelations[];
}

function toDisplayDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function AttendanceHistoryTable({ records }: AttendanceHistoryTableProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No attendance records found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Remarks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell>{toDisplayDate(record.date)}</TableCell>
            <TableCell>{record.employee.employeeCode}</TableCell>
            <TableCell>
              <span className="font-medium text-foreground">{record.employee.fullName}</span>
            </TableCell>
            <TableCell>
              <AttendanceStatusBadge status={record.status} />
            </TableCell>
            <TableCell>
              {record.remarks ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
