"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GST_STATE_CODES } from "@/engines/gst/state-codes";
import {
  createQuotationAction,
  previewQuotationAction,
  updateQuotationAction,
} from "@/modules/quotations/actions/quotation-actions";
import { QuotationLineEditor } from "@/modules/quotations/components/quotation-line-editor";
import { QuotationTotalsSummary } from "@/modules/quotations/components/quotation-totals-summary";
import {
  createQuotationSchema,
  type CreateQuotationInput,
} from "@/modules/quotations/validation/quotation-schema";
import type { QuotationDetail, QuotationFormOptions, QuotationPreview } from "@/types/quotation";

const LIST_PATH = "/sales/quotations";
const PREVIEW_DEBOUNCE_MS = 300;

// Base UI's Select decides controlled-vs-uncontrolled on the first render by
// checking whether `value` is `undefined` — NONE_VALUE (a distinct, defined
// "controlled, nothing selected yet" sentinel) keeps it controlled for the
// component's entire lifetime, even while the underlying field value is ""
// (react-hook-form's default). See branch-selector.tsx/
// product-option-selector.tsx for the reference fix this mirrors.
const NONE_VALUE = "__none__";

const EMPTY_PREVIEW: QuotationPreview = {
  lines: [],
  totals: {
    subtotal: 0,
    totalDiscount: 0,
    taxableAmount: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalCess: 0,
    grandTotal: 0,
  },
  groups: [],
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

interface QuotationFormProps {
  options: QuotationFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  quotation?: QuotationDetail;
}

export function QuotationForm({ options, quotation }: QuotationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [preview, setPreview] = React.useState<QuotationPreview>(EMPTY_PREVIEW);
  const isEdit = quotation !== undefined;

  const form = useForm<CreateQuotationInput>({
    resolver: zodResolver(createQuotationSchema),
    defaultValues: {
      customerId: quotation?.customerId ?? "",
      quotationDate: quotation ? toDateInputValue(quotation.quotationDate) : todayDateInputValue(),
      validUntil: quotation?.validUntil ? toDateInputValue(quotation.validUntil) : "",
      placeOfSupplyStateCode: quotation?.placeOfSupplyStateCode ?? options.companyStateCode ?? "",
      narration: quotation?.narration ?? "",
      lines: quotation
        ? quotation.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            rate: item.rate,
            discountPercent: item.discountPercent || undefined,
            discountAmount: item.discountAmount || undefined,
          }))
        : [{ productId: "", quantity: 1, rate: 0, discountPercent: undefined, discountAmount: undefined }],
    },
  });

  const customerId = useWatch({ control: form.control, name: "customerId" });
  const quotationDate = useWatch({ control: form.control, name: "quotationDate" });
  const placeOfSupplyStateCode = useWatch({ control: form.control, name: "placeOfSupplyStateCode" });
  const lines = useWatch({ control: form.control, name: "lines" });

  // Debounced live preview — every line/header edit re-composes the GST
  // Engine's calculateLine/calculateDocument server-side (the browser never
  // computes tax itself, 35-quotations.md's UI). A row still missing a
  // product/quantity/rate is simply excluded from the payload rather than
  // sent as an incomplete line.
  React.useEffect(() => {
    const validLines = (lines ?? []).filter(
      (line): line is NonNullable<typeof line> =>
        Boolean(line?.productId) && (line?.quantity ?? 0) > 0 && (line?.rate ?? -1) >= 0
    );

    const handle = setTimeout(() => {
      if (validLines.length === 0 || !placeOfSupplyStateCode) {
        setPreview(EMPTY_PREVIEW);
        return;
      }

      void previewQuotationAction({
        customerId: customerId || undefined,
        quotationDate: quotationDate || todayDateInputValue(),
        validUntil: undefined,
        placeOfSupplyStateCode,
        narration: undefined,
        lines: validLines,
      }).then((result) => {
        if (result.success && result.data) {
          setPreview(result.data);
        }
      });
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [customerId, quotationDate, placeOfSupplyStateCode, lines]);

  async function handleSubmit(data: CreateQuotationInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateQuotationAction(quotation.id, data)
        : await createQuotationAction(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save quotation." : "Failed to create quotation."));
        return;
      }

      toast.success(isEdit ? "Quotation saved successfully." : "Quotation created successfully.");
      router.push(isEdit ? `${LIST_PATH}/${quotation.id}` : `${LIST_PATH}/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save quotation." : "Failed to create quotation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number: <span className="font-financial">{options.nextQuotationNumber}</span>
          </p>
        ) : null}

        <FormSection title="Details">
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer *</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? "" : next)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a customer">
                        {(current: string | null) => {
                          if (!current || current === NONE_VALUE) {
                            return "Select a customer";
                          }
                          return (
                            options.customers.find((customer) => customer.id === current)?.name ??
                            "Select a customer"
                          );
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
            name="quotationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quotation Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid Until</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
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
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? "" : next)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a state">
                        {(current: string | null) => {
                          if (!current || current === NONE_VALUE) {
                            return "Select a state";
                          }
                          return GST_STATE_CODES.find((entry) => entry.code === current)?.name ?? "Select a state";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {GST_STATE_CODES.map((entry) => (
                        <SelectItem key={entry.code} value={entry.code}>
                          {entry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Defaults to your company&apos;s own state — confirm or change it per quotation.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="narration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Narration</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Lines" columns={1}>
          <QuotationLineEditor
            products={options.products}
            computations={preview.lines}
            customerId={customerId || undefined}
            quotationDate={quotationDate || todayDateInputValue()}
          />
        </FormSection>

        <QuotationTotalsSummary totals={preview.totals} groups={preview.groups} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Quotation"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
