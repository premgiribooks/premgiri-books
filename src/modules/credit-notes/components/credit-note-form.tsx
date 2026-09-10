"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GST_STATE_CODES } from "@/engines/gst/state-codes";
import { createCreditNoteDraftAction, updateCreditNoteDraftAction } from "@/modules/credit-notes/actions/credit-note-actions";
import { CreditNoteLineEditor } from "@/modules/credit-notes/components/credit-note-line-editor";
import { REFUND_MODE_VALUES, createCreditNoteSchema, type CreateCreditNoteInput } from "@/modules/credit-notes/validation/credit-note-schema";
import type { CreditNoteDetail, CreditNoteFormOptions } from "@/types/credit-note";

const LIST_PATH = "/sales/credit-notes";
// Base UI's Select decides controlled-vs-uncontrolled on the first render by
// checking whether `value` is `undefined` — mirrors sales-return-form.tsx's
// NONE_VALUE fix exactly (commit f45f7c1).
const NONE_VALUE = "__none__";

type RefundMode = (typeof REFUND_MODE_VALUES)[number];

const REFUND_MODE_LABELS: Record<RefundMode, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

interface CreditNoteFormProps {
  options: CreditNoteFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  creditNote?: CreditNoteDetail;
}

export function CreditNoteForm({ options, creditNote }: CreditNoteFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = creditNote !== undefined;

  const form = useForm<CreateCreditNoteInput>({
    resolver: zodResolver(createCreditNoteSchema),
    defaultValues: {
      customerId: creditNote?.customerId ?? "",
      salesInvoiceId: creditNote?.salesInvoiceId ?? undefined,
      noteDate: creditNote ? toDateInputValue(creditNote.noteDate) : todayDateInputValue(),
      placeOfSupplyStateCode: creditNote?.placeOfSupplyStateCode ?? "",
      reason: creditNote?.reason ?? "",
      refundMode: creditNote?.refundMode ?? "LEDGER_ADJUSTMENT",
      refundLedgerId: creditNote?.refundLedgerId ?? undefined,
      lines: creditNote
        ? creditNote.items.map((item) => ({
            description: item.description,
            taxableAmount: item.taxableAmount,
            ratePercent: item.ratePercent,
            cessPercent: item.cessPercent,
          }))
        : [{ description: "", taxableAmount: 0, ratePercent: 0, cessPercent: 0 }],
    },
  });

  const refundMode = useWatch({ control: form.control, name: "refundMode" });
  const salesInvoiceId = useWatch({ control: form.control, name: "salesInvoiceId" });

  function applyInvoicePrefill(invoiceId: string | undefined) {
    form.setValue("salesInvoiceId", invoiceId, { shouldValidate: true });
    if (!invoiceId) {
      return;
    }
    const invoice = options.invoices.find((option) => option.id === invoiceId);
    if (!invoice) {
      return;
    }
    form.setValue("customerId", invoice.customerId, { shouldValidate: true });
    form.setValue("placeOfSupplyStateCode", invoice.placeOfSupplyStateCode, { shouldValidate: true });
  }

  async function handleSubmit(values: CreateCreditNoteInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateCreditNoteDraftAction(creditNote.id, values)
        : await createCreditNoteDraftAction(values);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save credit note." : "Failed to create credit note."));
        return;
      }

      toast.success(isEdit ? "Credit note saved successfully." : "Credit note created successfully.");
      router.push(isEdit ? `${LIST_PATH}/${creditNote.id}` : `${LIST_PATH}/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save credit note." : "Failed to create credit note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!options.isLedgerMappingComplete ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            The Sales &amp; GST ledger mapping is incomplete — posting will be blocked until Settings &gt; Sales &amp;
            GST Ledgers is fully configured.
          </p>
        ) : null}

        <FormSection title="Details">
          <FormItem>
            <FormLabel>Link Sales Invoice (optional)</FormLabel>
            <FormControl>
              <Select
                value={salesInvoiceId ?? NONE_VALUE}
                onValueChange={(next) => applyInvoicePrefill(!next || next === NONE_VALUE ? undefined : next)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No linked invoice">
                    {(current: string | null) => {
                      if (!current || current === NONE_VALUE) {
                        return "No linked invoice";
                      }
                      return options.invoices.find((invoice) => invoice.id === current)?.invoiceNumber ?? "No linked invoice";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>No linked invoice</SelectItem>
                  {options.invoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} — {invoice.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          </FormItem>

          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer *</FormLabel>
                <FormControl>
                  <Select value={field.value || NONE_VALUE} onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? "" : next)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a customer">
                        {(current: string | null) => {
                          if (!current || current === NONE_VALUE) {
                            return "Select a customer";
                          }
                          return options.customers.find((customer) => customer.id === current)?.name ?? "Select a customer";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {options.customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="noteDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="placeOfSupplyStateCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Place of Supply *</FormLabel>
                <FormControl>
                  <Select value={field.value || NONE_VALUE} onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? "" : next)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a state">
                        {(current: string | null) => {
                          if (!current || current === NONE_VALUE) {
                            return "Select a state";
                          }
                          return GST_STATE_CODES.find((state) => state.code === current)?.name ?? "Select a state";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {GST_STATE_CODES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="refundMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Refund Mode *</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={(next) => field.onChange(next ?? "LEDGER_ADJUSTMENT")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(current: string | null) => REFUND_MODE_LABELS[current as RefundMode] ?? "Select refund mode"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {REFUND_MODE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {REFUND_MODE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {refundMode === "CASH_REFUND" ? (
            <FormField
              control={form.control}
              name="refundLedgerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refund Ledger *</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value || NONE_VALUE}
                      onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? "" : next)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a ledger">
                          {(current: string | null) => {
                            if (!current || current === NONE_VALUE) {
                              return "Select a ledger";
                            }
                            return options.refundLedgers.find((ledger) => ledger.id === current)?.name ?? "Select a ledger";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {options.refundLedgers.map((ledger) => (
                          <SelectItem key={ledger.id} value={ledger.id}>
                            {ledger.name} ({ledger.groupName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Adjustment Lines" columns={1}>
          <CreditNoteLineEditor gstRates={options.gstRates} />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Credit Note"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
