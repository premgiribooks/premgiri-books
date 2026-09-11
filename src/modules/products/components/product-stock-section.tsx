"use client";

import { useWatch, type Control } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { ProductNumberField } from "@/modules/products/components/product-number-field";
import { ProductOptionSelector } from "@/modules/products/components/product-option-selector";
import type { CreateProductInput } from "@/modules/products/validation/product-schema";
import type { ProductMasterOption, ProductType } from "@/types/product";

interface ProductStockSectionProps {
  control: Control<CreateProductInput>;
  warehouses: ProductMasterOption[];
  /** The selected unit's decimalPlaces (0 when none picked yet) — drives the
   * input step and the helper text; the server re-verifies the precision. */
  unitDecimalPlaces: number;
  productType: ProductType;
  /** True once the product has any recorded StockTransaction — disables the
   * batch-tracking toggle (50-batch-tracking.md's immutability rule; the
   * server is the real authority, this is a courtesy). Always false on
   * create. */
  hasStockTransactions: boolean;
}

/** Stock: reorder threshold + default warehouse + batch tracking opt-in — no
 * quantities here, every movement is the Inventory Engine's (#30) job
 * (Invariant 7). */
export function ProductStockSection({
  control,
  warehouses,
  unitDecimalPlaces,
  productType,
  hasStockTransactions,
}: ProductStockSectionProps) {
  const step = unitDecimalPlaces === 0 ? "1" : `0.${"0".repeat(unitDecimalPlaces - 1)}1`;

  // Mutual exclusion (51-serial-number-tracking.md's Business Rules,
  // reusing 50-batch-tracking.md's rule) — selecting one disables the other
  // in the UI, reinforcing the server-side mutual exclusion the schema and
  // repository both enforce.
  const isBatchTracked = useWatch({ control, name: "isBatchTracked" });
  const isSerialTracked = useWatch({ control, name: "isSerialTracked" });

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Stock</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ProductNumberField
          control={control}
          name="minStockLevel"
          label="Min Stock Level"
          step={step}
          helperText={
            unitDecimalPlaces === 0
              ? "Reorder threshold — a whole number (the selected unit has 0 decimal places)."
              : `Reorder threshold — up to ${unitDecimalPlaces} decimal places (the selected unit's limit).`
          }
        />

        <FormField
          control={control}
          name="defaultWarehouseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Warehouse</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={warehouses.map((option) => ({
                    id: option.id,
                    label: option.name,
                    isActive: option.isActive,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="No default warehouse"
                  emptyLabel="No warehouses"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Optional — single-location shops may never create a warehouse.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="isBatchTracked"
        render={({ field }) => {
          const disabled = productType !== "TRADING" || hasStockTransactions || isSerialTracked;
          return (
            <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Batch Tracking</FormLabel>
                <FormDescription>
                  {hasStockTransactions
                    ? "This product has recorded stock movements — batch tracking can no longer be turned on or off."
                    : productType !== "TRADING"
                      ? "Only a trading product can be batch-tracked."
                      : isSerialTracked
                        ? "This product is serial-tracked — a product cannot be both batch- and serial-tracked."
                        : "Track stock in named batches (lot number, manufacture/expiry dates) for this product. Once enabled, every stock movement for it must select a batch — this must be wired into each document's line editor separately before it takes effect there."}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>
            </FormItem>
          );
        }}
      />

      <FormField
        control={control}
        name="isSerialTracked"
        render={({ field }) => {
          const disabled = productType !== "TRADING" || hasStockTransactions || isBatchTracked;
          return (
            <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Serial Number Tracking</FormLabel>
                <FormDescription>
                  {hasStockTransactions
                    ? "This product has recorded stock movements — serial tracking can no longer be turned on or off."
                    : productType !== "TRADING"
                      ? "Only a trading product can be serial-tracked."
                      : isBatchTracked
                        ? "This product is batch-tracked — a product cannot be both batch- and serial-tracked."
                        : "Track stock by individual serial number (IMEI, device serial, equipment tag) for this product. Once enabled, every stock movement for it must select a serial number — this must be wired into each document's line editor separately before it takes effect there."}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>
            </FormItem>
          );
        }}
      />
    </section>
  );
}
