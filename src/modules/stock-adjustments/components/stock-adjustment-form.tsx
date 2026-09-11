"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  createStockAdjustmentDraftAction,
  updateStockAdjustmentDraftAction,
} from "@/modules/stock-adjustments/actions/stock-adjustment-actions";
import { StockAdjustmentLineEditor } from "@/modules/stock-adjustments/components/stock-adjustment-line-editor";
import {
  createStockAdjustmentSchema,
  type CreateStockAdjustmentInput,
} from "@/modules/stock-adjustments/validation/stock-adjustment-schema";
import type { StockAdjustmentDetail, StockAdjustmentFormOptions } from "@/types/stock-adjustment";

const LIST_PATH = "/inventory/adjustments";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

interface StockAdjustmentFormProps {
  options: StockAdjustmentFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  stockAdjustment?: StockAdjustmentDetail;
}

export function StockAdjustmentForm({ options, stockAdjustment }: StockAdjustmentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = stockAdjustment !== undefined;

  const form = useForm<CreateStockAdjustmentInput>({
    resolver: zodResolver(createStockAdjustmentSchema),
    defaultValues: {
      adjustmentDate: stockAdjustment ? toDateInputValue(stockAdjustment.adjustmentDate) : todayDateInputValue(),
      reason: stockAdjustment?.reason ?? "",
      lines: stockAdjustment
        ? stockAdjustment.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            direction: item.direction,
            quantity: item.quantity,
            narration: item.narration ?? undefined,
          }))
        : [{ productId: "", warehouseId: "", direction: "IN", quantity: 1, narration: undefined }],
    },
  });

  async function handleSubmit(data: CreateStockAdjustmentInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit ? await updateStockAdjustmentDraftAction(stockAdjustment.id, data) : await createStockAdjustmentDraftAction(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save stock adjustment." : "Failed to create stock adjustment."));
        return;
      }

      toast.success(isEdit ? "Stock adjustment saved successfully." : "Stock adjustment draft created.");
      router.push(`${LIST_PATH}/${isEdit ? stockAdjustment.id : result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save stock adjustment." : "Failed to create stock adjustment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number (assigned on posting): <span className="font-financial">{options.nextAdjustmentNumber}</span>
          </p>
        ) : null}

        <FormSection title="Details">
          <FormField
            control={form.control}
            name="adjustmentDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adjustment Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
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
                  <Input {...field} placeholder="Why stock is being corrected — shrinkage, damage, recount, etc." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Lines" columns={1}>
          <StockAdjustmentLineEditor products={options.products} warehouses={options.warehouses} />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save Draft"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
