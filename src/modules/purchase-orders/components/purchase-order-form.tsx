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
  createPurchaseOrderAction,
  previewPurchaseOrderAction,
  updatePurchaseOrderAction,
} from "@/modules/purchase-orders/actions/purchase-order-actions";
import { PurchaseOrderLineEditor } from "@/modules/purchase-orders/components/purchase-order-line-editor";
import { PurchaseOrderTotalsSummary } from "@/modules/purchase-orders/components/purchase-order-totals-summary";
import {
  createPurchaseOrderSchema,
  type CreatePurchaseOrderInput,
} from "@/modules/purchase-orders/validation/purchase-order-schema";
import type { PurchaseOrderDetail, PurchaseOrderFormOptions, PurchaseOrderPreview } from "@/types/purchase-order";

const LIST_PATH = "/purchase/orders";
const PREVIEW_DEBOUNCE_MS = 300;

// Base UI's Select decides controlled-vs-uncontrolled on the first render by
// checking whether `value` is `undefined` — mirrors sales-order-form.tsx's
// NONE_VALUE fix exactly.
const NONE_VALUE = "__none__";

const EMPTY_PREVIEW: PurchaseOrderPreview = {
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

interface PurchaseOrderFormProps {
  options: PurchaseOrderFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  purchaseOrder?: PurchaseOrderDetail;
}

export function PurchaseOrderForm({ options, purchaseOrder }: PurchaseOrderFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [preview, setPreview] = React.useState<PurchaseOrderPreview>(EMPTY_PREVIEW);
  const isEdit = purchaseOrder !== undefined;

  const form = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: {
      supplierId: purchaseOrder?.supplierId ?? "",
      orderDate: purchaseOrder ? toDateInputValue(purchaseOrder.orderDate) : todayDateInputValue(),
      expectedDeliveryDate: purchaseOrder?.expectedDeliveryDate
        ? toDateInputValue(purchaseOrder.expectedDeliveryDate)
        : "",
      placeOfSupplyStateCode: purchaseOrder?.placeOfSupplyStateCode ?? options.companyStateCode ?? "",
      narration: purchaseOrder?.narration ?? "",
      lines: purchaseOrder
        ? purchaseOrder.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            rate: item.rate,
            discountPercent: item.discountPercent || undefined,
            discountAmount: item.discountAmount || undefined,
          }))
        : [{ productId: "", quantity: 1, rate: 0, discountPercent: undefined, discountAmount: undefined }],
    },
  });

  const orderDate = useWatch({ control: form.control, name: "orderDate" });
  const placeOfSupplyStateCode = useWatch({ control: form.control, name: "placeOfSupplyStateCode" });
  const lines = useWatch({ control: form.control, name: "lines" });

  // Debounced live preview — mirrors sales-order-form.tsx exactly (the
  // browser never computes tax itself).
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

      void previewPurchaseOrderAction({
        supplierId: undefined,
        orderDate: orderDate || todayDateInputValue(),
        expectedDeliveryDate: undefined,
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
  }, [orderDate, placeOfSupplyStateCode, lines]);

  async function handleSubmit(data: CreatePurchaseOrderInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updatePurchaseOrderAction(purchaseOrder.id, data)
        : await createPurchaseOrderAction(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save purchase order." : "Failed to create purchase order."));
        return;
      }

      toast.success(isEdit ? "Purchase order saved successfully." : "Purchase order created successfully.");
      router.push(isEdit ? `${LIST_PATH}/${purchaseOrder.id}` : `${LIST_PATH}/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save purchase order." : "Failed to create purchase order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number: <span className="font-financial">{options.nextOrderNumber}</span>
          </p>
        ) : null}

        <FormSection title="Details">
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier *</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? "" : next)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a supplier">
                        {(current: string | null) => {
                          if (!current || current === NONE_VALUE) {
                            return "Select a supplier";
                          }
                          return (
                            options.suppliers.find((supplier) => supplier.id === current)?.name ??
                            "Select a supplier"
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {options.suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
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
            name="orderDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expectedDeliveryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected Delivery Date</FormLabel>
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
                  The supplier&apos;s state — usually the state goods ship from. Defaults to your
                  company&apos;s own state; confirm or change it per order.
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
          <PurchaseOrderLineEditor products={options.products} computations={preview.lines} />
        </FormSection>

        <PurchaseOrderTotalsSummary totals={preview.totals} groups={preview.groups} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Purchase Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
