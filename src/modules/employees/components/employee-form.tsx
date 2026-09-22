"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LoadingBar } from "@/components/common/loading-bar";
import { Form } from "@/components/ui/form";
import {
  createEmployeeAction,
  updateEmployeeAction,
} from "@/modules/employees/actions/employee-actions";
import { EmployeeAddressSection } from "@/modules/employees/components/employee-address-section";
import { EmployeeBranchLoginSection } from "@/modules/employees/components/employee-branch-login-section";
import { EmployeeContactSection } from "@/modules/employees/components/employee-contact-section";
import { EmployeeIdentitySection } from "@/modules/employees/components/employee-identity-section";
import { EmployeeSalarySection } from "@/modules/employees/components/employee-salary-section";
import {
  createEmployeeSchema,
  type CreateEmployeeInput,
} from "@/modules/employees/validation/employee-schema";
import type { Employee, EmployeeBranchOption, EmployeeUserOption } from "@/types/employee";

const LIST_PATH = "/masters/employees";

interface EmployeeFormProps {
  /** When present the form saves via update; otherwise it creates. Create
   * and Update share the same field set (61-employee-master.md) — one
   * component serves both screens, the warehouse-form.tsx/customer-form.tsx
   * simplification. */
  employee?: Employee;
  /** The branch picker's options (the company's active branches, plus, on
   * edit, the employee's current branch even if since deactivated). */
  branchOptions: EmployeeBranchOption[];
  /** The login-link picker's options (active, unlinked Users, plus, on
   * edit, the employee's own current link even if since deactivated). */
  userOptions: EmployeeUserOption[];
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function EmployeeForm({ employee, branchOptions, userOptions }: EmployeeFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = employee !== undefined;

  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      employeeCode: employee?.employeeCode ?? "",
      fullName: employee?.fullName ?? "",
      designation: employee?.designation ?? "",
      department: employee?.department ?? "",
      joiningDate: employee ? toDateInputValue(employee.joiningDate) : "",
      mobileNumber: employee?.mobileNumber ?? "",
      alternateMobile: employee?.alternateMobile ?? "",
      email: employee?.email ?? "",
      addressLine1: employee?.addressLine1 ?? "",
      addressLine2: employee?.addressLine2 ?? "",
      city: employee?.city ?? "",
      state: employee?.state ?? "",
      district: employee?.district ?? "",
      country: employee?.country ?? "India",
      pinCode: employee?.pinCode ?? "",
      branchId: employee?.branchId ?? undefined,
      userId: employee?.userId ?? undefined,
      basicSalary: employee?.basicSalary ?? undefined,
    },
  });

  async function handleSubmit(data: CreateEmployeeInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateEmployeeAction(employee.id, data)
        : await createEmployeeAction(data);

      if (result.success) {
        toast.success(isEdit ? "Employee saved successfully." : "Employee created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(
        result.error ?? (isEdit ? "Failed to save employee." : "Failed to create employee.")
      );
    } catch {
      // A Server Action can reject outright (network drop, server crash) —
      // surface it instead of silently re-enabling the button (the
      // warehouse-form.tsx/customer-form.tsx defensive convention).
      toast.error(isEdit ? "Failed to save employee." : "Failed to create employee.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-3xl flex-col gap-8">
        <EmployeeIdentitySection control={form.control} />
        <EmployeeContactSection control={form.control} />
        <EmployeeAddressSection control={form.control} />
        <EmployeeBranchLoginSection
          control={form.control}
          branchOptions={branchOptions}
          userOptions={userOptions}
        />
        <EmployeeSalarySection control={form.control} />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(LIST_PATH)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Saving" data-icon="inline-start" /> : null}
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Employee"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
