"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { LoadingBar } from "@/components/common/loading-bar";
import { Button } from "@/components/ui/button";
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
  ProductOptionSelector,
  type ProductOptionItem,
} from "@/modules/products/components/product-option-selector";
import { addPriceListItemAction, resolveProductPurchaseCostAction } from "@/modules/price-lists/actions/price-list-actions";
import { useMarginOverride } from "@/hooks/use-margin-override";
import { previewMarginOverrideRateAction } from "@/lib/margin-override-actions";
import {
  priceListItemSchema,
  type PriceListItemInput,
} from "@/modules/price-lists/validation/price-list-schema";

interface PriceListAddItemFormProps {
  priceListId: string;
  products: ProductOptionItem[];
}

// sellingPrice is a required number in PriceListItemInput, but the form
// should start blank rather than pre-filled with 0 — a Partial keeps the
// omission type-safe instead of casting `undefined as unknown as number`.
const EMPTY_VALUES: Partial<PriceListItemInput> = {
  productId: "",
  sellingPrice: undefined,
  minQuantity: undefined,
};

function toNumberOrUndefined(value: number): number | undefined {
  return Number.isNaN(value) ? undefined : value;
}

/**
 * The add-row form for the items editor (29-price-lists.md's UI) — a
 * standalone Server Action per row rather than a whole-list batch save, so
 * it matches the action envelope convention and avoids diffing logic.
 */
export function PriceListAddItemForm({ priceListId, products }: PriceListAddItemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PriceListItemInput>({
    resolver: zodResolver(priceListItemSchema),
    defaultValues: EMPTY_VALUES,
  });

  // Temporary margin override (Ctrl+Shift+M) — writes the override-computed
  // price directly into the `sellingPrice` field, same as the Sales
  // document line editors. See
  // src/components/margin-override/margin-override-dialog.tsx.
  const marginOverride = useMarginOverride();
  const [resolvedCost, setResolvedCost] = React.useState<number | null>(null);
  const watchedProductId = useWatch({ control: form.control, name: "productId" });

  React.useEffect(() => {
    if (!marginOverride || !watchedProductId || resolvedCost !== null) {
      return;
    }
    let cancelled = false;
    void resolveProductPurchaseCostAction(watchedProductId).then((result) => {
      if (!cancelled && result.success) {
        setResolvedCost(result.data ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [marginOverride, watchedProductId, resolvedCost]);

  React.useEffect(() => {
    if (!marginOverride || resolvedCost === null) {
      return;
    }
    let cancelled = false;
    void previewMarginOverrideRateAction({ purchaseCost: resolvedCost, marginPercent: marginOverride.marginPercent }).then(
      (result) => {
        if (!cancelled && result.success && result.data !== null && result.data !== undefined) {
          form.setValue("sellingPrice", result.data, { shouldValidate: true });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [marginOverride, resolvedCost, form]);

  async function handleSubmit(data: PriceListItemInput) {
    setIsSubmitting(true);
    try {
      const result = await addPriceListItemAction(priceListId, data);
      if (result.success) {
        toast.success("Item row added.");
        form.reset(EMPTY_VALUES);
        router.refresh();
        return;
      }
      toast.error(result.error ?? "Failed to add item row.");
    } catch {
      toast.error("Failed to add item row.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-4"
      >
        <FormField
          control={form.control}
          name="productId"
          render={({ field }) => (
            <FormItem className="min-w-56 flex-1">
              <FormLabel>Product *</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={products}
                  value={field.value || undefined}
                  onChange={(value) => {
                    field.onChange(value ?? "");
                    setResolvedCost(null);
                  }}
                  allowNone={false}
                  placeholder="Select a product"
                  emptyLabel="No active products"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="minQuantity"
          render={({ field }) => (
            <FormItem className="w-32">
              <FormLabel>Min Qty</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0.0001}
                  step="0.0001"
                  placeholder="1"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(toNumberOrUndefined(event.target.valueAsNumber))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sellingPrice"
          render={({ field }) => (
            <FormItem className="w-36">
              <FormLabel>Price *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(toNumberOrUndefined(event.target.valueAsNumber))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={isSubmitting} className="mb-[2px]">
          {isSubmitting ? <LoadingBar className="w-8" label="Adding" /> : <Plus size={16} />}
          {isSubmitting ? "Adding…" : "Add Row"}
        </Button>
      </form>
    </Form>
  );
}
