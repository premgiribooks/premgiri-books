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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { numericFieldWidth } from "@/lib/utils";
import { LedgerOutstandingBalance } from "@/components/common/ledger-outstanding-balance";
import { LoadingBar } from "@/components/common/loading-bar";
import { getLedgerOutstandingBalanceAction } from "@/modules/manual-vouchers/actions/payment-voucher-actions";
import { createReceiptVoucherAction } from "@/modules/manual-vouchers/actions/receipt-voucher-actions";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import {
  createReceiptVoucherSchema,
  type CreateReceiptVoucherInput,
} from "@/modules/manual-vouchers/validation/receipt-voucher-schema";
import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";
import type { PaymentModeOption } from "@/types/payment-mode";
import type { ReceiptVoucherPrefill } from "@/modules/manual-vouchers/utils/resolve-receipt-voucher-prefill";

interface ReceiptVoucherFormProps {
  ledgerOptions: ManualVoucherLedgerOption[];
  paymentModes: PaymentModeOption[];
  /** Seeds the first Credit line's ("Received From") defaultValues when the
   * New page resolved a valid `creditLedgerId`/`amount` query-param pair —
   * e.g. a Sales Invoice's "Receipt" action prefilling that invoice's own
   * outstanding customer balance. Mirrors PaymentVoucherForm's own
   * `prefill` prop. */
  prefill?: ReceiptVoucherPrefill;
}

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

function toOptions(ledgers: ManualVoucherLedgerOption[]): ProductOptionItem[] {
  return ledgers.map((ledger) => ({ id: ledger.id, label: ledger.name, isActive: true }));
}

/** The closest-matching active Payment Mode for a given ledger's class
 * (93-payment-mode-integration-manual-vouchers.md's UI section) — mirrors
 * payment-voucher-form.tsx's identical helper. */
function closestMatchingPaymentModeId(
  ledgerClass: "CASH" | "BANK" | "NEITHER",
  paymentModes: readonly PaymentModeOption[]
): string | undefined {
  const exact = paymentModes.find((mode) => mode.ledgerClass === ledgerClass);
  if (exact) {
    return exact.id;
  }
  if (ledgerClass === "NEITHER") {
    return undefined;
  }
  return paymentModes.find((mode) => mode.ledgerClass === "ANY")?.id;
}

/**
 * Create form for a Receipt Voucher (53-receipt-voucher.md's UI section) —
 * the mirror of `PaymentVoucherForm` with the entry direction reversed: one
 * Debit ledger picker restricted to the Cash-in-Hand-or-bank-linked subset,
 * one or more Credit lines against any ledger, narration. Posting (this
 * screen has no separate Draft/Post step — Create *is* Post, per spec)
 * computes nothing client-side beyond a running total shown for the user's
 * own convenience; the server independently computes and validates the
 * actual balanced entry set.
 */
export function ReceiptVoucherForm({ ledgerOptions, paymentModes, prefill }: ReceiptVoucherFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const cashOrBankOptions = React.useMemo(
    () => toOptions(ledgerOptions.filter((ledger) => ledger.isCashOrBank)),
    [ledgerOptions]
  );
  const allLedgerOptions = React.useMemo(() => toOptions(ledgerOptions), [ledgerOptions]);
  const paymentModeOptions = React.useMemo(
    () => paymentModes.map((mode) => ({ id: mode.id, label: mode.name, isActive: true })),
    [paymentModes]
  );
  const ledgersById = React.useMemo(() => new Map(ledgerOptions.map((ledger) => [ledger.id, ledger])), [ledgerOptions]);

  const form = useForm<CreateReceiptVoucherInput>({
    resolver: zodResolver(createReceiptVoucherSchema),
    defaultValues: {
      voucherDate: new Date().toISOString().slice(0, 10),
      narration: "",
      debitLedgerId: "",
      paymentModeId: prefill?.paymentModeId ?? "",
      creditLines: [{ ledgerId: prefill?.ledgerId ?? "", amount: prefill?.amount ?? 0 }],
    },
  });
  const { control, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "creditLines" });

  function handleDebitLedgerChange(ledgerId: string) {
    setValue("debitLedgerId", ledgerId, { shouldValidate: true });
    const ledgerClass = ledgersById.get(ledgerId)?.ledgerClass ?? "NEITHER";
    const matchedModeId = closestMatchingPaymentModeId(ledgerClass, paymentModes);
    if (matchedModeId) {
      setValue("paymentModeId", matchedModeId, { shouldValidate: true });
    }
  }
  const creditLines = useWatch({ control, name: "creditLines" });
  const totalAmount = (creditLines ?? []).reduce((sum, line) => sum + (line?.amount || 0), 0);

  async function handleSubmit(data: CreateReceiptVoucherInput) {
    setIsSubmitting(true);
    try {
      const result = await createReceiptVoucherAction(data);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to create receipt voucher.");
        return;
      }
      toast.success(`Receipt voucher ${result.data.voucherNumber} posted successfully.`);
      router.push(`/accounting/receipt-vouchers/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error("Failed to create receipt voucher.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-3xl flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={control}
            name="voucherDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Voucher Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="debitLedgerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Received In (Cash / Bank) *</FormLabel>
                <FormControl>
                  <ProductOptionSelector
                    options={cashOrBankOptions}
                    value={field.value || undefined}
                    onChange={(value) => handleDebitLedgerChange(value ?? "")}
                    allowNone={false}
                    placeholder="Select the Cash/Bank ledger"
                    emptyLabel="No Cash-in-Hand or bank ledger found"
                  />
                </FormControl>
                <LedgerOutstandingBalance ledgerId={field.value || undefined} fetchBalance={getLedgerOutstandingBalanceAction} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="paymentModeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode *</FormLabel>
                <FormControl>
                  <ProductOptionSelector
                    options={paymentModeOptions}
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? "")}
                    allowNone={false}
                    placeholder="Select a mode"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Received From</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ledger</TableHead>
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
                        name={`creditLines.${index}.ledgerId`}
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
                            <LedgerOutstandingBalance ledgerId={field.value || undefined} fetchBalance={getLedgerOutstandingBalanceAction} />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={control}
                        name={`creditLines.${index}.amount`}
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
                        disabled={fields.length <= 1}
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
            <Button type="button" variant="outline" size="sm" onClick={() => append({ ledgerId: "", amount: 0 })}>
              <Plus size={16} />
              Add Line
            </Button>
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-financial text-foreground">{totalAmount.toFixed(2)}</span>
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
            onClick={() => router.push("/accounting/receipt-vouchers")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Posting" data-icon="inline-start" /> : null}
            {isSubmitting ? "Posting…" : "Post Receipt Voucher"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
