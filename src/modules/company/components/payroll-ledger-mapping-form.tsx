"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { updatePayrollLedgerMappingAction } from "@/modules/company/actions/company-actions";
import {
  payrollLedgerMappingSchema,
  type PayrollLedgerMappingInput,
} from "@/modules/company/validation/company-schema";
import { LedgerSelector } from "@/modules/ledgers/components/ledger-selector";
import type { LedgerWithGroup } from "@/types/ledger";

interface PayrollLedgerMappingFormProps {
  companyId: string;
  ledgers: LedgerWithGroup[];
  defaultValues: PayrollLedgerMappingInput;
  disabled: boolean;
}

const FIELDS: { name: keyof PayrollLedgerMappingInput; label: string }[] = [
  { name: "salaryExpenseLedgerId", label: "Salary Expense" },
  { name: "salaryPayableLedgerId", label: "Salary Payable" },
];

/** Payroll's (63-payroll.md) posting-time ledger mapping — mirrors
 * SalesLedgerMappingForm's shape exactly, two fields instead of eleven. */
export function PayrollLedgerMappingForm({ companyId, ledgers, defaultValues, disabled }: PayrollLedgerMappingFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PayrollLedgerMappingInput>({
    resolver: zodResolver(payrollLedgerMappingSchema),
    defaultValues,
  });

  async function handleSubmit(data: PayrollLedgerMappingInput) {
    setIsSubmitting(true);
    const result = await updatePayrollLedgerMappingAction(companyId, data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("Payroll ledger mapping saved successfully.");
      return;
    }
    toast.error(result.error ?? "Failed to save the ledger mapping.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map(({ name, label }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <LedgerSelector
                      ledgers={ledgers}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={disabled}
                      allowNone
                      placeholder={`Select the ${label} ledger`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        {!disabled ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Mapping"}
            </Button>
          </div>
        ) : null}
      </form>
    </Form>
  );
}
