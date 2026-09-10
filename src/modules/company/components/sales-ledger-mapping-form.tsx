"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { updateSalesLedgerMappingAction } from "@/modules/company/actions/company-actions";
import {
  salesLedgerMappingSchema,
  type SalesLedgerMappingInput,
} from "@/modules/company/validation/company-schema";
import { LedgerSelector } from "@/modules/ledgers/components/ledger-selector";
import type { LedgerWithGroup } from "@/types/ledger";

interface SalesLedgerMappingFormProps {
  companyId: string;
  ledgers: LedgerWithGroup[];
  defaultValues: SalesLedgerMappingInput;
  disabled: boolean;
}

const FIELDS: { name: keyof SalesLedgerMappingInput; label: string }[] = [
  { name: "salesLedgerId", label: "Sales Account" },
  { name: "outputCgstLedgerId", label: "Output CGST" },
  { name: "outputSgstLedgerId", label: "Output SGST" },
  { name: "outputIgstLedgerId", label: "Output IGST" },
  { name: "outputCessLedgerId", label: "Output Cess" },
  { name: "roundOffLedgerId", label: "Round Off" },
];

/** Sales Invoice's posting-time ledger mapping (38-sales-invoice.md) — a
 * separate section/permission gate ("settings"/"edit") from the operational
 * Company Settings tab on Profile ("company"/"edit"). Posting a Sales
 * Invoice requires all six configured; this form allows a partial save. */
export function SalesLedgerMappingForm({ companyId, ledgers, defaultValues, disabled }: SalesLedgerMappingFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<SalesLedgerMappingInput>({
    resolver: zodResolver(salesLedgerMappingSchema),
    defaultValues,
  });

  async function handleSubmit(data: SalesLedgerMappingInput) {
    setIsSubmitting(true);
    const result = await updateSalesLedgerMappingAction(companyId, data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("Sales & GST ledger mapping saved successfully.");
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
