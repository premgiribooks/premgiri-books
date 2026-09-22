"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { LoadingBar } from "@/components/common/loading-bar";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { GST_STATE_CODES } from "@/engines/gst/state-codes";
import { createDebitNoteDraftAction, updateDebitNoteDraftAction } from "@/modules/debit-notes/actions/debit-note-actions";
import { DebitNoteLineEditor } from "@/modules/debit-notes/components/debit-note-line-editor";
import { createDebitNoteSchema, type CreateDebitNoteInput } from "@/modules/debit-notes/validation/debit-note-schema";
import type { DebitNoteDetail, DebitNoteFormOptions } from "@/types/debit-note";

const LIST_PATH = "/sales/debit-notes";
// Base UI's Select decides controlled-vs-uncontrolled on the first render by
// checking whether `value` is `undefined` — mirrors credit-note-form.tsx's
// NONE_VALUE fix exactly (commit f45f7c1).
const NONE_VALUE = "__none__";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

interface DebitNoteFormProps {
  options: DebitNoteFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  debitNote?: DebitNoteDetail;
}

export function DebitNoteForm({ options, debitNote }: DebitNoteFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = debitNote !== undefined;

  const form = useForm<CreateDebitNoteInput>({
    resolver: zodResolver(createDebitNoteSchema),
    defaultValues: {
      customerId: debitNote?.customerId ?? "",
      salesInvoiceId: debitNote?.salesInvoiceId ?? undefined,
      noteDate: debitNote ? toDateInputValue(debitNote.noteDate) : todayDateInputValue(),
      placeOfSupplyStateCode: debitNote?.placeOfSupplyStateCode ?? "",
      reason: debitNote?.reason ?? "",
      lines: debitNote
        ? debitNote.items.map((item) => ({
            description: item.description,
            taxableAmount: item.taxableAmount,
            ratePercent: item.ratePercent,
            cessPercent: item.cessPercent,
          }))
        : [{ description: "", taxableAmount: 0, ratePercent: 0, cessPercent: 0 }],
    },
  });

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

  async function handleSubmit(values: CreateDebitNoteInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateDebitNoteDraftAction(debitNote.id, values)
        : await createDebitNoteDraftAction(values);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save debit note." : "Failed to create debit note."));
        return;
      }

      toast.success(isEdit ? "Debit note saved successfully." : "Debit note created successfully.");
      router.push(isEdit ? `${LIST_PATH}/${debitNote.id}` : `${LIST_PATH}/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save debit note." : "Failed to create debit note.");
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
              <SearchableSelect
                options={options.invoices}
                value={salesInvoiceId}
                onChange={(next) => applyInvoicePrefill(next)}
                getOptionId={(invoice) => invoice.id}
                getOptionLabel={(invoice) => `${invoice.invoiceNumber} — ${invoice.customerName}`}
                noneLabel="No linked invoice"
                placeholder="No linked invoice"
              />
            </FormControl>
          </FormItem>

          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer *</FormLabel>
                <FormControl>
                  <SearchableSelect
                    options={options.customers}
                    value={field.value || undefined}
                    onChange={(next) => field.onChange(next ?? "")}
                    getOptionId={(customer) => customer.id}
                    getOptionLabel={(customer) => customer.name}
                    allowNone={false}
                    placeholder="Select a customer"
                  />
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
          <DebitNoteLineEditor gstRates={options.gstRates} />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Saving" data-icon="inline-start" /> : null}
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Debit Note"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
