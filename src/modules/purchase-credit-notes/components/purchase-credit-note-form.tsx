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
import { SearchableSelect } from "@/components/common/searchable-select";
import { GST_STATE_CODES } from "@/engines/gst/state-codes";
import { createPurchaseCreditNoteDraftAction, updatePurchaseCreditNoteDraftAction } from "@/modules/purchase-credit-notes/actions/purchase-credit-note-actions";
import { PurchaseCreditNoteLineEditor } from "@/modules/purchase-credit-notes/components/purchase-credit-note-line-editor";
import { createPurchaseCreditNoteSchema, type CreatePurchaseCreditNoteInput } from "@/modules/purchase-credit-notes/validation/purchase-credit-note-schema";
import type { PurchaseCreditNoteDetail, PurchaseCreditNoteFormOptions } from "@/types/purchase-credit-note";

const LIST_PATH = "/purchase/credit-notes";
// Base UI's Select decides controlled-vs-uncontrolled on the first render by
// checking whether `value` is `undefined` — mirrors credit-note-form.tsx's
// NONE_VALUE fix exactly.
const NONE_VALUE = "__none__";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

interface PurchaseCreditNoteFormProps {
  options: PurchaseCreditNoteFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  purchaseCreditNote?: PurchaseCreditNoteDetail;
}

export function PurchaseCreditNoteForm({ options, purchaseCreditNote }: PurchaseCreditNoteFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = purchaseCreditNote !== undefined;

  const form = useForm<CreatePurchaseCreditNoteInput>({
    resolver: zodResolver(createPurchaseCreditNoteSchema),
    defaultValues: {
      supplierId: purchaseCreditNote?.supplierId ?? "",
      purchaseInvoiceId: purchaseCreditNote?.purchaseInvoiceId ?? undefined,
      noteDate: purchaseCreditNote ? toDateInputValue(purchaseCreditNote.noteDate) : todayDateInputValue(),
      placeOfSupplyStateCode: purchaseCreditNote?.placeOfSupplyStateCode ?? "",
      reason: purchaseCreditNote?.reason ?? "",
      lines: purchaseCreditNote
        ? purchaseCreditNote.items.map((item) => ({
            description: item.description,
            taxableAmount: item.taxableAmount,
            ratePercent: item.ratePercent,
            cessPercent: item.cessPercent,
          }))
        : [{ description: "", taxableAmount: 0, ratePercent: 0, cessPercent: 0 }],
    },
  });

  const purchaseInvoiceId = useWatch({ control: form.control, name: "purchaseInvoiceId" });

  function applyInvoicePrefill(invoiceId: string | undefined) {
    form.setValue("purchaseInvoiceId", invoiceId, { shouldValidate: true });
    if (!invoiceId) {
      return;
    }
    const invoice = options.invoices.find((option) => option.id === invoiceId);
    if (!invoice) {
      return;
    }
    form.setValue("supplierId", invoice.supplierId, { shouldValidate: true });
    form.setValue("placeOfSupplyStateCode", invoice.placeOfSupplyStateCode, { shouldValidate: true });
  }

  async function handleSubmit(values: CreatePurchaseCreditNoteInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updatePurchaseCreditNoteDraftAction(purchaseCreditNote.id, values)
        : await createPurchaseCreditNoteDraftAction(values);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save purchase credit note." : "Failed to create purchase credit note."));
        return;
      }

      toast.success(isEdit ? "Purchase credit note saved successfully." : "Purchase credit note created successfully.");
      router.push(isEdit ? `${LIST_PATH}/${purchaseCreditNote.id}` : `${LIST_PATH}/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save purchase credit note." : "Failed to create purchase credit note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!options.isLedgerMappingComplete ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            The Purchase &amp; GST ledger mapping is incomplete — posting will be blocked until Settings &gt; Sales &amp;
            Purchase GST Ledgers is fully configured.
          </p>
        ) : null}

        <FormSection title="Details">
          <FormItem>
            <FormLabel>Link Purchase Invoice (optional)</FormLabel>
            <FormControl>
              <SearchableSelect
                options={options.invoices}
                value={purchaseInvoiceId}
                onChange={(next) => applyInvoicePrefill(next)}
                getOptionId={(invoice) => invoice.id}
                getOptionLabel={(invoice) => `${invoice.invoiceNumber} — ${invoice.supplierName}`}
                noneLabel="No linked invoice"
                placeholder="No linked invoice"
              />
            </FormControl>
          </FormItem>

          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier *</FormLabel>
                <FormControl>
                  <SearchableSelect
                    options={options.suppliers}
                    value={field.value || undefined}
                    onChange={(next) => field.onChange(next ?? "")}
                    getOptionId={(supplier) => supplier.id}
                    getOptionLabel={(supplier) => supplier.name}
                    allowNone={false}
                    placeholder="Select a supplier"
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
          <PurchaseCreditNoteLineEditor gstRates={options.gstRates} />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Purchase Credit Note"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
