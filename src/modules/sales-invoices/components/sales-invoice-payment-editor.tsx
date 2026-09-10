"use client";

import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { CreateSalesInvoiceInput } from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type { SalesInvoicePaymentLedgerOption } from "@/types/sales-invoice";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface SalesInvoicePaymentEditorProps {
  paymentLedgers: SalesInvoicePaymentLedgerOption[];
  grandTotal: number;
}

/** Payment-lines editor with a running "Amount Due" display
 * (38-sales-invoice.md's UI section). WALK_IN requires this to sum exactly
 * to `grandTotal`; every other mode is capped at `<= grandTotal` — both
 * re-validated server-side at draft-save and posting time, this is
 * display-only guidance. */
export function SalesInvoicePaymentEditor({ paymentLedgers, grandTotal }: SalesInvoicePaymentEditorProps) {
  const { control } = useFormContext<CreateSalesInvoiceInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "payments" });
  const payments = useWatch({ control, name: "payments" });

  const ledgerOptions: ProductOptionItem[] = React.useMemo(
    () => paymentLedgers.map((ledger) => ({ id: ledger.id, label: `${ledger.name} (${ledger.groupName})`, isActive: true })),
    [paymentLedgers]
  );

  const paidTotal = (payments ?? []).reduce((sum, payment) => sum + (payment?.amount || 0), 0);
  const amountDue = grandTotal - paidTotal;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ledger</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell className="min-w-56">
                  <FormField
                    control={control}
                    name={`payments.${index}.ledgerId`}
                    render={({ field: ledgerField }) => (
                      <FormItem>
                        <FormControl>
                          <ProductOptionSelector
                            options={ledgerOptions}
                            value={ledgerField.value || undefined}
                            onChange={(value) => ledgerField.onChange(value ?? "")}
                            allowNone={false}
                            placeholder="Select a ledger"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={control}
                    name={`payments.${index}.amount`}
                    render={({ field: amountField }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            min={0.01}
                            step="0.01"
                            style={{ width: numericFieldWidth(amountField.value) }}
                            {...amountField}
                            onChange={(event) => amountField.onChange(toNumberOrZero(event.target.valueAsNumber))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={control}
                    name={`payments.${index}.reference`}
                    render={({ field: referenceField }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...referenceField} value={referenceField.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove payment" onClick={() => remove(index)}>
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ ledgerId: "", amount: 0, reference: undefined })}
        >
          <Plus size={16} />
          Add Payment
        </Button>
        <p className="text-sm text-muted-foreground">
          Amount Due: <span className="font-financial text-foreground">{amountDue.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
