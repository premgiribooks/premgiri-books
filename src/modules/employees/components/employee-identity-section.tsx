"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { CreateEmployeeInput } from "@/modules/employees/validation/employee-schema";

interface EmployeeIdentitySectionProps {
  control: Control<CreateEmployeeInput>;
}

/** Identity: employee code, full name, designation, department, joining
 * date. Designation/department are plain free text, not an enum
 * (61-employee-master.md's Data Model — no fixed department taxonomy this
 * codebase can assume for every business). */
export function EmployeeIdentitySection({ control }: EmployeeIdentitySectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Identity</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="employeeCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employee Code *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. EMP-001" />
              </FormControl>
              <p className="text-xs text-muted-foreground">Unique per company.</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="designation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Designation</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="e.g. Sales Executive" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="e.g. Sales" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="joiningDate"
        render={({ field }) => (
          <FormItem className="max-w-xs">
            <FormLabel>Joining Date *</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
