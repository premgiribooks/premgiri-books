"use client";

import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { RecordOpeningStockInput } from "@/modules/opening-stock/validation/opening-stock-schema";
import type { OpeningStockProductOption } from "@/types/opening-stock";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface OpeningStockLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  warehouseOptions: ProductOptionItem[];
  productsById: ReadonlyMap<string, OpeningStockProductOption>;
  onRemove: () => void;
  canRemove: boolean;
}

/** Mirrors purchase-invoice-line-row.tsx's product/warehouse picker pair,
 * minus rate/tax computation (Opening Stock has zero financial consequence —
 * 46-opening-stock.md's Goal). Selecting a product defaults the warehouse to
 * `Product.defaultWarehouseId` when the line's warehouse is still unset
 * (46-opening-stock.md's UI). */
export function OpeningStockLineRow({ index, productOptions, warehouseOptions, productsById, onRemove, canRemove }: OpeningStockLineRowProps) {
  const { control, setValue, getValues } = useFormContext<RecordOpeningStockInput>();

  function handleProductChange(productId: string | undefined) {
    setValue(`lines.${index}.productId`, productId ?? "", { shouldValidate: true });
    if (!productId) {
      return;
    }

    const product = productsById.get(productId);
    const currentWarehouseId = getValues(`lines.${index}.warehouseId`);
    if (!currentWarehouseId && product?.defaultWarehouseId) {
      setValue(`lines.${index}.warehouseId`, product.defaultWarehouseId, { shouldValidate: true });
    }
  }

  return (
    <TableRow>
      <TableCell className="min-w-56">
        <FormField
          control={control}
          name={`lines.${index}.productId`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ProductOptionSelector
                  options={productOptions}
                  value={field.value || undefined}
                  onChange={handleProductChange}
                  allowNone={false}
                  placeholder="Select a product"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell className="min-w-48">
        <FormField
          control={control}
          name={`lines.${index}.warehouseId`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ProductOptionSelector
                  options={warehouseOptions}
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value ?? "")}
                  allowNone={false}
                  placeholder="Select a warehouse"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell>
        <FormField
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0.0001}
                  step="0.0001"
                  style={{ width: numericFieldWidth(field.value) }}
                  {...field}
                  onChange={(event) => field.onChange(toNumberOrZero(event.target.valueAsNumber))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell>
        <FormField
          control={control}
          name={`lines.${index}.unitCost`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.value ?? ""}
                  style={{ width: numericFieldWidth(field.value) }}
                  onChange={(event) => field.onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell>
        <FormField
          control={control}
          name={`lines.${index}.transactionDate`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell className="min-w-40">
        <FormField
          control={control}
          name={`lines.${index}.narration`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="Optional" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" disabled={!canRemove} onClick={onRemove}>
          <Trash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
