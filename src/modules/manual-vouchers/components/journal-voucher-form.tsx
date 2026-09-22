"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { numericFieldWidth } from "@/lib/utils";
import { LoadingBar } from "@/components/common/loading-bar";
import { createJournalVoucherAction } from "@/modules/manual-vouchers/actions/journal-voucher-actions";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import {
  createJournalVoucherSchema,
  type CreateJournalVoucherInput,
} from "@/modules/manual-vouchers/validation/journal-voucher-schema";
import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";

interface JournalVoucherFormProps {
  ledgerOptions: ManualVoucherLedgerOption[];
}

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

function toOptions(ledgers: ManualVoucherLedgerOption[]): ProductOptionItem[] {
  return ledgers.map((ledger) => ({ id: ledger.id, label: ledger.name, isActive: true }));
}

/**
 * Create form for a Journal Voucher (55-journal-voucher.md's UI section) —
 * the least-configured, most-generic of the four manual-voucher screens: a
 * single freeform entry table, any combination of Debit/Credit lines against
 * any active ledger, no ledger-class restriction on either side (unlike
 * Payment/Receipt/Contra). The running Debit/Credit totals shown below the
 * table are a client-side convenience only — never the actual enforcement
 * point, which is `voucherEngine.postVoucher`'s own balanced-sum check.
 */
export function JournalVoucherForm({ ledgerOptions }: JournalVoucherFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const allLedgerOptions = React.useMemo(() => toOptions(ledgerOptions), [ledgerOptions]);

  const form = useForm<CreateJournalVoucherInput>({
    resolver: zodResolver(createJournalVoucherSchema),
    defaultValues: {
      voucherDate: new Date().toISOString().slice(0, 10),
      narration: "",
      entries: [
        { ledgerId: "", entryType: "DEBIT", amount: 0 },
        { ledgerId: "", entryType: "CREDIT", amount: 0 },
      ],
    },
  });
  const { control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "entries" });
  const entries = useWatch({ control, name: "entries" });
  const totalDebit = (entries ?? [])
    .filter((entry) => entry?.entryType === "DEBIT")
    .reduce((sum, entry) => sum + (entry?.amount || 0), 0);
  const totalCredit = (entries ?? [])
    .filter((entry) => entry?.entryType === "CREDIT")
    .reduce((sum, entry) => sum + (entry?.amount || 0), 0);
  const isBalanced = entries && entries.length > 0 && Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  async function handleSubmit(data: CreateJournalVoucherInput) {
    setIsSubmitting(true);
    try {
      const result = await createJournalVoucherAction(data);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to create journal voucher.");
        return;
      }
      toast.success(`Journal voucher ${result.data.voucherNumber} posted successfully.`);
      router.push(`/accounting/journal-vouchers/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error("Failed to create journal voucher.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-4xl flex-col gap-6">
        <FormField
          control={control}
          name="voucherDate"
          render={({ field }) => (
            <FormItem className="max-w-xs">
              <FormLabel>Voucher Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Entries</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((lineField, index) => (
                  <TableRow key={lineField.id}>
                    <TableCell className="min-w-56">
                      <FormField
                        control={control}
                        name={`entries.${index}.ledgerId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <ProductOptionSelector
                                options={allLedgerOptions}
                                value={field.value || undefined}
                                onChange={(value) => field.onChange(value ?? "")}
                                allowNone={false}
                                placeholder="Select a ledger"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell className="min-w-32">
                      <FormField
                        control={control}
                        name={`entries.${index}.entryType`}
                        render={({ field }) => (
                          <FormItem>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="DEBIT">Debit</SelectItem>
                                <SelectItem value="CREDIT">Credit</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={control}
                        name={`entries.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                min={0.01}
                                step="0.01"
                                style={{ width: numericFieldWidth(field.value) }}
                                {...field}
                                onChange={(event) => field.onChange(toNumberOrZero(event.target.valueAsNumber))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove line"
                        disabled={fields.length <= 2}
                        onClick={() => remove(index)}
                      >
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
              onClick={() => append({ ledgerId: "", entryType: "DEBIT", amount: 0 })}
            >
              <Plus size={16} />
              Add Line
            </Button>
            <p className="text-sm text-muted-foreground">
              Debit: <span className="font-financial text-foreground">{totalDebit.toFixed(2)}</span> · Credit:{" "}
              <span className="font-financial text-foreground">{totalCredit.toFixed(2)}</span>{" "}
              <span className={isBalanced ? "text-success" : "text-destructive"}>
                {isBalanced ? "Balanced" : "Not balanced"}
              </span>
            </p>
          </div>
        </div>

        <FormField
          control={control}
          name="narration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Narration</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/accounting/journal-vouchers")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Posting" data-icon="inline-start" /> : null}
            {isSubmitting ? "Posting…" : "Post Journal Voucher"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
