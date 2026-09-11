"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { numericFieldWidth } from "@/lib/utils";
import { createContraVoucherAction } from "@/modules/manual-vouchers/actions/contra-voucher-actions";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import {
  createContraVoucherSchema,
  type CreateContraVoucherInput,
} from "@/modules/manual-vouchers/validation/contra-voucher-schema";
import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";

interface ContraVoucherFormProps {
  ledgerOptions: ManualVoucherLedgerOption[];
}

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

function toOptions(ledgers: ManualVoucherLedgerOption[]): ProductOptionItem[] {
  return ledgers.map((ledger) => ({ id: ledger.id, label: ledger.name, isActive: true }));
}

/**
 * Create form for a Contra Voucher (54-contra-voucher.md's UI section) — the
 * strictest of the four manual-voucher screens: exactly one Debit and one
 * Credit entry, both ledger pickers restricted to the Cash-in-Hand-or-bank-linked
 * subset, a single amount field, narration. No add-line control — unlike
 * Payment/Receipt Voucher's variable-length free side, a Contra Voucher's
 * entry count is fixed at exactly one pair, so there is nothing to add.
 * Posting (this screen has no separate Draft/Post step — Create *is* Post,
 * per spec) computes nothing client-side; the server independently computes
 * and validates the actual balanced entry set.
 */
export function ContraVoucherForm({ ledgerOptions }: ContraVoucherFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const cashOrBankOptions = React.useMemo(
    () => toOptions(ledgerOptions.filter((ledger) => ledger.isCashOrBank)),
    [ledgerOptions]
  );

  const form = useForm<CreateContraVoucherInput>({
    resolver: zodResolver(createContraVoucherSchema),
    defaultValues: {
      voucherDate: new Date().toISOString().slice(0, 10),
      narration: "",
      fromLedgerId: "",
      toLedgerId: "",
      amount: 0,
    },
  });
  const { control } = form;

  async function handleSubmit(data: CreateContraVoucherInput) {
    setIsSubmitting(true);
    try {
      const result = await createContraVoucherAction(data);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to create contra voucher.");
        return;
      }
      toast.success(`Contra voucher ${result.data.voucherNumber} posted successfully.`);
      router.push(`/accounting/contra-vouchers/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error("Failed to create contra voucher.");
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
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount *</FormLabel>
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

          <FormField
            control={control}
            name="fromLedgerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From (Cash / Bank) *</FormLabel>
                <FormControl>
                  <ProductOptionSelector
                    options={cashOrBankOptions}
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? "")}
                    allowNone={false}
                    placeholder="Select the source Cash/Bank ledger"
                    emptyLabel="No Cash-in-Hand or bank ledger found"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="toLedgerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To (Cash / Bank) *</FormLabel>
                <FormControl>
                  <ProductOptionSelector
                    options={cashOrBankOptions}
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? "")}
                    allowNone={false}
                    placeholder="Select the destination Cash/Bank ledger"
                    emptyLabel="No Cash-in-Hand or bank ledger found"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
            onClick={() => router.push("/accounting/contra-vouchers")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Posting…" : "Post Contra Voucher"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
