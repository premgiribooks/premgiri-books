"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { CreateEmployeeInput } from "@/modules/employees/validation/employee-schema";

interface EmployeeContactSectionProps {
  control: Control<CreateEmployeeInput>;
}

/** Contact: mobile numbers and email — all optional, mirroring
 * customer-contact-section.tsx's shape. */
export function EmployeeContactSection({ control }: EmployeeContactSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Contact</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="mobileNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile Number</FormLabel>
              <FormControl>
                <Input inputMode="numeric" maxLength={10} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="alternateMobile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alternate Mobile</FormLabel>
              <FormControl>
                <Input inputMode="numeric" maxLength={10} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="email"
        render={({ field }) => (
          <FormItem className="max-w-sm">
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
