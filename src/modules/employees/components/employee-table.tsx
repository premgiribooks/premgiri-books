"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  activateEmployeeAction,
  deactivateEmployeeAction,
} from "@/modules/employees/actions/employee-actions";
import { EmployeeStatusBadge } from "@/modules/employees/components/employee-status-badge";
import type { EmployeeWithRelations } from "@/types/employee";

interface EmployeeTableProps {
  employees: EmployeeWithRelations[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function EmployeeTable({ employees, canEdit = false, canManage = false }: EmployeeTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — the
  // hsn-code-table.tsx/warehouse-table.tsx review-fix pattern.
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  function markPending(id: string) {
    setPendingIds((prev) => new Set(prev).add(id));
  }

  function clearPending(id: string) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleToggleActive(employee: EmployeeWithRelations) {
    markPending(employee.id);
    const action = employee.isActive ? deactivateEmployeeAction : activateEmployeeAction;

    try {
      const result = await action(employee.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update employee status.");
        return;
      }
      toast.success(employee.isActive ? "Employee deactivated." : "Employee activated.");
    } catch {
      toast.error("Failed to update employee status.");
    } finally {
      clearPending(employee.id);
    }
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No employees found.</p>
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
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell>{employee.employeeCode}</TableCell>
            <TableCell>
              <span className="font-medium text-foreground">{employee.fullName}</span>
            </TableCell>
            <TableCell>
              {employee.designation ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              {employee.department ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              {employee.branch ? (
                employee.branch.branchName
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <EmployeeStatusBadge isActive={employee.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/masters/employees/${employee.id}/edit`}
                        aria-label="Edit employee"
                      >
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingIds.has(employee.id)}
                    onClick={() => handleToggleActive(employee)}
                  >
                    {employee.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
