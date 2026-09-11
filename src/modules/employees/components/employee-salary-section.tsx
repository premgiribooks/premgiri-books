"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { CreateEmployeeInput } from "@/modules/employees/validation/employee-schema";

interface EmployeeSalarySectionProps {
  control: Control<CreateEmployeeInput>;
}

/** Salary: the single basicSalary figure Payroll (63-payroll.md) needs to
 * compute a run — nullable, since a new joiner's salary may not be
 * finalized yet. No allowances/deductions breakup in this first release
 * (61-employee-master.md's Do Not). */
export function EmployeeSalarySection({ control }: EmployeeSalarySectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Salary</h2>

      <FormField
        control={control}
        name="basicSalary"
        render={({ field }) => (
          <FormItem className="max-w-xs">
            <FormLabel>Basic Salary</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                step="0.01"
                {...field}
                value={field.value ?? ""}
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  field.onChange(Number.isNaN(value) ? undefined : value);
                }}
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              Optional. Leave blank until this employee&apos;s pay is finalized — Payroll
              excludes any employee with no basic salary set from a run.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
