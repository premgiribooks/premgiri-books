"use client";

import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { CreateStockAdjustmentInput } from "@/modules/stock-adjustments/validation/stock-adjustment-schema";
import type { StockAdjustmentProductOption } from "@/types/stock-adjustment";

const DIRECTION_LABELS = { IN: "Found (IN)", OUT: "Write-off (OUT)" } as const;

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface StockAdjustmentLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  warehouseOptions: ProductOptionItem[];
  productsById: ReadonlyMap<string, StockAdjustmentProductOption>;
  onRemove: () => void;
  canRemove: boolean;
}

/** Mirrors opening-stock-line-row.tsx's product/warehouse picker pair, with
 * a per-line direction toggle (IN = found/increase, OUT = write-off/decrease
 * — 47-stock-adjustment.md's Goal) in place of unit cost. Selecting a
 * product defaults the warehouse to `Product.defaultWarehouseId` when the
 * line's warehouse is still unset. */
export function StockAdjustmentLineRow({ index, productOptions, warehouseOptions, productsById, onRemove, canRemove }: StockAdjustmentLineRowProps) {
  const { control, setValue, getValues } = useFormContext<CreateStockAdjustmentInput>();

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

      <TableCell className="min-w-40">
        <FormField
          control={control}
          name={`lines.${index}.direction`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label="Direction">
                    <SelectValue>{(current: string | null) => DIRECTION_LABELS[current as keyof typeof DIRECTION_LABELS] ?? "Select"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">{DIRECTION_LABELS.IN}</SelectItem>
                    <SelectItem value="OUT">{DIRECTION_LABELS.OUT}</SelectItem>
                  </SelectContent>
                </Select>
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
