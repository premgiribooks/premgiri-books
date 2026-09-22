"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { LoadingBar } from "@/components/common/loading-bar";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import {
  createStockTransferDraftAction,
  updateStockTransferDraftAction,
} from "@/modules/stock-transfers/actions/stock-transfer-actions";
import { StockTransferLineEditor } from "@/modules/stock-transfers/components/stock-transfer-line-editor";
import {
  createStockTransferSchema,
  type CreateStockTransferInput,
} from "@/modules/stock-transfers/validation/stock-transfer-schema";
import type { StockTransferDetail, StockTransferFormOptions, StockTransferWarehouseOption } from "@/types/stock-transfer";

const LIST_PATH = "/inventory/transfers";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

function warehouseLabel(warehouse: StockTransferWarehouseOption): string {
  return `${warehouse.name} (${warehouse.code})`;
}

interface StockTransferFormProps {
  options: StockTransferFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  stockTransfer?: StockTransferDetail;
}

export function StockTransferForm({ options, stockTransfer }: StockTransferFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = stockTransfer !== undefined;

  const warehouseOptions: ProductOptionItem[] = React.useMemo(
    () => options.warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouseLabel(warehouse), isActive: warehouse.isActive })),
    [options.warehouses]
  );

  const form = useForm<CreateStockTransferInput>({
    resolver: zodResolver(createStockTransferSchema),
    defaultValues: {
      transferDate: stockTransfer ? toDateInputValue(stockTransfer.transferDate) : todayDateInputValue(),
      sourceWarehouseId: stockTransfer?.sourceWarehouseId ?? "",
      destinationWarehouseId: stockTransfer?.destinationWarehouseId ?? "",
      narration: stockTransfer?.narration ?? undefined,
      lines: stockTransfer
        ? stockTransfer.items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
        : [{ productId: "", quantity: 1 }],
    },
  });

  async function handleSubmit(data: CreateStockTransferInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit ? await updateStockTransferDraftAction(stockTransfer.id, data) : await createStockTransferDraftAction(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save stock transfer." : "Failed to create stock transfer."));
        return;
      }

      toast.success(isEdit ? "Stock transfer saved successfully." : "Stock transfer draft created.");
      router.push(`${LIST_PATH}/${isEdit ? stockTransfer.id : result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save stock transfer." : "Failed to create stock transfer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number (assigned on posting): <span className="font-financial">{options.nextTransferNumber}</span>
          </p>
        ) : null}

        <FormSection title="Details">
          <FormField
            control={form.control}
            name="transferDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transfer Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sourceWarehouseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source Warehouse *</FormLabel>
                <FormControl>
                  <ProductOptionSelector
                    options={warehouseOptions}
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? "")}
                    allowNone={false}
                    placeholder="Select source warehouse"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="destinationWarehouseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination Warehouse *</FormLabel>
                <FormControl>
                  <ProductOptionSelector
                    options={warehouseOptions}
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? "")}
                    allowNone={false}
                    placeholder="Select destination warehouse"
                  />
                </FormControl>
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
                  <Input {...field} value={field.value ?? ""} placeholder="Optional" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Lines" columns={1}>
          <StockTransferLineEditor products={options.products} />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Saving" data-icon="inline-start" /> : null}
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save Draft"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
