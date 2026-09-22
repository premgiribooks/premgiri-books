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
import {
  createPaymentVoucherAction,
  getLedgerOutstandingBalanceAction,
} from "@/modules/manual-vouchers/actions/payment-voucher-actions";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import {
  createPaymentVoucherSchema,
  type CreatePaymentVoucherInput,
} from "@/modules/manual-vouchers/validation/payment-voucher-schema";
import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";
import type { PaymentModeOption } from "@/types/payment-mode";
import type { PaymentVoucherPrefill } from "@/modules/manual-vouchers/utils/resolve-payment-voucher-prefill";

interface PaymentVoucherFormProps {
  ledgerOptions: ManualVoucherLedgerOption[];
  paymentModes: PaymentModeOption[];
  /** 87-liability-settlement.md's own prefill — seeds the first Debit line's defaultValues when the New page resolved a valid `debitLedgerId`/`amount` query-param pair, and (93-payment-mode-integration-manual-vouchers.md) optionally the Payment Mode field when a valid `paymentModeId` hint was also present. */
  prefill?: PaymentVoucherPrefill;
}

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

function toOptions(ledgers: ManualVoucherLedgerOption[]): ProductOptionItem[] {
  return ledgers.map((ledger) => ({ id: ledger.id, label: ledger.name, isActive: true }));
}

/** The closest-matching active Payment Mode for a given ledger's class
 * (93-payment-mode-integration-manual-vouchers.md's UI section) — an exact
 * `ledgerClass` match wins over an `ANY` mode, which is the loosest fit.
 * Mirrors sales-invoice-payment-editor.tsx's identical helper. Returns
 * `undefined` when nothing matches — the field is simply left for the user
 * to pick manually, re-validated server-side regardless. */
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
 * Create form for a Payment Voucher (52-payment-voucher.md's UI section) —
 * one Credit ledger picker restricted to the Cash-in-Hand-or-bank-linked
 * subset, one or more Debit lines against any ledger, narration. Posting
 * (this screen has no separate Draft/Post step — Create *is* Post, per
 * spec) computes nothing client-side beyond a running total shown for the
 * user's own convenience; the server independently computes and validates
 * the actual balanced entry set.
 */
export function PaymentVoucherForm({ ledgerOptions, paymentModes, prefill }: PaymentVoucherFormProps) {
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

  const form = useForm<CreatePaymentVoucherInput>({
    resolver: zodResolver(createPaymentVoucherSchema),
    defaultValues: {
      voucherDate: new Date().toISOString().slice(0, 10),
      narration: "",
      creditLedgerId: "",
      paymentModeId: prefill?.paymentModeId ?? "",
      debitLines: [{ ledgerId: prefill?.ledgerId ?? "", amount: prefill?.amount ?? 0 }],
    },
  });
  const { control, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "debitLines" });

  function handleCreditLedgerChange(ledgerId: string) {
    setValue("creditLedgerId", ledgerId, { shouldValidate: true });
    const ledgerClass = ledgersById.get(ledgerId)?.ledgerClass ?? "NEITHER";
    const matchedModeId = closestMatchingPaymentModeId(ledgerClass, paymentModes);
    if (matchedModeId) {
      setValue("paymentModeId", matchedModeId, { shouldValidate: true });
    }
  }
  const debitLines = useWatch({ control, name: "debitLines" });
  const totalAmount = (debitLines ?? []).reduce((sum, line) => sum + (line?.amount || 0), 0);

  async function handleSubmit(data: CreatePaymentVoucherInput) {
    setIsSubmitting(true);
    try {
      const result = await createPaymentVoucherAction(data);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to create payment voucher.");
        return;
      }
      toast.success(`Payment voucher ${result.data.voucherNumber} posted successfully.`);
      router.push(`/accounting/payment-vouchers/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error("Failed to create payment voucher.");
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
            name="creditLedgerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paid From (Cash / Bank) *</FormLabel>
                <FormControl>
                  <ProductOptionSelector
                    options={cashOrBankOptions}
                    value={field.value || undefined}
                    onChange={(value) => handleCreditLedgerChange(value ?? "")}
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
          <h2 className="text-sm font-semibold text-foreground">Paid To</h2>
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
                        name={`debitLines.${index}.ledgerId`}
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
                        name={`debitLines.${index}.amount`}
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
            onClick={() => router.push("/accounting/payment-vouchers")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Posting" data-icon="inline-start" /> : null}
            {isSubmitting ? "Posting…" : "Post Payment Voucher"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
