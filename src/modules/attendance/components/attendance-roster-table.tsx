"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { markAttendanceBulkAction } from "@/modules/attendance/actions/attendance-actions";
import type { AttendanceEmployeeOption, AttendanceStatus } from "@/types/attendance";

// A Base UI Select is controlled from its very first render only when its
// `value` is never `undefined` — an unmarked row's Select must still start
// on a real string value (this sentinel), never `undefined`, or selecting a
// status later flips it from uncontrolled to controlled and Base UI warns.
const UNMARKED = "UNMARKED" as const;

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "ON_LEAVE", label: "On Leave" },
];

interface RosterRowState {
  status: AttendanceStatus | typeof UNMARKED;
  remarks: string;
}

interface AttendanceRosterTableProps {
  employees: AttendanceEmployeeOption[];
  /** The caller must render this component with `key={date}` so a date
   * change remounts it fresh, re-baselining `rows` from `existingByEmployeeId`
   * — no `useEffect`/setState needed to re-sync state a key change already
   * resets. */
  date: string;
  /** The date's already-recorded status/remarks per employee, prefilled as
   * the row's starting state — re-marking is an upsert, never a distinct
   * "edit" (62-attendance.md's Business Rules). */
  existingByEmployeeId: Record<string, { status: AttendanceStatus; remarks: string | null }>;
  canEdit: boolean;
}

export function AttendanceRosterTable({
  employees,
  date,
  existingByEmployeeId,
  canEdit,
}: AttendanceRosterTableProps) {
  const [rows, setRows] = React.useState<Record<string, RosterRowState>>(() => {
    const initial: Record<string, RosterRowState> = {};
    for (const employee of employees) {
      const existing = existingByEmployeeId[employee.id];
      initial[employee.id] = {
        status: existing?.status ?? UNMARKED,
        remarks: existing?.remarks ?? "",
      };
    }
    return initial;
  });
  const [isSaving, setIsSaving] = React.useState(false);

  function updateRow(employeeId: string, update: Partial<RosterRowState>) {
    setRows((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...update } }));
  }

  async function handleSave() {
    const entries = employees
      .map((employee) => ({ employee, row: rows[employee.id] }))
      .filter((entry): entry is { employee: AttendanceEmployeeOption; row: RosterRowState & { status: AttendanceStatus } } =>
        entry.row.status !== UNMARKED
      )
      .map(({ employee, row }) => ({
        employeeId: employee.id,
        date,
        status: row.status,
        remarks: row.remarks || undefined,
      }));

    if (entries.length === 0) {
      toast.error("Mark at least one employee's status before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await markAttendanceBulkAction(entries);
      if (!result.success) {
        toast.error(result.error ?? "Failed to save attendance.");
        return;
      }
      toast.success(`Saved attendance for ${result.data} employee(s).`);
    } catch {
      toast.error("Failed to save attendance.");
    } finally {
      setIsSaving(false);
    }
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No active employees found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => {
            const row = rows[employee.id];
            return (
              <TableRow key={employee.id}>
                <TableCell>{employee.employeeCode}</TableCell>
                <TableCell>
                  <span className="font-medium text-foreground">{employee.fullName}</span>
                </TableCell>
                <TableCell>
                  <Select
                    value={row.status}
                    onValueChange={(next) =>
                      updateRow(employee.id, { status: next as AttendanceStatus })
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="w-40" aria-label={`Status for ${employee.fullName}`}>
                      <SelectValue>
                        {() => STATUS_OPTIONS.find((option) => option.value === row.status)?.label ?? "Unmarked"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMARKED}>Unmarked</SelectItem>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={row?.remarks ?? ""}
                    onChange={(event) => updateRow(employee.id, { remarks: event.target.value })}
                    placeholder="Optional"
                    maxLength={250}
                    disabled={!canEdit}
                    aria-label={`Remarks for ${employee.fullName}`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Roster"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
